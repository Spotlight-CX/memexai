import {
  Anchor,
  Badge,
  Box,
  Group,
  Skeleton,
  Stack,
  Text,
} from "@mantine/core"
import { useFileContentQuery } from "../playground-api"
import { ResponseBody } from "./ResponseBody"
import type { RunResult } from "./tool-utils"

export type TimelineEntry = {
  id: string
  kind: "store" | "recall"
  input: string
  dryRun: boolean
  status: "pending" | "done" | "error"
  startedAt: number
  latency: number | null
  result: RunResult | null
  currentStep: number
  userId: string
}

export const MEMORIZE_STEPS = [
  "Loading file list",
  "Planning memory updates",
  "Writing memory",
  "Finalizing",
]

export const SEARCH_STEPS = [
  "Running keyword search",
  "Reading memory files",
  "Assembling answer",
]

function toPhysicalPath(virtualPath: string, userId: string): string {
  if (virtualPath.startsWith("user/")) return `users/${userId}/${virtualPath.slice(5)}`
  return virtualPath
}

function basename(p: string): string {
  return p.split("/").pop() ?? p
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null
}

function formatScore(value: number): string {
  if (Math.abs(value) >= 0.01) return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
  return value.toPrecision(3)
}

function reasonColor(reason: string | null): string {
  if (reason === "semantic") return "grape"
  if (reason === "hybrid") return "teal"
  return "blue"
}

export function EntryRow({
  entry,
  secret,
  onNavigateToFile,
}: {
  entry: TimelineEntry
  secret: string
  onNavigateToFile: (path: string) => void
}) {
  const steps = entry.kind === "store" ? MEMORIZE_STEPS : SEARCH_STEPS
  const time = new Date(entry.startedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  return (
    <Box
      py="md"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        borderBottom: "1px solid var(--mantine-color-gray-2)",
      }}
    >
      {/* Left: operation */}
      <Box pr="lg" style={{ minWidth: 0 }}>
        <Stack gap="sm">
          <Box>
            <Text size="xs" c="gray.5" mb={4}>
              {entry.kind === "store" ? "Store" : "Recall"} · {time}
              {entry.latency !== null && ` · ${entry.latency}ms`}
              {entry.kind === "store" && entry.status !== "pending" && ` · ${entry.dryRun ? "dry run" : "committed"}`}
            </Text>
            <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {entry.input}
            </Text>
          </Box>

          <Stack gap={4}>
            {steps.map((step, index) => {
              const isDone =
                entry.status === "done" ||
                entry.status === "error" ||
                index < entry.currentStep
              const isCurrent = entry.status === "pending" && index === entry.currentStep
              return (
                <Group key={step} gap="xs" wrap="nowrap">
                  <Text
                    size="xs"
                    c={isDone ? "green.7" : isCurrent ? "blue.6" : "dimmed"}
                    style={{ width: 14, flexShrink: 0 }}
                  >
                    {isDone ? "✓" : isCurrent ? "◌" : "–"}
                  </Text>
                  <Text
                    size="xs"
                    c={isDone ? "gray.7" : isCurrent ? "blue.7" : "dimmed"}
                    className={isCurrent ? "memexai-wave-text" : undefined}
                  >
                    {step}
                  </Text>
                </Group>
              )
            })}
          </Stack>

          {entry.status === "done" && entry.result && (
            <Box mt="xs">
              <ResponseBody body={entry.result.body} />
            </Box>
          )}
          {entry.status === "error" && (
            <Text size="xs" c="red.6">Request failed. Check your API key and service status.</Text>
          )}
        </Stack>
      </Box>

      {/* Right: file context */}
      <Box pl="lg" style={{ borderLeft: "1px solid var(--mantine-color-gray-2)", minWidth: 0 }}>
        <FileRightPanel entry={entry} secret={secret} onNavigateToFile={onNavigateToFile} />
      </Box>
    </Box>
  )
}

function FileRightPanel({
  entry,
  secret,
  onNavigateToFile,
}: {
  entry: TimelineEntry
  secret: string
  onNavigateToFile: (path: string) => void
}) {
  const label = entry.kind === "store" ? "Files touched" : "Sources"

  if (entry.status === "pending") {
    return (
      <Stack gap="xs">
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
        <Skeleton height={10} width="55%" />
        <Skeleton height={72} radius="sm" />
      </Stack>
    )
  }

  if (entry.status === "error" || !entry.result) return null

  const body = entry.result.body

  if (entry.kind === "store" && isObj(body)) {
    const writes = Array.isArray(body.writes) ? body.writes.filter(isObj) : []
    if (writes.length === 0) {
      return (
        <Stack gap="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
          <Text size="xs" c="dimmed">No writes.</Text>
        </Stack>
      )
    }
    return (
      <Stack gap="md">
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
        {writes.map((write, i) => {
          const path = typeof write.path === "string" ? write.path : null
          if (!path) return null
          return (
            <WriteFileCell
              key={`${path}-${i}`}
              path={path}
              physicalPath={toPhysicalPath(path, entry.userId)}
              write={write}
              isDryRun={entry.dryRun}
              secret={secret}
              onNavigate={() => onNavigateToFile(toPhysicalPath(path, entry.userId))}
            />
          )
        })}
      </Stack>
    )
  }

  if (entry.kind === "recall" && isObj(body)) {
    const results = Array.isArray(body.results) ? body.results.filter(isObj) : []
    const sources = Array.isArray(body.sources)
      ? body.sources.filter((s): s is string => typeof s === "string")
      : []
    const sourceSet = new Set(sources)

    const items =
      results.length > 0
        ? results
        : sources.map((s) => ({ path: s, snippet: null as string | null, sourceOnly: true }))

    if (items.length === 0) {
      return (
        <Stack gap="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
          <Text size="xs" c="dimmed">No memory files matched.</Text>
        </Stack>
      )
    }

    return (
      <Stack gap="md">
        <Stack gap={2}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {results.length > 0 ? "Retrieved candidates" : label}
          </Text>
          {results.length > 0 && (
            <Text size="xs" c="dimmed">
              Retrieval order before answer assembly. Green files were read by the resolver.
            </Text>
          )}
        </Stack>
        {items.map((item, i) => {
          const path = typeof item.path === "string" ? item.path : null
          const snippet = typeof item.snippet === "string" ? item.snippet : null
          if (!path) return null
          return (
            <RecallSourceCell
              key={`${path}-${i}`}
              path={path}
              snippet={snippet}
              result={item}
              wasRead={sourceSet.has(path) || item.sourceOnly === true}
              onNavigate={() => onNavigateToFile(toPhysicalPath(path, entry.userId))}
            />
          )
        })}
      </Stack>
    )
  }

  return null
}

