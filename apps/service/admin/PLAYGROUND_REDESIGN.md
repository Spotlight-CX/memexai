# Playground Redesign — Plan & Progress

## Goal
Split `/admin/playground` into two persona-aware views:
- **Quick Test** (default) — two cards: Memorize + Search, zero sidebar noise
- **Raw Tools** — existing sidebar+form+response layout, accessed via `?view=raw`

Add **Copy as JS / Python** inline snippet to both views.

---

## Product Roadmap Notes

These are not feature tickets. They are bigger directions worth revisiting after the playground gets the first-run experience right. Each should earn its place by making MemexAI more durable, legible, or easier to trust, not by adding surface area for its own sake.

### Local-first memory mode
**Idea:** Explore a zero-server local mode for developers who want memory running beside their agent without Docker or hosted infrastructure.

**Why it matters:** The fastest path to adoption is often "try it in two minutes, keep it if it becomes useful." A local-first path could make MemexAI feel less like infrastructure and more like a dependable tool in the developer's loop.

**Restraint:** This should preserve the same mental model as the service: files, scopes, auditability, and search. It should not become a second product with different semantics.

### Source-scoped memory
**Idea:** Let memory be organized around meaningful sources or contexts, not only `shared/` and per-user files.

**Why it matters:** Real memory often belongs to a project, team, customer, workspace, or imported knowledge base. Source-scoping would help MemexAI support richer systems of record without collapsing everything into one namespace.

**Restraint:** The goal is clearer boundaries, not a complex permission maze. Keep the primitive understandable before adding policy machinery.

### Link-aware memory
**Idea:** Treat explicit links between memory files as first-class signals.

**Why it matters:** Human-readable files are already MemexAI's strongest design choice. Lightweight linking would make those files more navigable for humans and more useful for agents, while staying aligned with the inspectable-memory philosophy.

**Restraint:** Start from links users and agents can see in the files themselves. Avoid invisible graph magic that makes answers harder to explain.

### Optional deeper retrieval
**Idea:** Keep Postgres full-text search as the simple default, but leave room for an optional deeper retrieval layer when teams have larger or messier memory sets.

**Why it matters:** Some users will outgrow keyword search, especially when memory grows across projects, documents, and long-lived histories. A stronger retrieval mode could extend MemexAI without forcing vector infrastructure on everyone.

**Restraint:** This should be opt-in and measurable. If the answer is not more grounded, faster to inspect, or easier to debug, it is not worth the complexity.

### Health and trust loop
**Idea:** Give operators a way to see whether memory is healthy: stale files, missing indexes, duplicate facts, failed writes, low-signal memory, and suspicious contradictions.

**Why it matters:** Durable memory is only valuable if people trust it over time. A lightweight health loop turns MemexAI from "storage for agent notes" into something teams can maintain responsibly.

**Restraint:** Prefer diagnosis and visibility before automation. Automated repair should come later, after the product can clearly explain what is wrong.

### Ingestion as a disciplined workflow
**Idea:** Support repeatable ways to bring in notes, transcripts, docs, and app events without pretending every raw input deserves to become memory.

**Why it matters:** MemexAI's core thesis is selective durable memory. Better ingestion should strengthen that thesis by helping agents decide what is stable, source-backed, and worth remembering.

**Restraint:** Do not become a generic data pipeline. The important product question is "what should be remembered?", not "how many connectors can we ship?"

### Evaluation before expansion
**Idea:** Build small eval loops around the memory behaviors that matter: remembering the right facts, finding them later, preserving citations/context, and avoiding junk accumulation.

**Why it matters:** Without evals, a memory product can look better while quietly getting less trustworthy. Evals create a way to say no to features that add complexity without improving outcomes.

**Restraint:** Start with focused, product-shaped evals rather than benchmark theater. The point is better decisions, not impressive numbers.

### Admin as a trust surface
**Idea:** Keep investing in the admin UI as the place where humans inspect, correct, and understand memory.

**Why it matters:** MemexAI is differentiated by making memory visible. The admin UI should make that promise tangible: what was remembered, why, by whom, when, and how it changed.

**Restraint:** The admin should stay operational and calm. It should not become a dashboard full of decorative metrics that do not change user behavior.

---

## URL Scheme

| URL | View |
|---|---|
| `/admin/playground` | Quick Test (default) |
| `/admin/playground?view=raw` | Raw Tools, no tool selected |
| `/admin/playground?view=raw&tool=memory_write` | Raw Tools, tool pre-selected |

---

## Files

