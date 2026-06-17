# Plan: MemexAI CLI-First Developer Onboarding

---

## Architect Overview

**One-sentence goal:** Replace the 300-line `SETUP.md` with a single command — `npx @memexai/admin init` — that introspects the codebase, proposes a memory plan, sets up Docker, bootstraps shared memory, and guides developers to first working memory without reading any docs.

### Full flow (all paths)

```mermaid
flowchart TD
    START(["Developer / coding agent"]) --> ENTRY

    ENTRY["npx @memexai/admin init\n─ or ─\ndocker exec memexai memex-admin init\n─ or ─\nread SETUP.md for curl path"]

    ENTRY --> INTROSPECT

    subgraph P1 ["Phase 1 · Introspect (no infra, pure reads)"]
        INTROSPECT["Read codebase:\nREADME · system prompts · agent entrypoints\ndata models · existing memory patterns"]
        INTROSPECT --> PLAN["Generate memory plan:\nuser/ files + what each captures\nshared/ files + access policy\nwhat NOT to store · confidence per item"]
        PLAN --> HITL1{"HITL: confirm plan\nEdit .memexai/plan.md and reply 'updated'\nor say 'yes' to proceed"}
        HITL1 -->|adjust| PLAN
        HITL1 -->|confirmed| WRITE_PLAN[".memexai/plan.md written to project"]
    end

    WRITE_PLAN --> P2

    subgraph P2 ["Phase 2 · Infrastructure"]
        COMPOSE_CHECK{"compose.yml\nexists?"}
        COMPOSE_CHECK -->|no| WRITE_COMPOSE["Write compose.yml at project root\n(postgres + memexai service)"]
        COMPOSE_CHECK -->|yes, no memexai| MERGE_HINT["Print memexai service blocks\nto merge manually"]
        COMPOSE_CHECK -->|already has memexai| SKIP_COMPOSE["Skip — already present"]

        WRITE_COMPOSE --> DOCKER_UP
        MERGE_HINT --> DOCKER_UP
        SKIP_COMPOSE --> DOCKER_UP

        DOCKER_UP["docker compose up -d\ncurl health until ok"]
        DOCKER_UP --> HEALTH{"healthy?"}
        HEALTH -->|fail| LOGS["Print: docker compose logs memexai\n→ Next: fix and re-run init"]
        HEALTH -->|ok| INFRA_OK["✓ http://localhost:8080"]
    end

    INFRA_OK --> P3

    subgraph P3 ["Phase 3 · Bootstrap shared memory"]
        BOOTSTRAP["Read .memexai/plan.md\nWrite confirmed shared/ files to service\nCopy to .memexai/shared/ on filesystem"]
        BOOTSTRAP --> ENV["Append MEMEX_* vars to .env\n(never overwrite existing values)"]
        ENV --> COMPLETE["memex-admin setup complete\n--note from plan.md"]
    end

    COMPLETE --> P4

    subgraph P4 ["Phase 4 · Wire + finish"]
        WIRE["Write SDK integration snippet\ninto detected agent entrypoint"]
        WIRE --> MEMEX_MD["Write MEMEX.md to project root\n(memory contract — commit this)"]
        MEMEX_MD --> OUTPUT["Print completion block:\ncode snippet · 6 inspect commands\nadmin UI link · shared push CI/CD hint"]
    end

    OUTPUT --> DONE(["First agent run → memory works"])

    subgraph CICD ["Ongoing: CI/CD shared memory sync"]
        PUSH["memex-admin shared push\n--from .memexai/shared/\n→ deploys on every release"]
        PULL["memex-admin shared pull\n--out .memexai/shared/\n→ audit what agents wrote in RW mode"]
    end
```

---

## Filesystem Layout (in the developer's project)

```
project-root/
├── compose.yml              ← written by init (or updated to merge)
├── .env                     ← MEMEX_* vars appended by init
├── MEMEX.md                 ← memory contract, commit this
├── .memexai/
│   ├── plan.md              ← inferred memory plan, commit this
│   └── shared/
│       ├── procedural.md    ← local copy of shared/procedural.md
│       ├── semantic.md      ← local copy of shared/semantic.md
│       ├── episodic.md      ← local copy of shared/episodic.md
│       └── [domain].md      ← optional product-specific guidance
```

**Why `.memexai/`:**
- Single clean folder for all MemexAI project artifacts (like `.github/`)
- `.memexai/shared/` is the source of truth for read-only shared memory — push it on deploy
- Commitabable — developers can review changes to shared memory in PRs
- `shared pull` writes here, `shared push` reads from here

**compose.yml decisions:**
| Scenario | Action |
|----------|--------|
| No compose file exists | Write `compose.yml` at project root |
| `compose.yml` exists, no memexai services | Print service blocks + instruction to merge; do NOT auto-edit |
| `compose.yml` has memexai service already | Skip, verify health only |
| User passes `--compose-file path` | Write to that path instead |

**Why not auto-merge existing compose.yml:** YAML merging is fragile and the existing file may have formatting conventions or anchors. Safer to print what to add and let the agent/developer paste it.

---

## Task Split

