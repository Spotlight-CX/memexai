export type OutputMode = "table" | "json" | "raw"

export function getOutputMode(jsonFlag: boolean): OutputMode {
  if (jsonFlag) return "json"
  return "table"
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n")
}

export function printRaw(text: string): void {
  process.stdout.write(text)
  if (!text.endsWith("\n")) process.stdout.write("\n")
}

/**
 * Render a list of objects as a plain-text table.
 * Columns auto-sized to fit content. Falls back to JSON if no rows.
 */
export function printTable(
  rows: Record<string, unknown>[],
  columns?: string[],
  opts?: { maxColWidth?: number },
): void {
  if (rows.length === 0) {
    process.stdout.write("(no results)\n")
    return
  }
  const keys = columns ?? Object.keys(rows[0])
  const maxW = opts?.maxColWidth ?? 60

  const widths = keys.map((k) =>
    Math.min(maxW, Math.max(k.length, ...rows.map((r) => String(formatCell(r[k])).length))),
  )

  const sep = "  "
  const header = keys.map((k, i) => k.toUpperCase().padEnd(widths[i])).join(sep)
  const divider = widths.map((w) => "─".repeat(w)).join(sep)
  const lines = rows.map((r) =>
    keys.map((k, i) => truncate(String(formatCell(r[k])), widths[i]).padEnd(widths[i])).join(sep),
  )

  process.stdout.write([header, divider, ...lines].join("\n") + "\n")
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().replace("T", " ").slice(0, 19)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export function printError(message: string, code?: string): void {
  const prefix = code ? `[${code}] ` : ""
  process.stderr.write(`Error: ${prefix}${message}\n`)
}
