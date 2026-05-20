import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Union, Optional
from .errors import MemexError
from .types import RequestContext, SearchResultItem
from ._db import DbPool
from ._paths import (
    assert_writable_virtual_path,
    virtual_to_physical,
    physical_to_virtual,
    prefix_to_physical,
)

# Text patch helper functions, mirroring packages/core/src/text-patch.ts
def append_lines_after_heading(content: str, after_heading: str, lines: List[str]) -> Dict[str, Any]:
    newline = "\r\n" if "\r\n" in content else "\n"
    all_lines = content.split(newline)
    heading = after_heading.strip()

    heading_index = -1
    for i, line in enumerate(all_lines):
        if line.strip() == heading:
            heading_index = i
            break

    if heading_index < 0:
        raise MemexError("PATCH_HEADING_NOT_FOUND", f"Heading not found: {after_heading}")

    # Determine heading level (number of leading # characters)
    m = re.match(r'^(#+)', heading)
    level = len(m.group(1)) if m else 0

    insert_at = len(all_lines)
    for index in range(heading_index + 1, len(all_lines)):
        match = re.match(r'^(#+)\s', all_lines[index].strip())
        if match and len(match.group(1)) <= level:
            insert_at = index
            break

    section = all_lines[heading_index + 1:insert_at]
    lines_to_add = [line for line in lines if line not in section]
    if not lines_to_add:
        return {"content": content, "changed": False}

    insertion = list(lines_to_add)
    if insert_at > 0 and all_lines[insert_at - 1] != "":
        insertion.insert(0, "")
    if insert_at < len(all_lines) and all_lines[insert_at] != "":
        insertion.append("")

    next_lines = list(all_lines)
    next_lines[insert_at:insert_at] = insertion
    return {"content": newline.join(next_lines), "changed": True}

def replace_exact_text(content: str, match: str, replacement: Union[str, List[str]]) -> Dict[str, Any]:
    newline = "\r\n" if "\r\n" in content else "\n"
    replacement_text = newline.join(replacement) if isinstance(replacement, list) else replacement

    count = content.count(match)
    if count == 0:
        raise MemexError("PATCH_MATCH_NOT_FOUND", "Exact match not found")
    if count > 1:
        raise MemexError("PATCH_AMBIGUOUS_MATCH", f"Ambiguous match ({count} occurrences)")
    if match == replacement_text:
        return {"content": content, "changed": False}

    return {"content": content.replace(match, replacement_text), "changed": True}

def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"