### Task 1 · `memex-admin init` — Phase 1 (introspection + plan)
**New file:** `packages/admin-cli/src/commands/init.ts`

What it does:
- Reads project files (README, system prompts, entrypoints, schemas) using Node fs APIs — no service needed
- Calls the configured LLM (or falls back to a static template if no LLM key) with the inference prompt (see below)
- Writes `.memexai/plan.md` to the current working directory
- Prints the plan for HITL review and waits for confirmation (reads from stdin if interactive, auto-proceeds if `--yes` flag)

**Inference prompt (baked into init.ts):**
```
You are analysing a codebase to propose a MemexAI memory plan.

Memory is stored as scoped files in Postgres:
  user/   → private per-user facts and events (agents read+write)
  shared/ → global agent guidance and schemas (agents read-only by default)

Read the files provided below and output a memory plan in this exact format:

MEMORY PLAN
Product: [one-line description]
Inferred from: [files read]

USER MEMORY FILES
  File: user/[name].md
  Captures: [specific to this product]
  Update: patch | append-only
  Confidence: HIGH | MEDIUM | LOW
  Reason: [what in the codebase led to this]

SHARED MEMORY FILES
  File: shared/[name].md
  Purpose: [schema or rules it contains]
  Access: read-only | read-write
  Reason: [why shared across all users]

SHARED WRITE MODE
  Recommendation: disabled | enabled
  Reason: [one sentence]

WHAT NOT TO MEMORIZE
  - [list]

OPEN QUESTIONS FOR DEVELOPER
  - [uncertainties to confirm]

Rules:
- Minimum files that cover memory needs
- Prefer one well-scoped file over two overlapping ones
- shared/ contains schemas/rules, never per-user data
- Flag LOW confidence items
- Don't propose files for things in the product's own DB
```

**Success criteria:**
- [ ] `npx @memexai/admin init` with no flags reads codebase files and prints a memory plan
- [ ] Plan is written to `.memexai/plan.md` before asking for confirmation
- [ ] Developer can edit `.memexai/plan.md` and type `updated` to re-read it
- [ ] `--yes` flag skips confirmation (for non-interactive agents)
- [ ] If no LLM key configured: prints a default template plan and continues
- [ ] Plan includes at minimum: one user/ file, shared/procedural.md, shared/semantic.md

---

### Task 2 · `memex-admin init` — Phase 2 (Docker setup)
**Same file:** `packages/admin-cli/src/commands/init.ts`

What it does:
- Checks if `compose.yml` / `docker-compose.yml` exists in CWD
- Writes `compose.yml` at project root if not present (full postgres + memexai stack)
- If file exists: prints service blocks for manual merge, exits with instructions
- If service already healthy: skips compose step entirely
- Runs `docker compose up -d` (execs shell command)
- Polls `http://localhost:8080/health` up to 60s, prints dots while waiting

**compose.yml content written by init:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: memexai
      POSTGRES_PASSWORD: memexai
      POSTGRES_DB: memexai
    volumes:
      - memexai_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U memexai"]
      interval: 5s
      retries: 5

  memexai:
    image: soorajshankar/memexai:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://memexai:memexai@postgres:5432/memexai
      MEMEX_API_KEY: ${MEMEX_API_KEY:-dev-agent-key}
      MEMEX_ADMIN_SECRET: ${MEMEX_ADMIN_SECRET:-dev-admin-secret}
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
    ports:
      - "8080:8080"

volumes:
  memexai_postgres_data:
