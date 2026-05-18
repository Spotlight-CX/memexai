import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  NumberInput,
  PasswordInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core"
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"

const API_KEY_STORAGE = "memexai.apiKey"
const PREFS_STORAGE = "memexai.playgroundPrefs"
const DEMO_USER = "demo_user"

type ArgMode = "form" | "json"
type Prefs = { argMode: ArgMode }

function loadPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_STORAGE) ?? "{}") as Prefs
  } catch {
    return { argMode: "form" }
  }
}

function savePrefs(prefs: Prefs) {
  localStorage.setItem(PREFS_STORAGE, JSON.stringify(prefs))
}

type PropSchema = {
  type?: string
  description?: string
  enum?: string[]
  items?: { type?: string }
  oneOf?: unknown[]
}

type ToolDef = {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, PropSchema>
    required?: string[]
  }
}

type RunResult = {
  status: number
  latency: number
  body: unknown
}

// ─── Rich markdown docs per tool ─────────────────────────────────────────────

const TOOL_DOCS: Record<string, string> = {
  memory_list: `
List memory files visible to the current user.

Returns a flat list of virtual paths. Use \`prefix\` to scope the listing to a namespace — \`user/\` for files private to this user, \`shared/\` for globally readable files.

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`prefix\` | string | no | Virtual path prefix, e.g. \`user/\` or \`shared/\` |

---

### Example input

\`\`\`json
{ "prefix": "user/" }
\`\`\`

### Example output

\`\`\`json
{
  "files": [
    { "path": "user/profile.md", "size": 342, "updatedAt": "2025-01-15T10:23:00Z" },
    { "path": "user/notes.md",   "size": 128, "updatedAt": "2025-01-10T08:00:00Z" }
  ]
}
\`\`\`
`,

  memory_read: `
Read a single memory file by its virtual path.

Agents can read both \`user/**\` (private to the current user) and \`shared/**\` (global, read-only). Returns the raw file content as a string.

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`path\` | string | **yes** | Virtual file path, e.g. \`user/profile.md\` |

---

### Example input

\`\`\`json
{ "path": "user/profile.md" }
\`\`\`

### Example output

\`\`\`json
{
  "path": "user/profile.md",
  "content": "# Profile\\n- Prefers 2BHK apartments\\n- Budget: ₹80L–₹1Cr"
}
\`\`\`
`,

  memory_write: `
Create or fully overwrite a \`user/**\` memory file.

The entire file is replaced with \`content\`. Use \`memory_patch\` when you only need to change part of an existing file. Pass a \`reason\` to annotate the write — it's stored in the revision history for auditability.

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`path\` | string | **yes** | Writable virtual file path under \`user/**\` |
| \`content\` | string | **yes** | Complete replacement content |
| \`reason\` | string | no | Stored in revision history |

---

### Example input

\`\`\`json
{
  "path": "user/profile.md",
  "content": "# Profile\\n- Prefers 2BHK\\n- Budget: ₹80L",
  "reason": "Initial profile setup"
}
\`\`\`

### Example output

\`\`\`json
{ "ok": true, "path": "user/profile.md", "bytes": 48 }
\`\`\`
`,

  memory_patch: `
Patch a \`user/**\` memory file without rewriting it entirely.

Two operations are available:

- **\`append_lines\`** — insert lines immediately after a specific markdown heading
- **\`replace_lines\`** — find an exact text match and replace it with new content

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`path\` | string | **yes** | Writable virtual file path |
| \`operation\` | enum | **yes** | \`append_lines\` or \`replace_lines\` |
| \`after_heading\` | string | no | For \`append_lines\`: exact markdown heading to insert after |
| \`lines\` | string[] | no | For \`append_lines\`: lines to insert |
| \`match\` | string | no | For \`replace_lines\`: exact text to find |
| \`replacement\` | string \| string[] | no | For \`replace_lines\`: replacement content |
| \`reason\` | string | no | Stored in revision history |

---

### Example input (append_lines)

\`\`\`json
{
  "path": "user/notes.md",
  "operation": "append_lines",
  "after_heading": "## Preferences",
  "lines": ["- Likes rooftop gardens"],
  "reason": "New preference noted"
}
\`\`\`

### Example output

\`\`\`json
{ "ok": true, "linesChanged": 1 }
\`\`\`
`,

  memory_smart_read: `
Read all (or the most relevant) memory files within a character budget, returned as a single merged context block ready to inject into a system prompt.

Optionally pass a \`query\` to rank files by keyword relevance, ensuring the most useful content fits within \`maxChars\`.

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`maxChars\` | number | no | Maximum characters to return. Default: 24 000 |
| \`query\` | string | no | Keyword query to rank files by relevance |

---

### Example input

\`\`\`json
{ "maxChars": 4000, "query": "apartment preferences" }
\`\`\`

### Example output

\`\`\`json
{
  "content": "<memory>\\n<file path=\\"user/profile.md\\">\\n# Profile\\n- Prefers 2BHK\\n</file>\\n</memory>",
  "truncated": false,
  "filesRead": 2
}
\`\`\`
`,

  memory_memorize: `
Feed raw text (conversation snippets, notes, observations) and let MemexAI autonomously decide what to remember and where to store it.

MemexAI reads existing memory files, identifies durable facts, and writes or patches files — all with full audit trails. Use \`dryRun: true\` to preview planned writes without committing them.

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`text\` | string | **yes** | Raw text containing facts to remember |
| \`maxWrites\` | number | no | Max write/patch operations. Default: 5 |
| \`dryRun\` | boolean | no | Plan writes without committing |

---

### Example input

\`\`\`json
{
  "text": "User mentioned they prefer 2BHK, budget around ₹80L, and want a sea view.",
  "maxWrites": 3
}
\`\`\`

### Example output

\`\`\`json
{
  "writes": [
    { "path": "user/profile.md", "operation": "patch", "reason": "Added apartment preferences" }
  ],
  "dryRun": false
}
\`\`\`
`,

  memory_search: `
Search memory for a question using BM25 full-text search.

When an LLM is configured, agentic resolution reads the top BM25 candidates and synthesizes a grounded answer. Without an LLM, returns the raw matching file excerpts.

---

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`query\` | string | **yes** | Question or topic to search for |
| \`maxChars\` | number | no | Max characters to return. Default: 8 000 |
| \`limit\` | number | no | Max BM25 candidates. Default: 10 |
| \`maxReads\` | number | no | Max files the agentic resolver may inspect. Default: 5 |
| \`prefix\` | string | no | Optional virtual path prefix, e.g. \`user/\` |

---

### Example input

\`\`\`json
{
  "query": "What is the user's budget?",
  "maxChars": 2000
}
\`\`\`

### Example output

\`\`\`json
{
  "answer": "The user's budget is ₹80L–₹1Cr based on their profile notes.",
  "sources": ["user/profile.md"]
}
\`\`\`
`,
}

