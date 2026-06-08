# Experimental Memory Shell — Product Plan

## Summary

Evaluate an experimental read-only `memory_shell` as an optional raw file tool. It should not become a third way to use MemexAI. The public framing remains:

- **Memory subagent** for the default two-tool path.
- **Raw file tools** for exact file-level control.

If shipped, `memory_shell` lives inside raw file tools and appears only behind an explicit experimental flag.

## Product Hypothesis

Agents and operators often know how to inspect a file workspace with Unix-like commands: `find`, `rg`, `cat`, `wc`, `jq`, and simple pipes. A constrained memory shell could make raw memory inspection faster without expanding the stable structured API too early.

The shell is valuable only if it helps us learn which structured memory operations are missing. It should be treated as a discovery tool, not as the default interface.

## Target Users

- Coding agents integrating or debugging MemexAI in a repo.
- Operators inspecting user or shared memory from the admin surface.
- Advanced app agents that already manage file paths and need quick read-only exploration.

## Non-Goals

- Do not expose host filesystem access.
- Do not execute real Bash or arbitrary binaries.
- Do not allow writes in v0.
- Do not make this a third public usage mode.
- Do not replace `memory_write`, `memory_patch`, `memory_context`, or `memory_find`.

## Proposed Positioning

Raw file tools remain the advanced path:

> Use raw file tools when your app or agent needs exact path control over memory files.

Experimental shell positioning:

> Experimental: enable `memory_shell` inside raw file tools when trusted agents need Unix-like read-only inspection over virtual memory files.

## Product Questions To Answer Before Build

- Which commands do agents actually attempt when given file-like memory?
- Does shell-style inspection reduce tool-call churn compared with `memory_list` + `memory_read` + `memory_context`?
- Do operators understand that the shell is read-only and virtual, not host Bash?
- Which repeated shell patterns should become first-class structured tools?
- Does the extra flexibility create confusing failure modes for normal users?

## Success Criteria

- Shell usage is limited to advanced/debug workflows.
- Unsupported-command telemetry reveals concrete structured-tool gaps.
- No product copy suggests shell is a third integration path.
- Operators can explain what files were read by a shell call.
- The shell does not become necessary for the happy-path onboarding proof.

## Rollout Recommendation

1. Keep the feature unimplemented until the engineering plan is reviewed.
2. If built, ship read-only behind `MEMEX_EXPERIMENTAL_MEMORY_SHELL=true`.
3. Document it only in raw file tools and operations docs, not quickstart happy paths.
4. Review command telemetry before stabilizing or expanding command support.