function WriteFileCell({
  path,
  physicalPath,
  write,
  isDryRun,
  secret,
  onNavigate,
}: {
  path: string
  physicalPath: string
  write: Record<string, unknown>
  isDryRun: boolean
  secret: string
  onNavigate: () => void
}) {
  const { data, isLoading } = useFileContentQuery({
    secret,
    path: physicalPath,
    enabled: !isDryRun,
  })

  const args = isObj(write.args) ? write.args : {}
  const addedContent = typeof args.content === "string" ? args.content : null
  const addedLines = Array.isArray(args.lines)
    ? args.lines.filter((l): l is string => typeof l === "string")
    : []
  const operation = typeof args.operation === "string" ? args.operation : null

  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          <Text size="xs" ff="monospace" truncate fw={500}>{basename(path)}</Text>
          <Badge size="xs" color={isDryRun ? "yellow" : "green"} variant="light">
            {isDryRun ? "◌ dry run" : "✓ written"}
          </Badge>
        </Group>
        <Anchor component="button" size="xs" c="dimmed" onClick={onNavigate} style={{ flexShrink: 0 }}>
          ↗
        </Anchor>
      </Group>

      {operation && (
        <Text size="xs" c="dimmed" ff="monospace">{operation}</Text>
      )}

      <ContentBox>
        {isDryRun ? (
          addedContent ? (
            addedContent.split("\n").slice(0, 24).map((line, i) => (
              <Text key={i} size="xs" ff="monospace" c="green.7" style={{ whiteSpace: "pre" }}>
                + {line || " "}
              </Text>
            ))
          ) : addedLines.length > 0 ? (
            addedLines.map((line, i) => (
              <Text key={i} size="xs" ff="monospace" c="green.7" style={{ whiteSpace: "pre" }}>
                + {line}
              </Text>
            ))
          ) : (
            <Text size="xs" c="dimmed">No content preview available.</Text>
          )
        ) : isLoading ? (
          <Stack gap={4}>
            <Skeleton height={9} width="90%" />
            <Skeleton height={9} width="70%" />
            <Skeleton height={9} width="80%" />
          </Stack>
        ) : data?.content ? (
          data.content.split("\n").slice(0, 24).map((line, i) => (
            <Text key={i} size="xs" ff="monospace" c="gray.7" style={{ whiteSpace: "pre" }}>
              {line || " "}
            </Text>
          ))
        ) : (
          <Text size="xs" c="dimmed">Content unavailable.</Text>
        )}
      </ContentBox>
    </Stack>
  )
}

function RecallSourceCell({
  path,
  snippet,
  result,
  wasRead,
  onNavigate,
}: {
  path: string
  snippet: string | null
  result: Record<string, unknown>
  wasRead: boolean
  onNavigate: () => void
}) {
  const reason = asString(result.matchReason)
  const bm25Rank = asNumber(result.bm25Rank)
  const vectorRank = asNumber(result.vectorRank)
  const fusedScore = asNumber(result.rank)

  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" ff="monospace" truncate fw={500}>{basename(path)}</Text>
        <Anchor component="button" size="xs" c="dimmed" onClick={onNavigate} style={{ flexShrink: 0 }}>
          ↗
        </Anchor>
      </Group>
      <Group gap={4}>
        {wasRead && <Badge size="xs" color="green" variant="light">read</Badge>}
        {reason && <Badge size="xs" color={reasonColor(reason)} variant="light">{reason}</Badge>}
        {bm25Rank !== null && <Badge size="xs" color="blue" variant="light">BM25 #{bm25Rank}</Badge>}
        {vectorRank !== null && <Badge size="xs" color="grape" variant="light">vector #{vectorRank}</Badge>}
        {fusedScore !== null && <Badge size="xs" variant="light">retrieval {formatScore(fusedScore)}</Badge>}
      </Group>
      {snippet && (
        <ContentBox>
          <Text size="xs" ff="monospace" c="gray.7" style={{ whiteSpace: "pre-wrap" }}>
            {snippet}
          </Text>
        </ContentBox>
      )}
    </Stack>
  )
}

function ContentBox({ children }: { children: React.ReactNode }) {
  return (
    <Box
      style={{
        maxHeight: 160,
        overflow: "auto",
        background: "var(--mantine-color-gray-0)",
        border: "1px solid var(--mantine-color-gray-2)",
        borderRadius: 6,
        padding: "6px 8px",
      }}
    >
      {children}
    </Box>
  )
}