async def log_access(db: DbPool, file_id: Optional[str], physical_path: str, operation: str, ctx: RequestContext) -> None:
    await db.execute(
        """INSERT INTO mx_access_log (id, file_id, physical_path, operation, actor, user_id, tool_call_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
        new_id("log"),
        file_id,
        physical_path,
        operation,
        ctx.actor,
        ctx.user_id,
        ctx.tool_call_id,
    )

async def insert_revision(db: DbPool, file_id: str, physical_path: str, operation: str, content: str, reason: Optional[str], ctx: RequestContext) -> None:
    await db.execute(
        """INSERT INTO mx_revision (id, file_id, physical_path, operation, content_text, reason, actor, user_id, tool_call_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        new_id("rev"),
        file_id,
        physical_path,
        operation,
        content,
        reason,
        ctx.actor,
        ctx.user_id,
        ctx.tool_call_id,
    )

async def execute_memory_list(db: DbPool, args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
    prefix = args.get("prefix")
    physical_prefix = prefix_to_physical(prefix, ctx)

    values = []
    if physical_prefix:
        where = "physical_path = $1 OR physical_path LIKE $2"
        values = [physical_prefix, f"{physical_prefix if physical_prefix.endswith('/') else physical_prefix + '/'}%"]
    else:
        where = "(physical_path = 'shared' OR physical_path LIKE 'shared/%' OR physical_path LIKE $1)"
        values = [f"users/{ctx.user_id}/%"]

    sql = f"""
        SELECT id, physical_path, content_text, created_at, updated_at
        FROM mx_file
        WHERE {where}
        ORDER BY physical_path ASC
    """
    rows = await db.query(sql, *values)

    await log_access(db, None, physical_prefix or "*", "list", ctx)

    files = []
    for row in rows:
        virtual_path = physical_to_virtual(row["physical_path"], ctx)
        if not virtual_path:
            continue
        # Ensure updated_at is timezone aware or naive datetime
        updated_at = row["updated_at"]
        files.append({
            "path": virtual_path,
            "size": len(row["content_text"]),
            "updatedAt": updated_at,
        })

    return {"files": files}

async def execute_memory_read(db: DbPool, args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
    path = args.get("path")
    if not path:
        raise MemexError("INVALID_PATH", "path is required")
    physical_path = virtual_to_physical(path, ctx)

    rows = await db.query(
        "SELECT id, physical_path, content_text, created_at, updated_at FROM mx_file WHERE physical_path = $1",
        physical_path,
    )
    if not rows:
        raise MemexError("FILE_NOT_FOUND", f"File not found: {path}")

    file = rows[0]
    await log_access(db, file["id"], physical_path, "read", ctx)

    return {
        "path": path,
        "content": file["content_text"],
        "updatedAt": file["updated_at"],
    }

async def execute_memory_write(db: DbPool, args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
    path = args.get("path")
    content = args.get("content")
    reason = args.get("reason")
    if not path:
        raise MemexError("INVALID_PATH", "path is required")
    if content is None:
        raise MemexError("INVALID_CONTENT", "content is required")

    assert_writable_virtual_path(path)
    physical_path = virtual_to_physical(path, ctx)

    # Use xmax trick to check if created or updated
    rows = await db.query(
        """INSERT INTO mx_file (id, physical_path, content_text)
           VALUES ($1, $2, $3)
           ON CONFLICT (physical_path)
           DO UPDATE SET content_text = EXCLUDED.content_text, updated_at = now()
           RETURNING id, (xmax = 0) AS created""",
        new_id("file"),
        physical_path,
        content,
    )
    file = rows[0]
    file_id = file["id"]
    created = file["created"]

    await insert_revision(db, file_id, physical_path, "write", content, reason, ctx)
    await log_access(db, file_id, physical_path, "write", ctx)

    return {
        "path": path,
        "created": created,
        "updated": not created,
    }

async def execute_memory_patch(db: DbPool, args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
    path = args.get("path")
    operation = args.get("operation")
    reason = args.get("reason")
    if not path:
        raise MemexError("INVALID_PATH", "path is required")
    if not operation:
        raise MemexError("INVALID_OPERATION", "operation is required")

    assert_writable_virtual_path(path)
    physical_path = virtual_to_physical(path, ctx)

    rows = await db.query(
        "SELECT id, physical_path, content_text, created_at, updated_at FROM mx_file WHERE physical_path = $1",
        physical_path,
    )
    if not rows:
        raise MemexError("FILE_NOT_FOUND", f"File not found: {path}")

    file = rows[0]
    file_id = file["id"]
    content_text = file["content_text"]

    if operation == "append_lines":
        after_heading = args.get("after_heading")
        lines = args.get("lines")
        if after_heading is None or lines is None:
            raise MemexError("INVALID_ARGS", "after_heading and lines are required for append_lines")
        result = append_lines_after_heading(content_text, after_heading, lines)
    elif operation == "replace_lines":
        match = args.get("match")
        replacement = args.get("replacement")
        if match is None or replacement is None:
            raise MemexError("INVALID_ARGS", "match and replacement are required for replace_lines")
        result = replace_exact_text(content_text, match, replacement)
    else:
        raise MemexError("INVALID_OPERATION", f"Unknown patch operation: {operation}")

    changed = result["changed"]
    if changed:
        await db.execute(
            "UPDATE mx_file SET content_text = $1, updated_at = now() WHERE id = $2",
            result["content"],
            file_id,
        )
        await insert_revision(db, file_id, physical_path, "patch", result["content"], reason, ctx)

    await log_access(db, file_id, physical_path, "patch", ctx)

    return {
        "path": path,
        "operation": operation,
        "changed": changed,
        "noOp": not changed,
    }

async def execute_memory_smart_read(db: DbPool, args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
    max_chars = args.get("maxChars") or 24000
    query_str = args.get("query")

    values = [f"users/{ctx.user_id}/%"]
    if query_str:
        values.insert(0, query_str)
        sql = """
          WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
          SELECT id, physical_path, content_text, created_at, updated_at, ts_rank_cd(search_vector, q.query) AS rank
          FROM mx_file, q
          WHERE (physical_path LIKE $2 OR physical_path LIKE 'shared/%')
            AND search_vector @@ q.query
          ORDER BY rank DESC, updated_at DESC
        """
    else:
        sql = """
          SELECT id, physical_path, content_text, created_at, updated_at
          FROM mx_file
          WHERE physical_path LIKE $1 OR physical_path LIKE 'shared/%'
          ORDER BY updated_at DESC
        """

    rows = await db.query(sql, *values)

    visible_files = []
    for row in rows:
        path = physical_to_virtual(row["physical_path"], ctx)
        if path:
            visible_files.append({
                "path": path,
                "content": row["content_text"],
                "updatedAt": row["updated_at"],
            })

    included = []
    omitted = []
    used_chars = 0

    for file in visible_files:
        section_chars = len(file["path"]) + len(file["content"]) + 64
        if used_chars + section_chars <= max_chars or len(included) == 0:
            if section_chars <= max_chars or len(included) == 0:
                included.append(file)
                used_chars += section_chars
                continue
        omitted.append(file["path"])

    # Build memory block
    sections = []
    for file in included:
        updated_iso = file["updatedAt"].replace(tzinfo=timezone.utc).isoformat() if hasattr(file["updatedAt"], "replace") else str(file["updatedAt"])
        sections.append(f"## {file['path']}\n(updated {updated_iso})\n\n{file['content']}")

    note = f"---\nNote: {len(omitted)} file(s) omitted (budget limit). Use memory_search to find specific content." if omitted else None

    content_parts = ["<memexai_memory>"] + sections
    if note:
        content_parts.append(note)
    content_parts.append("</memexai_memory>")

    content = "\n\n".join(content_parts)

    await log_access(db, None, "*", "smart_read", ctx)

    return {
        "content": content,
        "filesIncluded": [file["path"] for file in included],
        "filesOmitted": omitted,
        "truncated": len(omitted) > 0,
    }

async def execute_memory_search_bm25(db: DbPool, input_args: Dict[str, Any], ctx: RequestContext) -> Dict[str, Any]:
    query_str = input_args.get("query")
    if not query_str:
        raise MemexError("INVALID_ARGS", "query is required")
    limit = input_args.get("limit") or 10
    prefix = input_args.get("prefix")

    values = [query_str]
    if prefix:
        physical_prefix = prefix_to_physical(prefix, ctx)
        if not physical_prefix:
            raise MemexError("INVALID_PATH", "prefix is required")
        visibility_where = "(physical_path = $2 OR physical_path LIKE $3)"
        values.extend([physical_prefix, f"{physical_prefix if physical_prefix.endswith('/') else physical_prefix + '/'}%"])
    else:
        visibility_where = "(physical_path LIKE $2 OR physical_path LIKE 'shared/%')"
        values.append(f"users/{ctx.user_id}/%")

    values.append(limit)

    sql = f"""
      WITH q AS (SELECT plainto_tsquery('english', $1) AS query)
      SELECT
        physical_path,
        ts_headline('english', content_text, q.query, 'MaxFragments=2, MinWords=4, MaxWords=24') AS snippet,
        ts_rank_cd(search_vector, q.query) AS rank,
        updated_at
      FROM mx_file, q
      WHERE {visibility_where}
        AND search_vector @@ q.query
      ORDER BY rank DESC, updated_at DESC
      LIMIT ${len(values)}
    """
    rows = await db.query(sql, *values)

    log_path = prefix_to_physical(prefix, ctx) if prefix else "*"
    await log_access(db, None, log_path or "*", "search", ctx)

    results = []
    for row in rows:
        path = physical_to_virtual(row["physical_path"], ctx)
        if not path:
            continue
        results.append({
            "path": path,
            "snippet": row["snippet"],
            "rank": float(row["rank"]),
            "updatedAt": row["updated_at"],
        })

    return {
        "query": query_str,
        "results": results,
        "truncated": False,
    }

async def execute_memory_search(db: DbPool, args: Dict[str, Any], ctx: RequestContext, model: Optional[Any] = None) -> Dict[str, Any]:
    if model:
        return await execute_agentic_memory_search(db, args, ctx, model)
    return await execute_memory_search_bm25(db, args, ctx)

async def execute_agentic_memory_search(db: DbPool, args: Dict[str, Any], ctx: RequestContext, model: Any) -> Dict[str, Any]:
    # In python, the model parameter can be a callable that takes (system, prompt, tools)
    # and returns a text answer plus list of sources.
    # If the model is a callable, we call it.
    query_str = args.get("query")
    if not query_str:
        raise MemexError("INVALID_ARGS", "query is required")
    max_reads = args.get("maxReads") or 5
    max_chars = args.get("maxChars") or 8000

    candidates = await execute_memory_search_bm25(db, args, ctx)
    list_res = await execute_memory_list(db, {"prefix": args.get("prefix")}, ctx)

    # Let's perform reads for indices
    indexes = []
    for p in ["user/index.md", "shared/index.md"]:
        try:
            r = await execute_memory_read(db, {"path": p}, ctx)
            indexes.append({"path": p, "content": r["content"]})
        except Exception:
            pass

    # Check if model is a custom async function or a class that we can invoke
    if callable(model):
        system_prompt = "\n".join([
            "You are a read-only memory resolver.",
            "Answer the user's query using only MemexAI memory.",
            "Use virtual paths only, such as user/profile.md or shared/index.md.",
            "Never use physical paths such as users/{userId}/...",
            "Do not write, patch, memorize, or mutate memory.",
            "Cite relevant memory paths in your answer.",
            f"Stay under {max_chars} characters.",
        ])

        prompt = "\n".join([
            f"Query: {query_str}",
            "",
            "Visible files:",
            str(list_res["files"]),
            "",
            "BM25 candidates:",
            str(candidates["results"]),
            "",
            "Index files:",
            str(indexes),
        ])

        # Define internal read functions for the model to use if it wants
        reads_count = 0
        sources = set()

        async def read_fn(path: str):
            nonlocal reads_count
            if reads_count >= max_reads:
                raise MemexError("MAX_READS_EXCEEDED", "memory_search read budget exceeded")
            reads_count += 1
            res = await execute_memory_read(db, {"path": path}, ctx)
            sources.add(path)
            return res

        async def smart_read_fn(read_args: dict):
            nonlocal reads_count
            if reads_count >= max_reads:
                raise MemexError("MAX_READS_EXCEEDED", "memory_search read budget exceeded")
            reads_count += 1
            res = await execute_memory_smart_read(db, read_args, ctx)
            for path in res.get("filesIncluded", []):
                sources.add(path)
            return res

        # Run custom tool calling loop via model callable
        response_text = await model(
            system=system_prompt,
            prompt=prompt,
            tools={
                "memory_read": read_fn,
                "memory_smart_read": smart_read_fn,
            }
        )

        return {
            **candidates,
            "answer": response_text[:max_chars],
            "sources": list(sources),
        }
    else:
        raise MemexError("MODEL_NOT_CONFIGURED", "Model configuration must be a callable for agentic memory search")

async def execute_memory_memorize(db: DbPool, args: Dict[str, Any], ctx: RequestContext, model: Optional[Any] = None) -> Dict[str, Any]:
    if not model:
        raise MemexError("MODEL_NOT_CONFIGURED", "memory_memorize requires a configured model")

    text = args.get("text")
    if not text:
        raise MemexError("INVALID_ARGS", "text is required")
    max_writes = args.get("maxWrites") or 5
    dry_run = args.get("dryRun") or False

    list_res = await execute_memory_list(db, {}, ctx)

    indexes = []
    for p in ["user/index.md", "shared/index.md"]:
        try:
            r = await execute_memory_read(db, {"path": p}, ctx)
            indexes.append({"path": p, "content": r["content"]})
        except Exception:
            pass

    writes = []

    def ensure_write_budget():
        if len(writes) >= max_writes:
            raise MemexError("MAX_WRITES_EXCEEDED", "memory_memorize write budget exceeded")

    if callable(model):
        system_prompt = "\n".join([
            "You are a memory ingestion agent.",
            "Extract only durable facts worth remembering.",
            "Use virtual paths only, such as user/profile.md.",
            "Never use physical paths such as users/{userId}/...",
            "Prefer memory_patch when a relevant user file already exists.",
            "Use memory_write only for new user files.",
            "Always include a concise reason.",
            "After writing or patching any user file, also update user/index.md: patch it if it exists, write it if not. Add or update a one-line entry per file in the format: `- user/filename.md — <short purpose>`.",
            "After all writes, append one line per written file to user/log.md (patch if exists, write if not): `- [YYYY-MM-DD] <wrote|patched> user/filename.md — <reason>`. Use today's date.",
            "When writing a new file, if related files already exist, add a `## See also` section with `[[user/related.md]]` links. When patching, add links if newly relevant.",
            "Dry run is enabled; plan writes but do not commit them." if dry_run else "Commit useful writes.",
        ])

        prompt = "\n".join([
            "Text to memorize:",
            text,
            "",
            "Existing files:",
            str(list_res["files"]),
            "",
            "Index files:",
            str(indexes),
        ])

        async def write_fn(write_args: dict):
            ensure_write_budget()
            assert_writable_virtual_path(write_args["path"])
            planned = {
                "tool": "memory_write",
                "path": write_args["path"],
                "reason": write_args.get("reason"),
                "args": write_args,
            }
            if not dry_run:
                planned["result"] = await execute_memory_write(db, write_args, ctx)
            writes.append(planned)
            return {"planned": True, "path": write_args["path"]} if dry_run else planned["result"]

        async def patch_fn(patch_args: dict):
            ensure_write_budget()
            assert_writable_virtual_path(patch_args["path"])
            planned = {
                "tool": "memory_patch",
                "path": patch_args["path"],
                "reason": patch_args.get("reason"),
                "args": patch_args,
            }
            if not dry_run:
                planned["result"] = await execute_memory_patch(db, patch_args, ctx)
            writes.append(planned)
            return {"planned": True, "path": patch_args["path"]} if dry_run else planned["result"]

        response_text = await model(
            system=system_prompt,
            prompt=prompt,
            tools={
                "memory_write": write_fn,
                "memory_patch": patch_fn,
            }
        )

        return {
            "text": text,
            "dryRun": dry_run,
            "writes": writes,
        }
    else:
        raise MemexError("MODEL_NOT_CONFIGURED", "Model configuration must be a callable for memory_memorize")

async def execute_tool(db: DbPool, tool_name: str, args: Dict[str, Any], ctx: RequestContext, model: Optional[Any] = None) -> Dict[str, Any]:
    if tool_name == "memory_list":
        return await execute_memory_list(db, args, ctx)
    elif tool_name == "memory_read":
        return await execute_memory_read(db, args, ctx)
    elif tool_name == "memory_write":
        return await execute_memory_write(db, args, ctx)
    elif tool_name == "memory_patch":
        return await execute_memory_patch(db, args, ctx)
    elif tool_name == "memory_smart_read":
        return await execute_memory_smart_read(db, args, ctx)
    elif tool_name == "memory_search":
        return await execute_memory_search(db, args, ctx, model)
    elif tool_name == "memory_memorize":
        return await execute_memory_memorize(db, args, ctx, model)
    else:
        raise MemexError("UNKNOWN_TOOL", f"Unknown tool: {tool_name}")