// ─── Scaffolds (initial form values when a tool is selected) ──────────────────

const TOOL_SCAFFOLDS: Record<string, Record<string, string>> = {
  memory_list: {},
  memory_read: { path: "user/" },
  memory_write: { path: "user/note.md", content: "", reason: "" },
  memory_patch: { path: "user/note.md", operation: "append_lines", after_heading: "", lines: "" },
  memory_search: { query: "" },
  memory_memorize: { text: "" },
  memory_smart_read: {},
}

function scaffoldToJson(name: string): string {
  const s = TOOL_SCAFFOLDS[name]
  if (!s) return "{}"
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s)) {
    if (v !== "") out[k] = v
  }
  return JSON.stringify(out, null, 2)
}

// ─── Field type detection ─────────────────────────────────────────────────────

const TEXTAREA_FIELDS = new Set(["content", "text", "match", "replacement", "after_heading", "reason", "lines"])

type FieldKind = "text" | "textarea" | "number" | "boolean" | "select" | "array" | "json"

function detectKind(name: string, prop: PropSchema): FieldKind {
  if (prop.oneOf) return "json"
  if (prop.enum) return "select"
  if (prop.type === "number") return "number"
  if (prop.type === "boolean") return "boolean"
  if (prop.type === "array") return "array"
  if (prop.type === "string") return TEXTAREA_FIELDS.has(name) ? "textarea" : "text"
  return "text"
}

