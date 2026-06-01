# Document User ID Trust Model and Security Boundary
**Priority:** P1
**Type:** docs
**Status:** [x] done

## What
Document the boundary between MemexAI's memory scoping and the host application's authentication/authorization layer.

## Output
- Public docs page: `apps/website/content/docs/operations/trust-model.mdx`

## Key Points
- MemexAI scopes `user/` memory by server-supplied `userId`.
- The host app must authenticate the user and derive `userId` from trusted server-side state.
- Agent API keys and admin secrets must stay server-side.
- `shared/` memory is global read-only agent guidance, not private user data.

## Verification
- Page appears under Operations docs navigation.
- Page includes concrete examples, boundary tables, and an operational checklist.
