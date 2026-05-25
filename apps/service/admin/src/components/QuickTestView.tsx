import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useFileContentQuery, useRunToolMutation } from "../playground-api"
import { ConfigureTab } from "./ConfigureTab"
import { ResponseBody } from "./ResponseBody"
import { UserSelector } from "./UserSelector"
import type { RunResult } from "./tool-utils"

type QuickTestViewProps = {
  apiKey: string
  secret: string
  userId: string
  onUserIdChange: (userId: string) => void
}

type TimelineEntry = {
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

const MEMORIZE_STEPS = [
  "Loading file list",
  "Planning memory updates",
  "Writing memory",
  "Finalizing",
]

const SEARCH_STEPS = [
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

export function QuickTestView({ apiKey, secret, userId, onUserIdChange }: QuickTestViewProps) {
  const [, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [scope, setScope] = useState<"user" | "system">("user")
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [mode, setMode] = useState<"store" | "recall">("store")
  const [inputText, setInputText] = useState("")
  const [dryRun, setDryRun] = useState(true)
  const viewportRef = useRef<HTMLDivElement>(null)
  const runMutation = useRunToolMutation({ apiKey })
  const effectiveUserId = userId.trim() || "demo_user"

  useEffect(() => {
    setTimeline([])
    setMode("store")
    setInputText("")
  }, [userId])

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" })
    }
  }, [timeline.length])

  function openAdvanced() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("view", "raw")
      next.delete("tool")
      return next
    })
  }

  async function handleSubmit() {
    if (!apiKey || !inputText.trim()) return

    const entryId = String(Date.now())
    const capturedDryRun = dryRun
    const capturedUserId = effectiveUserId
    const capturedInput = inputText
    const steps = mode === "store" ? MEMORIZE_STEPS : SEARCH_STEPS

    setTimeline((prev) => [
      ...prev,
      {
        id: entryId,
        kind: mode,
        input: capturedInput,
        dryRun: capturedDryRun,
        status: "pending",
        startedAt: Date.now(),
        latency: null,
        result: null,
        currentStep: 0,
        userId: capturedUserId,
      },
    ])
    setInputText("")

    const stepInterval = setInterval(() => {
      setTimeline((prev) =>
        prev.map((e) =>
          e.id === entryId && e.status === "pending"
            ? { ...e, currentStep: Math.min(e.currentStep + 1, steps.length - 2) }
            : e
        )
      )
    }, 700)

    try {
      const args =
        mode === "store"
          ? capturedDryRun
            ? { text: capturedInput, dryRun: true }
            : { text: capturedInput }
          : { query: capturedInput }

      const result = await runMutation.mutateAsync({
        toolName: mode === "store" ? "memory_memorize" : "memory_search",
        userId: capturedUserId,
        args,
      })

      clearInterval(stepInterval)
      setTimeline((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, status: "done", result, latency: result.latency, currentStep: steps.length - 1 }
            : e
        )
      )
    } catch {
      clearInterval(stepInterval)
      setTimeline((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, status: "error", latency: Date.now() - e.startedAt } : e
        )
      )
    }
  }

  const isPending = timeline.some((e) => e.status === "pending")

  return (
    <Stack gap={0} h="100%" style={{ overflow: "hidden" }}>
      {/* Header */}
      <Box px="lg" py="sm" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0, background: "white" }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <SegmentedControl
              value={scope}
              onChange={(v) => setScope(v as "user" | "system")}
              data={[
                { label: "User", value: "user" },
                { label: "System", value: "system" },
              ]}
              size="xs"
              style={{ flexShrink: 0 }}
            />
            {scope === "user" ? (
              <Box style={{ minWidth: 0, maxWidth: 300 }}>
                <UserSelector secret={secret} value={userId} onChange={onUserIdChange} compact />
              </Box>
            ) : (
              <Text size="xs" c="dimmed">reading / editing shared/ files</Text>
            )}
          </Group>
          <Group gap="sm" wrap="nowrap">
            {scope === "user" && timeline.length > 0 && (
              <Button variant="subtle" color="gray" size="xs" onClick={() => setTimeline([])}>
                Clear
              </Button>
            )}
            <Button variant="light" size="xs" onClick={openAdvanced}>
              Advanced
            </Button>
          </Group>
        </Group>
      </Box>

      {/* System scope: configure chat */}
      {scope === "system" && (
        <Box flex={1} style={{ minHeight: 0 }}>
          <ConfigureTab secret={secret} />
        </Box>
      )}

      {/* User scope: timeline */}
      {scope === "user" && (
        <>
          <ScrollArea flex={1} viewportRef={viewportRef} style={{ minHeight: 0 }}>
            <Box p="lg">
              {timeline.length === 0 ? (
                <Box py={64} style={{ textAlign: "center" }}>
                  <Text size="sm" c="dimmed">
                    Run a store or recall below to simulate how your agent handles this user's memory.
                  </Text>
                  {!apiKey && (
                    <Text size="xs" c="red.5" mt="xs">
                      Enter your API key in settings to run playground requests.
                    </Text>
                  )}
                </Box>
              ) : (
                <Stack gap={0}>
                  {timeline.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      secret={secret}
                      onNavigateToFile={(path) => navigate(`/files?path=${encodeURIComponent(path)}`)}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </ScrollArea>

          {/* Input bar */}
          <Box
            px="lg"
            py="sm"
            style={{
              borderTop: "1px solid var(--mantine-color-gray-2)",
              background: "white",
              flexShrink: 0,
            }}
          >
            <Stack gap="xs">
              <Group align="flex-start" gap="md" wrap="nowrap">
                <SegmentedControl
                  value={mode}
                  onChange={(v) => {
                    setMode(v as "store" | "recall")
                  }}
                  data={[
                    { label: "Store", value: "store" },
                    { label: "Recall", value: "recall" },
                  ]}
                  size="xs"
                  style={{ flexShrink: 0, marginTop: 4 }}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.currentTarget.value)}
                    placeholder={mode === "store" ? "Remember that I prefer quiet neighborhoods near parks." : "quiet neighborhoods"}
                    autosize
                    minRows={2}
                    maxRows={8}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault()
                        void handleSubmit()
                      } else if (mode === "recall" && e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        void handleSubmit()
                      }
                    }}
                  />
                </Box>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={!apiKey || !inputText.trim()}
                  loading={isPending}
                  size="sm"
                  style={{ flexShrink: 0, marginTop: 4 }}
                >
                  {mode === "store" ? "Store" : "Recall"}
                </Button>
              </Group>

              <Group justify="space-between" align="center">
                <Group gap="md" align="center">
                  {mode === "store" && (
                    <Switch
                      label="Dry run"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.currentTarget.checked)}
                      size="xs"
                    />
                  )}
                  {mode === "store" && !dryRun && (
                    <Text size="xs" c="yellow.7" fw={500}>
                      ⚠ Live mode — writes are real for {effectiveUserId}
                    </Text>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  {mode === "store" ? "⌘ + Enter" : "Enter"}
                </Text>
              </Group>
            </Stack>
          </Box>
        </>
      )}

      <style>{`
        .memexai-wave-text {
          animation: memexaiWave 1.25s ease-in-out infinite;
        }
        @keyframes memexaiWave {
          0%, 100% { opacity: 0.45; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-1px); }
        }
      `}</style>
    </Stack>
  )
}

