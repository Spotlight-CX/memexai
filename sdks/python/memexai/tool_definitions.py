raw_tool_definitions = [
    {
        "name": "memory_list",
        "description": "List memory files visible to the current user.\n\nReturns a flat list of virtual paths. Use `prefix` to scope to a namespace — `user/` for private files, `shared/` for globally readable files.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "prefix": {"type": "string", "description": "Optional virtual path prefix, e.g. user/ or shared/"},
            },
        },
    },
    {
        "name": "memory_read",
        "description": "Read a single memory file by its virtual path.\n\nAgents can read both `user/**` (private to the current user) and `shared/**` (global, read-only). Returns the raw file content as a string.",
        "inputSchema": {
            "type": "object",
            "required": ["path"],
            "additionalProperties": False,
            "properties": {
                "path": {"type": "string", "description": "Virtual file path, e.g. user/profile.md"},
            },
        },
    },
    {
        "name": "memory_write",
        "description": "Create or fully overwrite a `user/**` memory file.\n\nThe entire file is replaced with `content`. Use `memory_patch` when you only need to change part of an existing file. Pass a `reason` to annotate the write — stored in revision history for auditability.",
        "inputSchema": {
            "type": "object",
            "required": ["path", "content"],
            "additionalProperties": False,
            "properties": {
                "path": {"type": "string", "description": "Writable virtual file path under user/**"},
                "content": {"type": "string", "description": "Complete replacement content"},
                "reason": {"type": "string", "description": "Stored in revision history"},
            },
        },
    },
    {
        "name": "memory_patch",
        "description": "Apply targeted updates to a `user/**` memory file using heading-based line append or exact string replacement.",
        "inputSchema": {
            "type": "object",
            "required": ["path", "operation"],
            "additionalProperties": False,
            "properties": {
                "path": {"type": "string", "description": "Writable virtual file path under user/**"},
                "operation": {"type": "string", "enum": ["append_lines", "replace_lines"], "description": "Type of update operation"},
                "after_heading": {"type": "string", "description": "For append_lines: insert after this heading"},
                "lines": {"type": "array", "items": {"type": "string"}, "description": "For append_lines: lines to append"},
                "match": {"type": "string", "description": "For replace_lines: exact text to search for"},
                "replacement": {
                    "anyOf": [
                        {"type": "string"},
                        {"type": "array", "items": {"type": "string"}}
                    ],
                    "description": "For replace_lines: text to insert instead"
                },
                "reason": {"type": "string", "description": "Reason for audit log"}
            }
        }
    },
    {
        "name": "memory_smart_read",
        "description": "Read all memory files formatted into a single markdown block, ranked by update time or keyword query, within a character limit.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "maxChars": {"type": "number", "description": "Maximum characters to return. Default: 24000."},
                "query": {"type": "string", "description": "Optional query to rank files by keyword relevance."},
            },
        },
    },
]

agentic_tool_definitions = [
    {
        "name": "memory_memorize",
        "description": "Feed raw text and let MemexAI autonomously decide what to remember and where to store it.",
        "inputSchema": {
            "type": "object",
            "required": ["text"],
            "additionalProperties": False,
            "properties": {
                "text": {"type": "string", "description": "Raw conversation text or fact to remember."},
                "maxWrites": {"type": "number", "description": "Maximum write/patch operations. Default: 5."},
                "dryRun": {"type": "boolean", "description": "Plan writes without committing them."},
            },
        },
    },
    {
        "name": "memory_search",
        "description": "Search memory for a question using BM25 full-text search.",
        "inputSchema": {
            "type": "object",
            "required": ["query"],
            "additionalProperties": False,
            "properties": {
                "query": {"type": "string", "description": "Question or topic to search memory for."},
                "maxChars": {"type": "number", "description": "Maximum characters to return. Default: 8000."},
                "limit": {"type": "number", "description": "Maximum BM25 candidates. Default: 10."},
                "maxReads": {"type": "number", "description": "Maximum files the agentic resolver may inspect. Default: 5."},
                "prefix": {"type": "string", "description": "Optional virtual path prefix, e.g. user/ or shared/."},
            },
        },
    },
]

tool_definitions = agentic_tool_definitions + raw_tool_definitions
