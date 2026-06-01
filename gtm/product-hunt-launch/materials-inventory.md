# Public Materials Inventory

This inventory consolidates the public-facing material MemexAI already has and maps each item to Product Hunt usage.

## Core Public Surfaces

| Material | Current location | Use in PH launch | Rationale | Importance |
|---|---|---|---|---:|
| Homepage | `https://memexai.space` | Primary PH URL | Product Hunt requires a direct product URL. The homepage should carry the launch promise and first CTA. | 10 |
| Setup file | `https://memexai.space/setup.md` | "Try it with your coding agent" CTA | This is a distinctive launch asset: PH builders can hand one file to their agent and watch it integrate MemexAI. | 9 |
| Docs homepage | `apps/website/content/docs/index.mdx` | Secondary link in comments and replies | Shows the product is real and documented. | 8 |
| README | `README.md` | Source for technical claims and GitHub audience | Strongest concise explanation of differentiation. | 9 |
| Docker quickstart | `apps/website/content/docs/quickstart/docker-service.mdx` | Demo/install route | Most PH visitors should try service mode, not direct Postgres first. | 9 |
| Agent onboarding docs | `apps/website/content/docs/quickstart/agent-onboarding.mdx` | Launch hook for coding-agent users | Converts the current AI-builder zeitgeist into a concrete integration workflow. | 8 |
| Prompt Block concept docs | `apps/website/content/docs/concepts/prompt-block.mdx` | Explain why memory must enter the next system prompt | This is the missing bridge between storage and changed behavior. | 10 |
| Design principles | `apps/website/content/docs/concepts/design-principles.mdx` | Trust/depth link | Proves MemexAI has product taste and architecture constraints. | 7 |
| Scopes docs | `apps/website/content/docs/concepts/scopes.mdx` | Security/isolation answer | Useful for comments about multi-tenancy and agent permissions. | 8 |
| Dreaming docs | `apps/website/content/docs/operations/dreaming.mdx` | Narrative hook | Turns "memory storage" into "memory maintenance." | 9 |
| Roadmap | `apps/website/app/roadmap/page.tsx` | Post-launch CTA | Lets interested users pull roadmap direction without derailing PH copy. | 6 |
| Compare: Mem0 | `apps/website/app/compare/mem0/page.tsx` | Reply link only | Use when someone asks how it differs from Mem0. Avoid leading with competitor framing. | 6 |
| Compare: Zep | `apps/website/app/compare/zep/page.tsx` | Reply link only | Useful for graph-memory comparisons. | 5 |
| Compare: Vector DB memory | `apps/website/app/compare/vector-database/page.tsx` | Reply link only | Good for "why not embeddings?" objections. | 7 |
| GTM content plan | `docs/gtm-content-plan.md` | Internal launch positioning | Existing strategic source. Should not be linked externally. | 8 |
| Hackathon deck | `docs/hackathon-deck.md` | Raw demo story source | Useful for launch video structure, but too hackathon-coded for final PH materials. | 5 |

## Public Proof Points

| Proof point | Source | Use | Rationale | Importance |
|---|---|---|---|---:|
| npm packages | README badges and publishing docs | Gallery slide and comments | Shows installable developer artifact. | 8 |
| PyPI package | README badge | Gallery slide and comments | Expands beyond TS-only audience. | 7 |
| Docker image | README badge and quickstart | Gallery slide and video | Strongest "try this now" path. | 9 |
| Admin UI | README, service app, docs | Visual centerpiece | The inspectable-memory claim needs a screen, not only prose. | 10 |
| Revisions | docs/revisions.md | Gallery and video | Converts trust claim into a concrete mechanism. | 9 |
| Access logs | docs/access-logs.md | Gallery and video | Answers "what did the agent read/write?" | 9 |
| MCP support | docs and README | Technical credibility point | Lets Claude/Cursor-style users understand how it plugs in. | 7 |
| Dreaming | docs and roadmap | Launch narrative hook | Differentiates from static stores; focus on maintenance, not magic. | 9 |

## Materials To Create Before Launch

| Material | Owner | Rationale | Importance |
|---|---|---|---:|
| Product Hunt listing copy | Founder/launch owner | Needed to schedule launch. | 10 |
| Maker first comment | Founder/launch owner | Product Hunt says this is highly visible; it sets tone and asks for feedback. | 10 |
| 6 gallery images | Design/launch owner | Gallery is the main visual proof on PH. First image doubles as click driver. | 10 |
| 45-60 second demo video | Founder/launch owner | Shows the product in action and humanizes the story. PH says videos are common among top launches but optional. | 8 |
| 15 second social cutdown | Founder/launch owner | Useful for X/LinkedIn launch posts. | 7 |
| Launch-day reply bank | Founder/launch owner | Keeps answers consistent under pressure. | 8 |
| Outreach list | Founder/launch owner | Personal distribution matters more than generic posting. | 9 |
| Landing-page launch strip | Website owner | Visitors from PH need immediate confirmation they landed in the right place and see the two-turn proof. | 8 |
| GitHub README launch note | Repo owner | Turns PH interest into stars and installs. | 6 |

## Consolidation Rules

- Use `memexai.space` for all public URLs.
- Keep the main promise consistent: memory that changes the next response, with an inspectable Postgres-backed record.
- Do not lead with "Dreaming" alone; it is a powerful feature, not the base category.
- Do not claim "better than Mem0/Zep" broadly. Say MemexAI is better when memory must be inspectable, editable, auditable, and self-hosted in Postgres.
- Avoid "remembers everything." MemexAI is for durable working memory, not raw transcript storage.
- Treat admin UI screenshots as the main proof. Use docs and code snippets as supporting proof.