```

**Success criteria:**
- [ ] No compose file → `compose.yml` written to CWD with correct content
- [ ] Existing `compose.yml` without memexai → prints service blocks, no file write
- [ ] Existing `compose.yml` with memexai → skips compose step, probes health
- [ ] Health probe retries every 2s up to 60s, then exits with error + `docker compose logs` hint
- [ ] `--skip-docker` flag skips compose write and docker start (for use against remote service)

---

### Task 3 · `memex-admin init` — Phase 3 + 4 (bootstrap + wire)
**Same file:** `packages/admin-cli/src/commands/init.ts`

What it does:
- Reads `.memexai/plan.md` for the list of shared files to write
- Writes each shared file to service using `client.writeFile()`
- Copies written files to `.memexai/shared/` on the filesystem
- Appends `MEMEX_URL`, `MEMEX_API_KEY`, `MEMEX_ADMIN_SECRET` to `.env` (skips if key already present)
- Calls `client.writeSetupComplete(note)` with the product description from the plan
- Writes `MEMEX.md` to project root (memory contract)
- Prints completion block with TypeScript snippet, Python snippet, and 6 inspect commands

**Success criteria:**
- [ ] All shared files from plan are written to service and to `.memexai/shared/`
- [ ] `.env` updated — no duplicate keys, no overwrite of existing values
- [ ] `MEMEX.md` written with memory file table + debug commands
- [ ] Completion block includes runnable TypeScript and Python snippets with real env var names
- [ ] Running `init` again on already-bootstrapped project prints inspect commands only (idempotent)

---

### Task 4 · `memex-admin shared pull`
**New file:** `packages/admin-cli/src/commands/shared.ts`

What it does:
- Lists all `shared/*` files from service via `client.listFiles({ prefix: 'shared/' })`
- Writes each to `--out` directory (default: `./.memexai/shared/`), preserving path relative to `shared/`
- Compares content before writing — skips identical files
- Prints a table: file path | size | status (pulled / unchanged / new)

```bash
memex-admin -s $MEMEX_SERVICE_URL --admin-secret $MEMEX_ADMIN_SECRET \
  shared pull [--out ./.memexai/shared/]
```

**Success criteria:**
- [ ] Pulls all shared/* files into `.memexai/shared/` with correct directory structure
- [ ] Identical files are skipped (content comparison, not timestamp)
- [ ] New files on service not present locally are written
- [ ] Output table shows per-file status
- [ ] Works with both `--service-url` and `--database-url` modes
- [ ] `--json` flag outputs machine-readable result

---

### Task 5 · `memex-admin shared push`
**Same file:** `packages/admin-cli/src/commands/shared.ts`

What it does:
- Reads all files from `--from` directory (default: `./.memexai/shared/`)
- Writes each to service as `shared/[filename]` with reason `"ci-deploy"`
- Content hash check — skips unchanged files (idempotent for CI)
- `--dry-run` prints what would change without writing
- Exits non-zero on connection error (CI/CD must not silently pass)

```bash
memex-admin -s $MEMEX_SERVICE_URL --admin-secret $MEMEX_ADMIN_SECRET \
  shared push [--from ./.memexai/shared/] [--dry-run]
```

**CI/CD snippet (printed in setup complete output):**
```yaml
- name: Deploy shared memory
  run: |
    npx @memexai/admin \
      --service-url ${{ secrets.MEMEX_SERVICE_URL }} \
      --admin-secret ${{ secrets.MEMEX_ADMIN_SECRET }} \
      shared push --from ./.memexai/shared/
```

**Success criteria:**
- [ ] Pushes all files from `.memexai/shared/` to service
- [ ] Unchanged files skipped (content hash)
- [ ] `--dry-run` prints diff without writing
- [ ] Exit code 1 on connection failure
- [ ] Exit code 0 with "0 files changed" if nothing to push
- [ ] Works with `--service-url` and `--database-url` modes
- [ ] `--json` flag outputs machine-readable result

---

### Task 6 · `packages/admin-cli/src/cli.ts` — Register new commands
**Existing file:** add `case "init"` and `case "shared"` to the switch, add both to the HELP string.

**Success criteria:**
- [ ] `memex-admin init --help` prints full description of all phases
- [ ] `memex-admin shared --help` prints pull/push usage with examples
- [ ] `memex-admin` root help lists init and shared

---

### Task 7 · `setup status` and `setup complete` output improvements
**Existing file:** `packages/admin-cli/src/commands/setup.ts`

`setup status` changes:
- After next-steps list, always print one `→ Next: [exact command]` line based on state
- State → command mapping: (see below)

`setup complete` changes:
- After confirmation line, print TypeScript + Python integration snippets
- Print 6 inspect commands
- Print `shared pull / push` hint for CI/CD

**Success criteria:**
- [ ] `setup status` on unbootstrapped DB always ends with one `→ Next:` runnable command
- [ ] `setup status` on bootstrapped DB prints inspect commands
- [ ] `setup complete` output includes code snippets and 6 concrete commands

---

### Task 8 · `SETUP.md` rewrite
**Existing file:** reduce to ~20 lines.

Content:
1. `npx @memexai/admin init` — primary path
2. Docker exec fallback (for no-npx environments)
3. curl fallback (last resort)

**Success criteria:**
- [ ] File is under 25 lines
- [ ] All three paths documented
- [ ] No cognitive architecture content, no templates

---

### Task 9 · Docs + website updates (follow-up, non-blocking)
After CLI is implemented:
- `docs/admin-cli.md` — add `init` and `shared pull/push` sections with examples and CI/CD snippet
- `apps/website/content/setup.md` — add note at top pointing to `npx @memexai/admin init`; add "Shared memory in CI/CD" section
- Check website pages (`/docs/quickstart`, `/docs/admin-cli`) for outdated references to old setup flow

**Success criteria:**
- [ ] `docs/admin-cli.md` has full reference for `init` and `shared` commands
- [ ] Website setup page starts with `npx @memexai/admin init`
- [ ] No page still shows the 8-step SETUP.md flow as the primary path

---

## HITL Checkpoint Summary

| # | Checkpoint | Who | Auto-approvable? |
|---|-----------|-----|-----------------|
| 1 | Memory plan review | Developer confirms `.memexai/plan.md` | No — explicit confirm |
| 2 | Write `compose.yml` to project root | Claude Code tool permission | Yes with broad permissions |
| 3 | Run `docker compose up -d` | Claude Code tool permission | Yes with bash permission |
| 4 | Write `.env` additions | Claude Code tool permission | Yes |
| 5 | Write `MEMEX.md` to project | Claude Code tool permission | Yes |
| 6 | SDK snippet into agent entrypoint | Claude Code tool permission | Yes |

Exactly one checkpoint (memory plan review) requires genuine developer judgment. Everything else is mechanical and can be auto-approved.
