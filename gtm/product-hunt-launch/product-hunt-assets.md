# Product Hunt Listing And Visual Assets

## Listing Copy

### Product Name

MemexAI

| Rationale | Importance |
|---|---:|
| Product Hunt asks for product name only, without descriptive stuffing. | 10 |

### Tagline

AI responses that remember users across sessions

| Rationale | Importance |
|---|---:|
| Under Product Hunt's 60-character limit and leads with the product moment: the next response changes because memory exists. | 10 |

Alternative feed-tested tagline:

Memory that changes the next AI response

| Rationale | Importance |
|---|---:|
| More direct for technical audiences who understand that storage alone is not the value. | 8 |

### Description

MemexAI helps AI products store durable user memory, inject it into the next model call, and verify the answer changed. Behind the behavior is an inspectable Postgres record: scoped files, search, revisions, access logs, admin UI, SDKs, MCP, and Dreaming.

| Rationale | Importance |
|---|---:|
| Fits the Product Hunt description field, names the product shape, and avoids overclaiming. | 10 |

### Tags

| Tag | Rationale | Importance |
|---|---|---:|
| AI Agents | Category fit and discovery. | 10 |
| Developer Tools | Strong audience match. | 9 |
| Open Source | Important if the repo and self-hosted story are core to launch. | 8 |

### Pricing

Free / open source.

| Rationale | Importance |
|---|---:|
| Product Hunt visitors should understand they can try it immediately. | 9 |

### Links

| Link | URL | Rationale | Importance |
|---|---|---|---:|
| Website | `https://memexai.space` | Primary PH URL and canonical public surface. | 10 |
| GitHub | `https://github.com/Spotlight-CX/memexai` | Converts developer interest to stars, issues, and inspection. | 9 |
| Docs | `https://memexai.space/docs` | Reduces confusion for technical evaluators. | 8 |
| Setup | `https://memexai.space/setup.md` | Differentiated "let your coding agent install this" path. | 8 |

## Maker First Comment

Hey Product Hunt,

We built MemexAI around one belief: once AI memory affects user experience, it becomes product data.

But storage is not the product moment. The real question is whether stored memory changes the next response.

MemexAI is our answer: agents get a small tool surface, your model call gets a MemexAI prompt block, and your team gets the Postgres-backed record behind the behavior: scoped files, search, revision and access history, an admin UI, SDKs, MCP, and optional background consolidation, which we call Dreaming.

The design is intentionally boring in the places that should be boring:

- Memory is injected into the next model call, not just stored somewhere.
- Memory is stored as readable files, not a hidden blob.
- User memory and shared memory are path-scoped.
- Writes create revisions.
- Reads and writes create access logs.
- The service runs with Docker, or you can use direct Postgres mode.

If you're building AI products with returning users: where does stored memory enter the next response, and can your team inspect why it mattered?

Try it here: https://memexai.space

| Rationale | Importance |
|---|---:|
| The comment is personal, explains the product and audience, asks for feedback rather than votes, and gives PH commenters a concrete question to answer. | 10 |

## Gallery Image Plan

Product Hunt recommends 1270x760 gallery images and requires at least two. Create six strong slides before launch.

### Image 1: Hero

Headline: **Memory that changes the next answer**

Visual: Two-turn demo: first turn stores a preference, second turn includes the MemexAI prompt block and answers personally. Include a small admin UI proof strip showing `user/profile.md`.

| Rationale | Importance |
|---|---:|
| This is the first impression and should make the inspectability claim visual. | 10 |

### Image 2: The Problem

Headline: **Your agent's memory should not be hidden**

Visual: Simple two-panel contrast. Left: "Hidden memory blob" with no readable state. Right: readable `user/profile.md` with "search, edit, review, revise" underneath.

| Rationale | Importance |
|---|---:|
| Frames the category pain quickly for non-users. | 8 |

### Image 3: How It Works

Headline: **Tool call -> prompt block -> response**

Visual: Flow diagram from model tool call to auth, path validation, virtual-to-physical path translation, Postgres tables, prompt block injection, and the next model response.

| Rationale | Importance |
|---|---:|
| Gives technical visitors confidence that this is real infrastructure. | 9 |

### Image 4: Admin Control

Headline: **Open memory like product data**

Visual: Admin UI with files, revisions, access logs, users, and observability views.

| Rationale | Importance |
|---|---:|
| Reinforces the strongest differentiator and creates proof from actual UI. | 10 |

### Image 5: Dreaming

Headline: **Memory needs maintenance, not just storage**

Visual: Before/after memory notes with duplicates consolidated, stale fragments compacted, and revisions preserved. Add caption: "Optional model-assisted consolidation through normal memory writes."

| Rationale | Importance |
|---|---:|
| Gives the launch a timely hook and explains Dreaming without mysticism. | 8 |

### Image 6: Install Surface

Headline: **Docker, TypeScript, Python, REST, MCP**

Visual: Code snippets and package badges, plus `docker compose up -d`.

| Rationale | Importance |
|---|---:|
| Converts Product Hunt curiosity into "I can try this today." | 9 |

## Thumbnail / Icon

Use a square 240x240 PNG under 3MB. Prefer the MemexAI mark on a plain, high-contrast background. If using an animated GIF, ensure the first frame works as a static icon because Product Hunt says thumbnail GIFs animate on hover rather than autoplay.

| Rationale | Importance |
|---|---:|
| The thumbnail appears in the feed. It must remain legible at small sizes. | 10 |

## Image Production Notes

- Design every gallery slide at 1270x760.
- Keep the central 4:3 crop readable because the first image can be reused in feeds and social surfaces.
- Use real product screenshots wherever possible.
- Prefer short headlines under 8 words.
- Avoid generic gradients and abstract AI visuals.
- Export compressed PNG/JPG versions and verify file size before scheduling.

## Proof Checklist Before Scheduling

| Proof | Material it supports | Rationale | Importance |
|---|---|---|---:|
| Real admin UI screenshot with file tree and memory content | Gallery images 1 and 4 | The core claim is inspectability; screenshots make it believable. | 10 |
| Demo recording: write memory -> inject prompt block -> changed answer -> inspect file -> revision -> access log | PH video | Shows the full behavioral and trust loop in under one minute. | 10 |
| Install proof: exact Docker command and expected first-memory output | Gallery image 6 and replies | Converts curiosity into a trial. | 9 |
| Architecture diagram with trust boundaries | Gallery image 3 and infra replies | Shows where auth, scopes, and Postgres writes happen. | 9 |
| Production caveats section | Reply bank and docs | Builds trust by naming early-stage limits. | 8 |
| Real GitHub, npm, PyPI, Docker links | PH links and install slide | Avoids launch-day credibility gaps. | 10 |
