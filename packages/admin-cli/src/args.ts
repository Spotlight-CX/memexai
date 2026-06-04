/**
 * Minimal argument parser — no external dependency.
 * Supports: --flag, --flag value, -f, -f value, positional args.
 */
export type ParsedArgs = {
  positional: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next
        i += 2
      } else {
        flags[key] = true
        i++
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith("-")) {
        flags[key] = next
        i += 2
      } else {
        flags[key] = true
        i++
      }
    } else {
      positional.push(arg)
      i++
    }
  }
  return { positional, flags }
}

export function flag(flags: ParsedArgs["flags"], ...names: string[]): string | undefined {
  for (const n of names) {
    const v = flags[n]
    if (typeof v === "string") return v
  }
  return undefined
}

export function boolFlag(flags: ParsedArgs["flags"], ...names: string[]): boolean {
  return names.some((n) => flags[n] === true || flags[n] === "true")
}

export function intFlag(flags: ParsedArgs["flags"], name: string, fallback?: number): number | undefined {
  const v = flags[name]
  if (typeof v === "string") {
    const n = parseInt(v, 10)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}
