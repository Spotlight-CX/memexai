import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useAdminData } from "../hooks"
import type { AdminUser } from "../types"

const PREFS_STORAGE = "memexai.playgroundPrefs"

type ArgMode = "form" | "json"
type Prefs = { argMode: ArgMode; userId?: string }

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

// ─── Scaffolds ────────────────────────────────────────────────────────────────

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
    return <Text size="sm" c="dimmed">This tool takes no arguments.</Text>
  }

  return (
    <Stack gap="md">
      {entries.map(([name, prop]) => {
        const isRequired = required.includes(name)
        const kind = detectKind(name, prop)
        const value = values[name] ?? ""
        const label = (
          <Group gap={4} mb={2}>
            <Text size="xs" fw={600} style={{ fontFamily: "monospace" }}>{name}</Text>
            {isRequired
              ? <Badge size="xs" color="red" variant="dot">required</Badge>
              : <Badge size="xs" color="gray" variant="dot">optional</Badge>}
          </Group>
        )

        if (kind === "select") {
          return (
            <Box key={name}>
              {label}
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
              {label}
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
              {label}
              <Group gap="sm" align="center">
                <Switch
                  checked={value === "true"}
                  onChange={(e) => onChange(name, String(e.currentTarget.checked))}
                  size="sm"
                />
                {prop.description && <Text size="xs" c="dimmed">{prop.description}</Text>}
              </Group>
            </Box>
          )
        }
        if (kind === "array") {
          return (
            <Box key={name}>
              {label}
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
              {label}
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
              {label}
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
        return (
          <Box key={name}>
            {label}
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
      try { out[name] = JSON.parse(raw) } catch { out[name] = raw }
    } else {
      if (raw !== "" || isRequired) out[name] = raw
    }
  }
  return out
}

// ─── JSON → form values ───────────────────────────────────────────────────────

function jsonToForm(json: string, properties: Record<string, PropSchema>): Record<string, string> {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>
    const form: Record<string, string> = {}
    for (const [name, prop] of Object.entries(properties)) {
      const val = parsed[name]
      if (val === undefined) continue
      const kind = detectKind(name, prop)
      if (kind === "array" && Array.isArray(val)) form[name] = val.join("\n")
      else if (kind === "boolean") form[name] = String(val)
      else if (kind === "number") form[name] = String(val)
      else if (kind === "json") form[name] = JSON.stringify(val, null, 2)
      else form[name] = String(val ?? "")
    }
    return form
  } catch {
    return {}
  }
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h3: ({ children }) => (
    <Text fw={600} size="sm" mt="md" mb={4}>{children}</Text>
  ),
  p: ({ children }) => (
    <Text size="sm" c="dark.6" mb="xs" style={{ lineHeight: 1.6 }}>{children}</Text>
  ),
  table: ({ children }) => (
    <Box component="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, marginBottom: 12 }}>
      {children}
    </Box>
  ),
  th: ({ children }) => (
    <Box component="th" style={{ textAlign: "left", padding: "4px 8px", background: "var(--mantine-color-gray-1)", borderBottom: "1px solid var(--mantine-color-gray-3)", fontWeight: 600, fontSize: 11 }}>
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box component="td" style={{ padding: "4px 8px", borderBottom: "1px solid var(--mantine-color-gray-2)", verticalAlign: "top", fontFamily: "monospace", fontSize: 12 }}>
      {children}
    </Box>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-")
    return isBlock
      ? <Code block style={{ fontSize: 12, marginBottom: 12 }}>{children}</Code>
      : <Code style={{ fontSize: 12 }}>{children}</Code>
  },
  hr: () => (
    <Box style={{ borderTop: "1px solid var(--mantine-color-gray-2)", margin: "12px 0" }} />
  ),
  li: ({ children }) => (
    <Text component="li" size="sm" c="dark.6" mb={2}>{children}</Text>
  ),
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ToolPlayground({ apiKey, secret, onApiKeyInvalid }: { apiKey: string; secret: string; onApiKeyInvalid: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTool = searchParams.get("tool") ?? ""
  const [tools, setTools] = useState<ToolDef[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [argMode, setArgMode] = useState<ArgMode>(() => loadPrefs().argMode ?? "form")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [argsJson, setArgsJson] = useState<string>("{}")
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [argsError, setArgsError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>(() => loadPrefs().userId ?? "")
  const { data: usersData } = useAdminData<{ users: AdminUser[] }>(secret ? "/v1/admin/users" : null, secret)
  const userOptions = (usersData?.users ?? []).map((u) => u.userId)

  useEffect(() => {
    if (!apiKey) { setTools([]); setToolsError(null); return }
    let cancelled = false
    fetch("/v1/tools", { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { onApiKeyInvalid(); return [] }
        const body = await r.json()
        if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`)
        return body.tools as ToolDef[]
      })
      .then((t) => {
        if (!cancelled) {
          setTools(t)
          setToolsError(null)
          if (t.length && !searchParams.get("tool")) doSelectTool(t[0].name)
        }
      })
      .catch((e) => {
        if (!cancelled) setToolsError(e instanceof Error ? e.message : "Failed to load tools")
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  function doSelectTool(name: string) {
    const scaffold = TOOL_SCAFFOLDS[name] ?? {}
    setSearchParams((prev) => { prev.set("tool", name); return prev })
    setFormValues(scaffold)
    setArgsJson(scaffoldToJson(name))
    setResult(null)
    setArgsError(null)
  }

  function handleArgModeChange(mode: ArgMode) {
    if (mode === argMode) return
    const toolDef = tools.find((t) => t.name === selectedTool)
    const props = toolDef?.inputSchema?.properties ?? {}
    const req = toolDef?.inputSchema?.required ?? []
    if (mode === "json") {
      setArgsJson(JSON.stringify(formToArgs(formValues, props, req), null, 2))
    } else {
      setFormValues(jsonToForm(argsJson, props))
    }
    setArgMode(mode)
    savePrefs({ argMode: mode, userId })
  }

  async function handleRun() {
    const toolDef = tools.find((t) => t.name === selectedTool)
    const props = toolDef?.inputSchema?.properties ?? {}
    const req = toolDef?.inputSchema?.required ?? []
    let args: unknown
    if (argMode === "json") {
      try { args = JSON.parse(argsJson) } catch { setArgsError("Invalid JSON — fix before running"); return }
    } else {
      args = formToArgs(formValues, props, req)
    }
    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      const response = await fetch(`/v1/tools/${selectedTool}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ context: { userId: userId.trim() || "demo_user" }, arguments: args }),
      })
      const body = await response.json()
      setResult({ status: response.status, latency: Date.now() - start, body })
    } catch (e) {
      setResult({ status: 0, latency: Date.now() - start, body: { error: e instanceof Error ? e.message : "Network error" } })
    } finally {
      setLoading(false)
    }
  }

  const selectedToolDef = tools.find((t) => t.name === selectedTool)
  const schemaProps = selectedToolDef?.inputSchema?.properties ?? {}
  const requiredFields = selectedToolDef?.inputSchema?.required ?? []

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* User selector strip */}
      <Box px="sm" py={6} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}>
        <Group gap="xs" align="center" wrap="nowrap">
          <Text size="xs" fw={600} c="dimmed" style={{ whiteSpace: "nowrap" }}>User</Text>
          <TextInput
            size="xs"
            value={userId}
            onChange={(e) => {
              const next = e.currentTarget.value
              setUserId(next)
              savePrefs({ ...loadPrefs(), userId: next })
            }}
            placeholder="Enter or select a userId…"
            style={{ flex: 1, minWidth: 0 }}
            styles={{ input: { fontFamily: "monospace", fontSize: 11 } }}
            list="playground-user-options"
          />
          <datalist id="playground-user-options">
            {userOptions.map((u) => <option key={u} value={u} />)}
          </datalist>
        </Group>
      </Box>

      {/* Main: sidebar + content */}
      <Box style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {/* Tool sidebar */}
        <ScrollArea style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--mantine-color-gray-2)" }} py="xs">
          {!apiKey ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">Enter your API key to load tools.</Text>
          ) : tools.length === 0 && !toolsError ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">Loading…</Text>
          ) : (
            <Stack gap={0}>
              <Text size="10px" fw={700} c="dimmed" px="sm" pt="xs" pb={4} style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Tools
              </Text>
              {tools.map((tool) => (
                <UnstyledButton
                  key={tool.name}
                  onClick={() => doSelectTool(tool.name)}
                  px="sm"
                  py={7}
                  style={{
                    background: selectedTool === tool.name ? "var(--mantine-color-blue-0)" : "transparent",
                    borderLeft: selectedTool === tool.name ? "2px solid var(--mantine-color-blue-5)" : "2px solid transparent",
                  }}
                >
                  <Text size="xs" fw={selectedTool === tool.name ? 600 : 400} truncate style={{ fontFamily: "monospace" }}>
                    {tool.name}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {/* Content */}
        {!selectedTool ? (
          <Box p="xl" style={{ flex: 1 }}>
            <Text c="dimmed" size="sm">
              {apiKey ? "Select a tool from the left panel." : "Enter your API key above to get started."}
            </Text>
          </Box>
        ) : (
          <Box style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {/* Left: arguments + description */}
            <ScrollArea style={{ borderRight: "1px solid var(--mantine-color-gray-2)" }} p="lg">
              {/* Tool name + run button */}
              <Group justify="space-between" mb="md" align="center">
                <Text fw={700} size="sm" style={{ fontFamily: "monospace" }}>{selectedTool}</Text>
                <Button onClick={handleRun} loading={loading} disabled={!apiKey} size="xs">
                  ▶ Send
                </Button>
              </Group>

              {/* Arguments section */}
              <Box mb="lg">
                <Group justify="space-between" mb="md" align="center">
                  <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Arguments
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={argMode}
                    onChange={(v) => handleArgModeChange(v as ArgMode)}
                    data={[
                      { label: "Form", value: "form" },
                      { label: "JSON", value: "json" },
                    ]}
                  />
                </Group>

                {argMode === "form" ? (
                  <SchemaFormFields
                    properties={schemaProps}
                    required={requiredFields}
                    values={formValues}
                    onChange={(field, value) => setFormValues((prev) => ({ ...prev, [field]: value }))}
                  />
                ) : (
                  <Textarea
                    value={argsJson}
                    onChange={(e) => { setArgsJson(e.currentTarget.value); setArgsError(null) }}
                    error={argsError}
                    minRows={10}
                    autosize
                    maxRows={20}
                    styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun() }
                    }}
                  />
                )}

                <Text size="xs" c="dimmed" mt="md">⌘↵ to send</Text>
              </Box>

              {/* Description (from API) */}
              {selectedToolDef?.description && (
                <Box pt="lg" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                  <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                    {selectedToolDef.description}
                  </ReactMarkdown>
                </Box>
              )}
            </ScrollArea>

            {/* Right: response */}
            <Box style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: result ? undefined : "var(--mantine-color-gray-0)" }}>
              <Box px="lg" py="sm" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}>
                <Group gap="sm" align="center">
                  <Text size="sm" fw={600}>Response</Text>
                  {result && (
                    <>
                      <Badge color={result.status >= 200 && result.status < 300 ? "green" : "red"} variant="light" size="sm">
                        {result.status === 0 ? "ERR" : result.status}
                      </Badge>
                      <Text size="xs" c="dimmed">{result.latency}ms</Text>
                    </>
                  )}
                </Group>
              </Box>
              <ScrollArea style={{ flex: 1 }} p="lg">
                {result ? (
                  <Code block style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "transparent" }}>
                    {JSON.stringify(result.body, null, 2)}
                  </Code>
                ) : (
                  <Text size="sm" c="dimmed">{loading ? "Running…" : "Hit Send to see the response here."}</Text>
                )}
              </ScrollArea>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