### New files
| File | Status | Purpose |
|---|---|---|
| `admin/src/components/tool-utils.ts` | ✅ Done | Pure helpers + types extracted from ToolPlayground |
| `admin/src/components/CopyCodeButton.tsx` | ✅ Done | JS / Python inline snippet with copy |
| `admin/src/components/QuickTestView.tsx` | ✅ Done | Two-card layout (Memorize + Search) |
| `admin/src/components/RawToolsView.tsx` | ✅ Done | Sidebar + form + response (existing layout) |

### Modified files
| File | Status | Change |
|---|---|---|
| `admin/src/components/ToolPlayground.tsx` | ✅ Done | Thin router: fetches tools + userId, renders Quick or Raw view |

---

## What's been built

### `tool-utils.ts` ✅
Exports all pure helpers from the old monolithic ToolPlayground:
- Types: `ArgMode`, `Prefs`, `PropSchema`, `ToolDef`, `RunResult`, `FieldKind`
- Constants: `PREFS_STORAGE`, `TOOL_SCAFFOLDS`
- Functions: `loadPrefs`, `savePrefs`, `scaffoldToJson`, `detectKind`, `formToArgs`, `jsonToForm`

### `CopyCodeButton.tsx` ✅
Props: `{ toolName, args, userId }`

Renders `[ JavaScript ]` `[ Python ]` buttons. Clicking a language toggles an inline `Code` block showing the full snippet (built with `window.location.origin` as base URL so it's always correct). A `[ Copy ]` button inside flips to `Copied ✓` for 1.5s. Clicking the active language again collapses the block.

---

## What remains

### `QuickTestView.tsx`
- `SimpleGrid cols={2}` with two `Paper` cards
- **MemorizeCard**: `Textarea` for `text`, `Switch` for `dryRun`, `[ Memorize ]` button, inline result + `CopyCodeButton`
- **SearchCard**: `TextInput` for `query`, `[ Search ]` button, inline result + `CopyCodeButton`
- User strip at top (max-width 400px), datalist autocomplete
- Raw Tools footer: `▸ Raw Tools · memory_list · memory_read · memory_write · memory_patch` — clicking sets `?view=raw`
- Keyboard: `⌘↵` submits Memorize, `Enter` submits Search

### `RawToolsView.tsx`
- Top bar: `✦ Memorize · ⌕ Search ↑ Quick Test` link (clears `?view` and `?tool`) + User selector right-aligned
- Three columns: sidebar (220px) | form panel (flex-1) | response panel (flex-1)
- Sidebar: same tool list buttons as today
- Form panel: tool name, `▶ Send`, Form/JSON toggle (`SegmentedControl`), `SchemaFormFields` (defined locally, not exported)
- Response panel: status badge, latency, JSON body, `CopyCodeButton`
- `argMode` loaded from / saved to `localStorage` prefs
- `SchemaFormFields` and `mdComponents` stay internal (only used here)

### `ToolPlayground.tsx` (rewrite)
Thin router — owns:
- `tools: ToolDef[]` fetch from `GET /v1/tools` (calls `onApiKeyInvalid` on 401/403)
- `userId` state + localStorage persistence via `loadPrefs` / `savePrefs`
- `toolsError: string | null`
- Reads `?view` from `useSearchParams`
- Renders `<RawToolsView>` when `view === "raw"`, otherwise `<QuickTestView>`
- Removes all form/execution/sidebar state (moved to the two views)

---

## State ownership after refactor

```
ToolPlayground
  ├── tools[]           fetched once, passed to RawToolsView only
  ├── userId            localStorage, passed + onUserIdChange to both views
  ├── toolsError        passed to RawToolsView
  └── ?view (URL)
        ├── QuickTestView
        │     ├── memorize: { text, dryRun, loading, result }   local
        │     └── search:   { query, loading, result }           local
        └── RawToolsView
              ├── ?tool (URL, managed here)
              ├── argMode, formValues, argsJson                   local
              └── result, loading, argsError                      local
```

---

## No new dependencies
All covered by existing stack: Mantine 9, React Router 7 (`useSearchParams`), `navigator.clipboard` (browser built-in).

---

## Verification checklist (when implementation resumes)
1. `bun run dev:admin` → `/admin/playground` shows two-card layout
2. Memorize: paste text → click → response inline, JS/Python snippet expands
3. Search: type query → Enter → inline response + snippet
4. `▸ Raw Tools` → URL becomes `?view=raw`, three-column layout
5. Select tool → URL becomes `?view=raw&tool=memory_write`
6. `✦ Memorize · ⌕ Search ↑` → returns to `/admin/playground`
7. Deep-link: `?view=raw&tool=memory_patch` → correct tool pre-selected
8. userId change persists across view switches (localStorage)
9. `bun run build` → TypeScript clean