function EntryRow({
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
          <Group gap="xs" wrap="nowrap">
            <Badge color={entry.kind === "store" ? "blue" : "violet"} variant="light" size="sm">
              {entry.kind === "store" ? "STORE" : "RECALL"}
            </Badge>
            {entry.kind === "store" && entry.status !== "pending" && (
              <Badge color={entry.dryRun ? "yellow" : "green"} variant="light" size="sm">
                {entry.dryRun ? "◌ dry run" : "✓ committed"}
              </Badge>
            )}
            <Text size="xs" c="dimmed">{time}</Text>
            {entry.latency !== null && (
              <Text size="xs" c="dimmed">{entry.latency}ms</Text>
            )}
          </Group>

          <Paper
            p="sm"
            radius="sm"
            style={{
              background: "var(--mantine-color-gray-0)",
              border: "1px solid var(--mantine-color-gray-2)",
            }}
          >
            <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {entry.input}
            </Text>
          </Paper>

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

    const items =
      results.length > 0
        ? results
        : sources.map((s) => ({ path: s, snippet: null as string | null }))

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
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">{label}</Text>
        {items.map((item, i) => {
          const path = typeof item.path === "string" ? item.path : null
          const snippet = typeof item.snippet === "string" ? item.snippet : null
          if (!path) return null
          return (
            <RecallSourceCell
              key={`${path}-${i}`}
              path={path}
              snippet={snippet}
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
  onNavigate,
}: {
  path: string
  snippet: string | null
  onNavigate: () => void
}) {
  return (
    <Stack gap={4}>
      <Group justify="space-between" gap="xs" wrap="nowrap">
        <Text size="xs" ff="monospace" truncate fw={500}>{basename(path)}</Text>
        <Anchor component="button" size="xs" c="dimmed" onClick={onNavigate} style={{ flexShrink: 0 }}>
          ↗
        </Anchor>
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
