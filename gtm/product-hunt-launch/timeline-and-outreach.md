# Timeline And Outreach

## Launch Timeline

Assume launch day is **T**. Product Hunt allows scheduling up to one month ahead; use the schedule window once core assets are ready.

| Time | Work | Rationale | Importance |
|---|---|---|---:|
| T-21 to T-14 | Freeze launch thesis, update homepage hero if needed, confirm setup flow works. | The page must match PH copy before traffic arrives. | 10 |
| T-14 | Create Product Hunt draft with name, tagline, description, tags, links, thumbnail, gallery placeholders. | Scheduling early reduces launch-day risk. | 9 |
| T-14 to T-10 | Capture admin UI screenshots and demo footage. | Visual assets need real product proof. | 10 |
| T-10 | Produce gallery images and video draft. | Gives enough time for review and compression. | 10 |
| T-9 | Persona review pass: skeptical developer, AI founder, PH browser. | Catches unclear claims before they become public. | 8 |
| T-7 | Finalize maker comment, reply bank, launch posts, outreach list. | Launch day should be response-focused, not drafting-focused. | 9 |
| T-5 | Dry-run install: Docker service, two-turn memory proof, prompt block injection, admin UI inspection. | Broken setup or generic second-turn answers kill qualified traffic. | 10 |
| T-3 | Confirm PH maker profiles, co-makers, GitHub repo, docs links, analytics. | Avoids avoidable launch mechanics issues. | 8 |
| T-1 | Final asset export, schedule posts, prepare monitoring dashboard. | Reduces launch-day context switching. | 8 |
| T | Launch, comment immediately, respond continuously, share personally. | Comment velocity and authentic conversation matter. | 10 |
| T+1 | Publish "what we learned" update and route feedback into issues/roadmap. | Converts launch attention into product learning. | 8 |
| T+7 | Follow-up blog/social thread on memory as product data. | Compounds beyond the one-day PH spike. | 7 |
| T+30 | Publish launch retrospective with install/use-case learnings. | Builds trust and creates evergreen content. | 5 |

## Recommended Launch Time

Default: 12:01am Pacific Time if the team can cover the first several hours.

Alternative: Launch at a time the team can actively reply for at least eight hours. Product Hunt's guide notes the best time depends on goals, geography, and ability to drive authentic engagement.

| Rationale | Importance |
|---|---:|
| A full-day launch only helps if comments and support are staffed. For MemexAI, technical replies matter more than gaming the exact hour. | 8 |

## Outreach Segments

| Segment | Ask | Rationale | Importance |
|---|---|---|---:|
| AI product founders | "Would love your feedback on where stored memory should enter the next response." | Highest fit for use-case comments and calls. | 10 |
| Agent framework builders | "Curious how this maps to your memory/tooling model." | Can create integration and credibility opportunities. | 8 |
| Postgres/devtools community | "We built agent memory on boring infra; poke holes." | Skeptical technical audience can validate architecture. | 8 |
| Existing Slack/GitHub watchers | "We launched; questions and feedback welcome." | Warmest likely supporters. | 9 |
| AI infra writers/newsletter authors | "This is a concrete angle on inspectable AI memory." | Potential post-launch distribution. | 7 |
| Friends/community | "Read, comment if you have a real question." | Useful only if authentic and not vote-bait. | 5 |

## Outreach Rules

- Do not ask for upvotes.
- Ask for feedback, questions, or use-case comments.
- Send personal messages, not blast copy.
- Route builders to `memexai.space`, GitHub, Docker quickstart, or setup.md depending on their context.
- Keep replies specific; PH visitors will notice canned answers.

## Launch-Day Reply Bank

### "How is this different from Mem0?"

Mem0 is strong when you want extracted memories and retrieval. MemexAI is narrower: memory as inspectable product data. It stores scoped files in Postgres, with revisions, access logs, admin UI, SDKs, REST, MCP, and optional background consolidation. If you need humans to inspect and correct the memory record, that is where MemexAI is aiming.

Importance: 8

### "Why not just use a vector DB?"

Vector search is useful for recall over large text corpora and can coexist with MemexAI. MemexAI is for the smaller durable working set the agent should actually carry forward: preferences, decisions, facts, project notes, and policies. Those records benefit from being readable, editable, reviewable, and stored in your existing Postgres stack.

Importance: 9

### "Does it store every conversation?"

No. That is intentional. Raw transcripts can live in your app, warehouse, or audit store. MemexAI is for durable memory that should survive into later sessions. This makes the memory record smaller and easier to trust.

Importance: 10

### "What is Dreaming?"

Dreaming is optional model-assisted background consolidation. After user memory has been quiet, it can help merge duplicates, compact fragmented notes, and handle direct contradictions through normal memory writes. Dream writes create revisions and access logs like any other write.

Importance: 8

### "Is it hosted?"

The current launch is self-hosted/open-source infrastructure: Docker service, direct Postgres mode, TypeScript/Python SDKs, REST, and MCP. A hosted dashboard can be discussed if enough teams want it.

Importance: 7

### "Is it production-ready?"

The core loop is working: Postgres-backed files, scoped tools, search, revision and access history, SDKs, MCP, admin UI, and optional Dreaming. It is early OSS, best suited today for builders evaluating self-hosted memory workflows with Docker/Postgres. Before treating it as a regulated audit system or a high-scale managed service, teams should review auth, backups, tenancy assumptions, evals, and operational monitoring for their own environment.

Importance: 9

### "Where is user isolation enforced?"

Agents see virtual paths like `user/profile.md` and `shared/policy.md`. MemexAI validates those paths before touching the database. `user/*` is translated into a user-specific physical namespace, while `shared/*` is read-only for agents. This is enforced in the service/tool layer, not by asking the model nicely in a prompt.

Importance: 9

### "Is this compliance-grade audit logging?"

No. MemexAI provides revision and access history that is useful for debugging, product operations, and understanding memory changes. Regulated compliance audit requirements still need your normal security, retention, monitoring, and governance controls around the deployment.

Importance: 8

## Launch Posts

### X / Twitter

We launched MemexAI on Product Hunt.

AI memory is only valuable when it changes the next answer, and your team can inspect why.

MemexAI stores durable user memory, injects it into the next model call, and keeps the Postgres-backed record inspectable: scoped files, revision and access history, SDKs, MCP, admin UI, and optional Dreaming for consolidation.

Would love feedback from AI product builders.

Importance: 8

### LinkedIn

We are launching MemexAI on Product Hunt today.

The bet: AI memory is only valuable when it changes the next response, and once it affects a real user experience it should be inspectable product data.

MemexAI stores durable agent memory as scoped files in Postgres, injects it into the next model call through a prompt block, and gives teams revision and access history, search, SDKs, MCP, an admin UI, and optional background consolidation.

If you are building AI products with returning users, I would love your feedback: where should stored memory enter the next response, and what would your team need to inspect or correct?

Importance: 7

### Slack / Community

We launched MemexAI on Product Hunt today: memory that changes the next AI response, backed by Postgres.

I would especially love feedback from people building AI apps with returning users. The core question we are exploring: how should stored memory influence the next answer, and when does that memory become product data your team needs to inspect?

Importance: 8
### "Why is the prompt block important?"

Storage alone does not make an agent feel like it remembers. The next model call needs memory guidance and relevant memory access. MemexAI exposes `getSystemPrompt(...)` / `getPromptBlock()` so the stored record can influence the next response, while the files, revisions, and access logs explain why.

Importance: 10