// ─── SchemaFormFields ─────────────────────────────────────────────────────────

type SchemaFormFieldsProps = {
  properties: Record<string, PropSchema>
  required: string[]
  values: Record<string, string>
  onChange: (field: string, value: string) => void
}

function SchemaFormFields({ properties, required, values, onChange }: SchemaFormFieldsProps) {
  const entries = Object.entries(properties)
  if (entries.length === 0) {
    return (
      <Text size="sm" c="dimmed" pt="sm">
        This tool takes no arguments.
      </Text>
    )
  }

  return (
    <Stack gap="md">
      {entries.map(([name, prop]) => {
        const isRequired = required.includes(name)
        const kind = detectKind(name, prop)
        const value = values[name] ?? ""
        const labelNode = (
          <Group gap={4} mb={2}>
            <Text size="xs" fw={600} style={{ fontFamily: "monospace" }}>
              {name}
            </Text>
            {isRequired ? (
              <Badge size="xs" color="red" variant="dot">required</Badge>
            ) : (
              <Badge size="xs" color="gray" variant="dot">optional</Badge>
            )}
          </Group>
        )

        if (kind === "select") {
          return (
            <Box key={name}>
              {labelNode}
              <Select
                data={prop.enum ?? []}
                value={value || null}
                onChange={(v) => onChange(name, v ?? "")}
                description={prop.description}
                placeholder="Select…"
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }

        if (kind === "number") {
          return (
            <Box key={name}>
              {labelNode}
              <NumberInput
                value={value === "" ? "" : Number(value)}
                onChange={(v) => onChange(name, v === "" ? "" : String(v))}
                description={prop.description}
                placeholder="number"
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }

        if (kind === "boolean") {
          return (
            <Box key={name}>
              {labelNode}
              <Group gap="sm" align="center">
                <Switch
                  checked={value === "true"}
                  onChange={(e) => onChange(name, String(e.currentTarget.checked))}
                  size="sm"
                />
                {prop.description && (
                  <Text size="xs" c="dimmed">{prop.description}</Text>
                )}
              </Group>
            </Box>
          )
        }

        if (kind === "array") {
          return (
            <Box key={name}>
              {labelNode}
              <Textarea
                value={value}
                onChange={(e) => onChange(name, e.currentTarget.value)}
                description={(prop.description ? prop.description + " — " : "") + "one item per line"}
                placeholder={"item 1\nitem 2"}
                minRows={3}
                autosize
                maxRows={8}
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }

        if (kind === "json") {
          return (
            <Box key={name}>
              {labelNode}
              <Textarea
                value={value}
                onChange={(e) => onChange(name, e.currentTarget.value)}
                description={(prop.description ?? "") + " (JSON)"}
                placeholder='""'
                minRows={3}
                autosize
                maxRows={8}
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }

        if (kind === "textarea") {
          return (
            <Box key={name}>
              {labelNode}
              <Textarea
                value={value}
                onChange={(e) => onChange(name, e.currentTarget.value)}
                description={prop.description}
                minRows={name === "content" || name === "text" ? 6 : 3}
                autosize
                maxRows={12}
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }

        // default: TextInput
        return (
          <Box key={name}>
            {labelNode}
            <TextInput
              value={value}
              onChange={(e) => onChange(name, e.currentTarget.value)}
              description={prop.description}
              placeholder={name}
              size="sm"
              styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
            />
          </Box>
        )
      })}
    </Stack>
  )
}

// ─── Form values → typed args ─────────────────────────────────────────────────

function formToArgs(
  values: Record<string, string>,
  properties: Record<string, PropSchema>,
  required: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, prop] of Object.entries(properties)) {
    const raw = values[name] ?? ""
    const kind = detectKind(name, prop)
    const isRequired = required.includes(name)

    if (raw === "" && !isRequired) continue

    if (kind === "number") {
      const n = parseFloat(raw)
      if (!isNaN(n)) out[name] = n
    } else if (kind === "boolean") {
      out[name] = raw === "true"
    } else if (kind === "array") {
      out[name] = raw.split("\n").filter((l) => l.trim() !== "")
    } else if (kind === "json") {
      try {
        out[name] = JSON.parse(raw)
      } catch {
        out[name] = raw
      }
    } else {
      if (raw !== "" || isRequired) out[name] = raw
    }
  }
  return out
}

// ─── JSON → form values ───────────────────────────────────────────────────────

function jsonToForm(
  json: string,
  properties: Record<string, PropSchema>,
): Record<string, string> {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const form: Record<string, string> = {}
    for (const [name, prop] of Object.entries(properties)) {
      const val = parsed[name]
      if (val === undefined) continue
      const kind = detectKind(name, prop)
      if (kind === "array" && Array.isArray(val)) {
        form[name] = val.join("\n")
      } else if (kind === "boolean") {
        form[name] = String(val)
      } else if (kind === "number") {
        form[name] = String(val)
      } else if (kind === "json") {
        form[name] = JSON.stringify(val, null, 2)
      } else {
        form[name] = String(val ?? "")
      }
    }
    return form
  } catch {
    return {}
  }
}

// ─── Markdown styles ──────────────────────────────────────────────────────────

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h3: ({ children }) => (
    <Text fw={600} size="sm" mt="md" mb={4}>
      {children}
    </Text>
  ),
  p: ({ children }) => (
    <Text size="sm" c="dark.6" mb="xs">
      {children}
    </Text>
  ),
  table: ({ children }) => (
    <Box
      component="table"
      style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, marginBottom: 12 }}
    >
      {children}
    </Box>
  ),
  th: ({ children }) => (
    <Box
      component="th"
      style={{
        textAlign: "left",
        padding: "4px 8px",
        background: "var(--mantine-color-gray-1)",
        borderBottom: "1px solid var(--mantine-color-gray-3)",
        fontWeight: 600,
        fontSize: 11,
      }}
    >
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box
      component="td"
      style={{
        padding: "4px 8px",
        borderBottom: "1px solid var(--mantine-color-gray-2)",
        verticalAlign: "top",
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      {children}
    </Box>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-")
    if (isBlock) {
      return (
        <Code block style={{ fontSize: 12, marginBottom: 12 }}>
          {children}
        </Code>
      )
    }
    return (
      <Code style={{ fontSize: 12 }}>{children}</Code>
    )
  },
  hr: () => (
    <Box style={{ borderTop: "1px solid var(--mantine-color-gray-2)", margin: "12px 0" }} />
  ),
  li: ({ children }) => (
    <Text component="li" size="sm" c="dark.6" mb={2}>
      {children}
    </Text>
  ),
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ToolPlayground() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? "")
  const [tools, setTools] = useState<ToolDef[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<string>("")
  const [argMode, setArgMode] = useState<ArgMode>(() => loadPrefs().argMode ?? "form")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [argsJson, setArgsJson] = useState<string>("{}")
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [argsError, setArgsError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) {
      setTools([])
      setToolsError(null)
      return
    }
    let cancelled = false
    fetch("/v1/tools", { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`)
        return body.tools as ToolDef[]
      })
      .then((t) => {
        if (!cancelled) {
          setTools(t)
          setToolsError(null)
          if (t.length && !selectedTool) selectTool(t[0].name, t[0])
        }
      })
      .catch((e) => {
        if (!cancelled) setToolsError(e instanceof Error ? e.message : "Failed to load tools")
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  function selectTool(name: string, def?: ToolDef) {
    const scaffold = TOOL_SCAFFOLDS[name] ?? {}
    const json = scaffoldToJson(name)
    setSelectedTool(name)
    setFormValues(scaffold)
    setArgsJson(json)
    setResult(null)
    setArgsError(null)
    // If switching to JSON mode, populate from scaffold
    void def
  }

  function handleArgModeChange(mode: ArgMode) {
    if (mode === argMode) return
    const toolDef = tools.find((t) => t.name === selectedTool)
    const props = toolDef?.inputSchema?.properties ?? {}
    const req = toolDef?.inputSchema?.required ?? []

    if (mode === "json") {
      // Form → JSON
      const args = formToArgs(formValues, props, req)
      setArgsJson(JSON.stringify(args, null, 2))
    } else {
      // JSON → Form
      setFormValues(jsonToForm(argsJson, props))
    }
    setArgMode(mode)
    savePrefs({ argMode: mode })
  }

  async function handleRun() {
    const toolDef = tools.find((t) => t.name === selectedTool)
    const props = toolDef?.inputSchema?.properties ?? {}
    const req = toolDef?.inputSchema?.required ?? []

    let args: unknown
    if (argMode === "json") {
      try {
        args = JSON.parse(argsJson)
      } catch {
        setArgsError("Invalid JSON — fix before running")
        return
      }
    } else {
      args = formToArgs(formValues, props, req)
    }

    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      const response = await fetch(`/v1/tools/${selectedTool}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ context: { userId: DEMO_USER }, arguments: args }),
      })
      const body = await response.json()
      setResult({ status: response.status, latency: Date.now() - start, body })
    } catch (e) {
      setResult({
        status: 0,
        latency: Date.now() - start,
        body: { error: e instanceof Error ? e.message : "Network error" },
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedToolDef = tools.find((t) => t.name === selectedTool)
  const schemaProps = selectedToolDef?.inputSchema?.properties ?? {}
  const requiredFields = selectedToolDef?.inputSchema?.required ?? []

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* API Key strip */}
      <Box
        px="lg"
        py="sm"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}
      >
        <Group gap="lg" align="flex-end" wrap="nowrap">
          <PasswordInput
            label="API Key"
            value={apiKey}
            onChange={(e) => {
              const val = e.currentTarget.value
              setApiKey(val)
              localStorage.setItem(API_KEY_STORAGE, val)
              setSelectedTool("")
              setResult(null)
            }}
            placeholder="Bearer token for tool execution"
            style={{ width: 380 }}
            styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
          />
          <Text size="xs" c="dimmed" pb={6}>
            Saved locally · running as{" "}
            <Text span fw={600} c="gray.7">{DEMO_USER}</Text>
          </Text>
          {toolsError && (
            <Text size="xs" c="red" pb={6}>{toolsError}</Text>
          )}
        </Group>
      </Box>

      {/* Main two-column: sidebar + content */}
      <Box style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {/* Tool sidebar */}
        <ScrollArea
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid var(--mantine-color-gray-2)",
          }}
          py="xs"
        >
          {!apiKey ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">Enter your API key to load tools.</Text>
          ) : tools.length === 0 && !toolsError ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">Loading…</Text>
          ) : (
            <Stack gap={0}>
              <Text
                size="10px"
                fw={700}
                c="dimmed"
                px="sm"
                pt="xs"
                pb={4}
                style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
              >
                Tools
              </Text>
              {tools.map((tool) => (
                <UnstyledButton
                  key={tool.name}
                  onClick={() => selectTool(tool.name, tool)}
                  px="sm"
                  py={7}
                  style={{
                    background:
                      selectedTool === tool.name
                        ? "var(--mantine-color-blue-0)"
                        : "transparent",
                    borderLeft:
                      selectedTool === tool.name
                        ? "2px solid var(--mantine-color-blue-5)"
                        : "2px solid transparent",
                  }}
                >
                  <Text
                    size="xs"
                    fw={selectedTool === tool.name ? 600 : 400}
                    truncate
                    style={{ fontFamily: "monospace" }}
                  >
                    {tool.name}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {/* Content pane */}
        {!selectedTool ? (
          <Box p="xl" style={{ flex: 1 }}>
            <Text c="dimmed" size="sm">
              {apiKey ? "Select a tool from the left panel." : "Enter your API key above to get started."}
            </Text>
          </Box>
        ) : (
          <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* URL bar */}
            <Box
              px="lg"
              py="sm"
              style={{
                borderBottom: "1px solid var(--mantine-color-gray-2)",
                flexShrink: 0,
                background: "var(--mantine-color-gray-0)",
              }}
            >
              <Group gap="sm" wrap="nowrap">
                <Badge color="blue" variant="filled" size="sm" style={{ flexShrink: 0 }}>
                  POST
                </Badge>
                <Code
                  style={{
                    flex: 1,
                    fontSize: 12,
                    padding: "6px 10px",
                    background: "white",
                    border: "1px solid var(--mantine-color-gray-3)",
                    borderRadius: 6,
                  }}
                >
                  /v1/tools/{selectedTool}/execute
                </Code>
                <SegmentedControl
                  size="xs"
                  value={argMode}
                  onChange={(v) => handleArgModeChange(v as ArgMode)}
                  data={[
                    { label: "Form", value: "form" },
                    { label: "JSON", value: "json" },
                  ]}
                />
                <Button
                  onClick={handleRun}
                  loading={loading}
                  disabled={!apiKey}
                  size="sm"
                  style={{ flexShrink: 0 }}
                >
                  ▶ Send
                </Button>
              </Group>
            </Box>

            {/* Request / Response split */}
            <Box
              style={{
                flex: 1,
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              {/* Request pane */}
              <Box
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  borderRight: "1px solid var(--mantine-color-gray-2)",
                }}
              >
                <Tabs
                  defaultValue="args"
                  style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}
                >
                  <Tabs.List px="lg" style={{ flexShrink: 0 }}>
                    <Tabs.Tab value="args" style={{ fontSize: 13 }}>Arguments</Tabs.Tab>
                    <Tabs.Tab value="description" style={{ fontSize: 13 }}>Description</Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="args" style={{ flex: 1, overflow: "hidden" }}>
                    <ScrollArea style={{ height: "100%" }} p="lg">
                      {argMode === "form" ? (
                        <>
                          <SchemaFormFields
                            properties={schemaProps}
                            required={requiredFields}
                            values={formValues}
                            onChange={(field, value) =>
                              setFormValues((prev) => ({ ...prev, [field]: value }))
                            }
                          />
                          <Text size="xs" c="dimmed" mt="md">⌘↵ to send</Text>
                        </>
                      ) : (
                        <>
                          <Textarea
                            value={argsJson}
                            onChange={(e) => {
                              setArgsJson(e.currentTarget.value)
                              setArgsError(null)
                            }}
                            error={argsError}
                            minRows={10}
                            autosize
                            maxRows={20}
                            styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                            onKeyDown={(e) => {
                              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                e.preventDefault()
                                handleRun()
                              }
                            }}
                          />
                          <Text size="xs" c="dimmed" mt="sm">⌘↵ to send</Text>
                        </>
                      )}
                    </ScrollArea>
                  </Tabs.Panel>

                  <Tabs.Panel value="description" style={{ flex: 1, overflow: "hidden" }}>
                    <ScrollArea style={{ height: "100%" }} p="lg">
                      {TOOL_DOCS[selectedTool] ? (
                        <ReactMarkdown components={mdComponents}>
                          {TOOL_DOCS[selectedTool]}
                        </ReactMarkdown>
                      ) : (
                        <Text size="sm" c="dimmed">
                          {selectedToolDef?.description ?? "No description available."}
                        </Text>
                      )}
                    </ScrollArea>
                  </Tabs.Panel>
                </Tabs>
              </Box>

              {/* Response pane */}
              <Box
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: result ? undefined : "var(--mantine-color-gray-0)",
                }}
              >
                <Box
                  px="lg"
                  py="sm"
                  style={{
                    borderBottom: "1px solid var(--mantine-color-gray-2)",
                    flexShrink: 0,
                  }}
                >
                  <Group gap="sm" align="center">
                    <Text size="sm" fw={600}>Response</Text>
                    {result && (
                      <>
                        <Badge
                          color={result.status >= 200 && result.status < 300 ? "green" : "red"}
                          variant="light"
                          size="sm"
                        >
                          {result.status === 0 ? "ERR" : result.status}
                        </Badge>
                        <Text size="xs" c="dimmed">{result.latency}ms</Text>
                      </>
                    )}
                  </Group>
                </Box>

                <ScrollArea style={{ flex: 1 }} p="lg">
                  {result ? (
                    <Code
                      block
                      style={{
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        background: "transparent",
                      }}
                    >
                      {JSON.stringify(result.body, null, 2)}
                    </Code>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {loading ? "Running…" : "Hit Send to see the response here."}
                    </Text>
                  )}
                </ScrollArea>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
