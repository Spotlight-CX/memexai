# Experimental Memory Shell — Engineering Plan

## Summary

Design a read-only virtual shell over MemexAI memory files. This is an engineering plan only; do not implement until the product plan is approved.

The shell must run against virtual `user/**` and `shared/**` memory paths backed by Postgres rows. It must not use `child_process`, host filesystem access, network access, or arbitrary system binaries.

## Tool Contract

Tool name:

```text
memory_shell
```

Input:

```json
{
  "command": "find user/ -name '*.md' | xargs rg -n \"budget|preference\"",
  "maxOutputChars": 12000
}
```

Output:

```json
{
  "stdout": "...",
  "stderr": "",
  "exitCode": 0,
  "truncated": false,
  "commandsUsed": ["find", "xargs", "rg"],
  "filesRead": ["user/profile.md"]
}
```

## Availability

- Disabled by default.
- Enabled only with `MEMEX_EXPERIMENTAL_MEMORY_SHELL=true`.
- Included only in raw file tool definitions/toolsets.
- Never included in memory subagent mode.
- For service mode, `/v1/tools` and MCP tool registration must agree with execution gating.
- For direct Postgres mode, expose an explicit opt-in option only if needed.

## Parser And Runtime

Implement a constrained parser, not a shell invocation:

- Parse command, args, quotes, globs, and simple pipes.
- Reject redirects, command substitution, variables, semicolons, control operators, subshells, and env assignment.
- Limit pipeline stages.
- Limit command length.
- Limit files scanned, bytes read, output chars, and runtime.

Supported v0 commands:

- `ls`
- `find`
- `cat`
- `head`
- `tail`
- `wc`
- `grep`
- `rg`
- `jq`
- limited `xargs`

Unsupported commands should fail with structured errors such as `SHELL_UNSUPPORTED_COMMAND`, not silently degrade.

## Safety Boundaries

- Reject absolute paths.
- Reject physical paths such as `users/{userId}/...`.
- Reject `../`, backslashes, empty segments, and unknown mounts.
- Read only virtual `user/**` for the current user and readable `shared/**`.
- Do not support writes, deletes, renames, copies, redirects, `tee`, or `sed -i`.
- Keep all mutations on `memory_write` and `memory_patch` so revisions and reasons stay explicit.

## Observability

Record enough metadata to learn from the feature without leaking memory content:

- command names used
- unsupported command names
- files read
- output truncation
- duration
- exit code
- error category

Do not send stdout, stderr, memory contents, or raw command arguments to product telemetry.

Access logs should make shell reads auditable. If a command reads specific files, log those files. If a command only lists paths, log a scoped shell/list-style access.

## Testing

- Parser tests for quotes, pipes, globs, and rejected syntax.
- Command tests for `find`, `cat`, `rg`, `jq`, truncation, and non-zero exits.
- Path isolation tests for absolute paths, physical paths, `../`, unknown mounts, and cross-user files.
- Gating tests:
  - flag off: absent from raw file tools and execution returns unknown tool
  - flag on: present only in raw file tools
  - always absent from memory subagent tools
- Access-log tests for files read by shell commands.
- Service and MCP tests to ensure tool listing and execution gates match.

## Open Engineering Questions

- Should direct Postgres mode support the shell, or should v0 be service-only?
- Should `jq` support only simple selectors or embed a small library?
- Should command telemetry live in observation events, access logs, or both?
- Should shell calls read all visible files up front or lazily resolve paths per command?
- What is the right default scan budget for large tenants?
