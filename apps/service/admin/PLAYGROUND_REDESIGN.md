# Playground Redesign — Plan & Progress

## Goal
Split `/admin/playground` into two persona-aware views:
- **Quick Test** (default) — two cards: Memorize + Search, zero sidebar noise
- **Raw Tools** — existing sidebar+form+response layout, accessed via `?view=raw`

Add **Copy as JS / Python** inline snippet to both views.

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
