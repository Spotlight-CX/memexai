export const DREAM_EXCLUDED_PATHS = [
  "user/log.md",
  "user/dream-log.md",
]

export function isDreamExcludedPath(path: string): boolean {
  return DREAM_EXCLUDED_PATHS.includes(path) || path.endsWith("-log.md") || path.endsWith(".log")
}
