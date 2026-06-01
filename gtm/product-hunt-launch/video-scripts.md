# Video Scripts

## Recommended Launch Video

Length: 45-60 seconds.

Format: YouTube upload, public or unlisted, 16:9. Product Hunt currently supports YouTube links for launch videos.

Goal: Show the behavior change first, then the admin UI proof. The video should feel like a product demo with a founder voice, not a cinematic brand ad.

| Rationale | Importance |
|---|---:|
| Product Hunt says video is optional, but useful for showing products in action and personalizing the launch. MemexAI benefits because its value becomes obvious when viewers see memory written, injected into the next call, used in the answer, and inspected. | 8 |

## Script A: "Inspectable Memory"

### 0-5s

Visual: AI chat or demo agent prompt: "Remember I prefer quiet neighborhoods near good schools."

Voiceover:

> Your AI agent stored something. But does the next answer actually change?

### 5-14s

Visual: MemexAI tool call writes `user/profile.md`, then code highlights `await memory.getSystemPrompt(...)`.

Voiceover:

> MemexAI stores durable memory, then injects the right context into the next model call.

### 14-24s

Visual: Second turn: "What neighborhood should I look for?" The answer uses quiet neighborhoods near good schools without the user repeating it.

Voiceover:

> So returning users get a personalized response from the first message of the next session.

### 24-35s

Visual: Admin UI file tree, memory content, revision history, and access logs.

Voiceover:

> And your team can inspect why: readable files, revisions, access logs, search, and clear isolation between users.

### 35-47s

Visual: Dreaming panel or before/after consolidation.

Voiceover:

> And when memory grows over time, optional Dreaming helps consolidate duplicates and contradictions through the same reviewable write path.

### 47-58s

Visual: Docker quickstart, SDK code, `memexai.space`.

Voiceover:

> Run it with Docker, use the TypeScript or Python SDK, connect through REST or MCP, and give your agents memory that changes answers humans can trust.

End card:

> MemexAI: memory that changes the next AI response.

| Rationale | Importance |
|---|---:|
| Best default script. It covers the full product promise while remaining demo-first. | 10 |

## Script B: "Memory Maintenance"

### 0-6s

Visual: Messy memory notes accumulating over sessions.

Voiceover:

> Long-running agents do not just need memory. They need memory that stays clean.

### 6-16s

Visual: MemexAI files in Postgres, admin UI.

Voiceover:

> MemexAI stores durable user memory as readable files in Postgres, so teams can inspect what the agent remembers.

### 16-30s

Visual: User preference updated from old to new; revision appears.

Voiceover:

> When memory changes, MemexAI records the revision and the access log. You can see what changed and why.

### 30-45s

Visual: Dreaming pass merges duplicates and preserves audit trail.

Voiceover:

> Dreaming runs after memory has been quiet. It compacts fragmented notes, resolves direct contradictions, and writes normal revisions as `dream-agent`.

### 45-55s

Visual: Clean memory file used in a later search.

Voiceover:

> The next session starts from a cleaner, more trustworthy working set.

End card:

> MemexAI: agent memory that stays readable over time.

| Rationale | Importance |
|---|---:|
| Strong for launches anchored around Dreaming, but it risks under-explaining the base product. Use as a blog/social cutdown if Script A is the main PH video. | 7 |

## 15 Second Social Cutdown

Visual sequence:

1. Agent writes a preference.
2. Code shows `getSystemPrompt(...)`.
3. Second answer uses the preference.
4. Admin UI shows `user/profile.md`, revision, and access log.
5. Docker/SDK quickstart appears.

Voiceover:

> Memory is only valuable when it changes the next answer. MemexAI stores durable user memory, injects it into the next model call, and gives your team the Postgres-backed record behind it. Launching on Product Hunt today.

| Rationale | Importance |
|---|---:|
| Short enough for X/LinkedIn and useful for launch-day reposting. | 7 |

## Shot List

| Shot | Source | Rationale | Importance |
|---|---|---|---:|
| Demo agent storing a preference | `apps/demo-agent` | Shows memory creation. | 9 |
| Prompt block in model call | SDK or docs code | Shows how memory reaches the next response. | 10 |
| Second-turn personalized answer | `apps/demo-agent` | Shows the actual product value. | 10 |
| Admin UI file tree | `apps/service/admin/src/components/FilesView.tsx` | Visual proof of inspectability. | 10 |
| Revisions view | Admin UI | Proof of auditability. | 9 |
| Access logs / observability | `ObservabilityView.tsx`, admin observability | Shows operational trust. | 8 |
| Docker quickstart | README or docs | Converts viewers to trials. | 8 |
| Dreaming before/after | Dreaming docs/admin | Differentiates beyond static storage. | 8 |

## Production Guidance

- Record real UI at high resolution.
- Keep captions on-screen; many viewers watch muted.
- Avoid a long intro logo animation.
- Open with the pain and the UI within the first five seconds.
- Keep all claims concrete and visible.
