export const PREFS_STORAGE = "memexai.playgroundPrefs"

export type ArgMode = "form" | "json"
export type Prefs = { argMode: ArgMode; userId?: string }

export function loadPrefs(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(PREFS_STORAGE) ?? "{}") as Prefs
  } catch {
    return { argMode: "form" }
  }
}

export function savePrefs(prefs: Prefs) {
  localStorage.setItem(PREFS_STORAGE, JSON.stringify(prefs))
}

export type PropSchema = {
  type?: string
  description?: string
  enum?: string[]
  items?: { type?: string }
  oneOf?: unknown[]
}

export type ToolDef = {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, PropSchema>
    required?: string[]
  }
}

export type RunResult = {
  status: number
  latency: number
  body: unknown
}

export const TOOL_SCAFFOLDS: Record<string, Record<string, string>> = {
  memory_list: {},
  memory_read: { path: "user/" },
  memory_write: { path: "user/note.md", content: "", reason: "" },
  memory_patch: { path: "user/log.md", operation: "append_lines", lines: "" },
  memory_search: { query: "" },
  memory_memorize: { text: "" },
  memory_smart_read: {},
}

export function scaffoldToJson(name: string): string {
  const s = TOOL_SCAFFOLDS[name]
  if (!s) return "{}"
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(s)) {
    if (v !== "") out[k] = v
  }
  return JSON.stringify(out, null, 2)
}

const TEXTAREA_FIELDS = new Set(["content", "text", "match", "replacement", "after_heading", "reason", "lines"])

export type FieldKind = "text" | "textarea" | "number" | "boolean" | "select" | "array" | "json"

export function detectKind(name: string, prop: PropSchema): FieldKind {
  if (prop.oneOf) return "json"
  if (prop.enum) return "select"
  if (prop.type === "number") return "number"
  if (prop.type === "boolean") return "boolean"
  if (prop.type === "array") return "array"
  if (prop.type === "string") return TEXTAREA_FIELDS.has(name) ? "textarea" : "text"
  return "text"
}

export function formToArgs(
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

export function jsonToForm(json: string, properties: Record<string, PropSchema>): Record<string, string> {
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
