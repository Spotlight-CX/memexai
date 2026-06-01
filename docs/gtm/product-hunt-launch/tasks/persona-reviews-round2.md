# Log Round 2 Persona Review Findings
**Priority:** P3
**Type:** docs
**Status:** [x] done

## Personas
- Infra engineer: checks operational caveats, API boundaries, retention, and security claims.
- Product founder: checks whether the first-run proof and positioning are understandable.
- AI engineer: checks whether the memory/RAG distinction is precise enough.

## Findings
### Infra Engineer
- Clarified that patch-style file rewrites have the same file-level concurrency risk as `memory_write`.
- Clarified that manual revision pruning only removes old `mx_revision` snapshots; `mx_file` and `mx_access_log` still need app-level deletion or retention policy.
- Tightened trust-model language: MemexAI provides path scoping by trusted `userId`, not a tenant authorization layer.
- Replaced browser-exposed admin-secret wording with guidance to keep admin secrets out of untrusted browsers and proxy public admin workflows server-side.
- Added deletion/privacy caveat to the correction workflow because revisions preserve prior content.

### Product Founder
- Changed homepage primary CTA to `Try the 90-second proof`.
- Made README proof language point to the fastest demo-agent path instead of implying a full app integration is required.
- Softened unsupported retention wording on the homepage.

### AI Engineer
- Replaced deterministic "changes the next response" phrasing with "made available" / "can shape" where precision matters.
- Rewrote mem0/Zep comparison copy to avoid reducing those systems to old-chat retrieval.
- Replaced BM25 phrasing with Postgres full-text ranking where the implementation is not a BM25 engine.
- Added LLM-provider caveat: storage stays in Postgres, but model-backed tools send selected text to the configured model provider.
- Clarified dreaming as an attempted consolidation loop that operators should review before broad enablement.
