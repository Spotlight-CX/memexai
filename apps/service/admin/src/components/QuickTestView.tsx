import {
  Badge,
  Box,
  Button,
  Collapse,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core"
import { type ReactNode, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useRunToolMutation } from "../playground-api"
import { CopyCodeButton } from "./CopyCodeButton"
import { ResponseBody } from "./ResponseBody"
import { UserSelector } from "./UserSelector"
import type { RunResult } from "./tool-utils"

type QuickTestViewProps = {
  apiKey: string
  secret: string
  userId: string
  onUserIdChange: (userId: string) => void
}

const MEMORIZE_STEPS = [
  "Loading file list",
  "Reading index files",
  "Planning memory updates",
  "Writing memory",
  "Finalizing",
]

const SEARCH_STEPS = [
  "Running keyword search",
  "Reading index files",
  "Resolving answer",
  "Reading memory files",
  "Finalizing",
]

export function QuickTestView({ apiKey, secret, userId, onUserIdChange }: QuickTestViewProps) {
  const [, setSearchParams] = useSearchParams()
  const [memorizeText, setMemorizeText] = useState("")
  const [dryRun, setDryRun] = useState(false)
  const [query, setQuery] = useState("")
  const memorizeMutation = useRunToolMutation({ apiKey })
  const searchMutation = useRunToolMutation({ apiKey })

  const effectiveUserId = userId.trim() || "demo_user"
  const memorizeArgs = dryRun ? { text: memorizeText, dryRun } : { text: memorizeText }
  const searchArgs = { query }

  function openAdvanced() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("view", "raw")
      next.delete("tool")
      return next
    })
  }

  function handleMemorize() {
    if (!apiKey || !memorizeText.trim()) return
    memorizeMutation.reset()
    memorizeMutation.mutate({
      toolName: "memory_memorize",
      userId: effectiveUserId,
      args: memorizeArgs,
    })
  }

  function handleSearch() {
    if (!apiKey || !query.trim()) return
    searchMutation.reset()
    searchMutation.mutate({
      toolName: "memory_search",
      userId: effectiveUserId,
      args: searchArgs,
    })
  }

  return (
    <Box style={{ height: "100%", overflow: "auto", background: "var(--mantine-color-gray-0)" }} p="lg">
      <Stack gap="lg" maw={1220} mx="auto">
        <Group justify="space-between" align="flex-end" gap="lg">
          <Box>
            <Text size="xl" fw={700}>Playground</Text>
            <Text size="sm" c="dimmed" mt={2}>
              Validate memory behavior for a user before wiring it into your app.
            </Text>
          </Box>
          <Button size="sm" variant="light" onClick={openAdvanced}>
            Advanced
          </Button>
        </Group>

        <Box maw={620}>
          <UserSelector secret={secret} value={userId} onChange={onUserIdChange} />
        </Box>

        {!apiKey && (
          <Paper withBorder radius={8} p="sm" bg="white">
            <Text size="sm" c="dimmed">Enter your API key to run playground requests.</Text>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <QuickToolCard
            title="Add memory"
            description="Store durable facts for the selected user."
            toolName="memory_memorize"
            control={(
              <Switch
                label="Dry run"
                checked={dryRun}
                onChange={(e) => setDryRun(e.currentTarget.checked)}
                size="sm"
              />
            )}
            input={(
              <Textarea
                value={memorizeText}
                onChange={(e) => setMemorizeText(e.currentTarget.value)}
                placeholder="Remember that I prefer quiet neighborhoods near parks."
                minRows={8}
                autosize
                maxRows={14}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    handleMemorize()
                  }
                }}
              />
            )}
            shortcut="Ctrl/Command + Enter"
            actionLabel="Add memory"
            onRun={handleMemorize}
            disabled={!apiKey || !memorizeText.trim()}
            loading={memorizeMutation.isPending}
            result={memorizeMutation.data ?? null}
            steps={MEMORIZE_STEPS}
            responseEmpty="No response yet. Run this tool to inspect writes, matches, and metadata."
            sdkArgs={memorizeArgs}
            userId={effectiveUserId}
          />

          <QuickToolCard
            title="Search memory"
            description="Ask questions against that user's memory."
            toolName="memory_search"
            input={(
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                placeholder="quiet neighborhoods"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
              />
            )}
            shortcut="Enter"
            actionLabel="Search memory"
            onRun={handleSearch}
            disabled={!apiKey || !query.trim()}
            loading={searchMutation.isPending}
            result={searchMutation.data ?? null}
            steps={SEARCH_STEPS}
            responseEmpty="No response yet. Run this tool to inspect matches, context, and metadata."
            sdkArgs={searchArgs}
            userId={effectiveUserId}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  )
}

function QuickToolCard({
  title,
  description,
  toolName,
  control,
  input,
  shortcut,
  actionLabel,
  onRun,
  disabled,
  loading,
  result,
  steps,
  responseEmpty,
  sdkArgs,
  userId,
}: {
  title: string
  description: string
  toolName: string
  control?: ReactNode
  input: ReactNode
  shortcut: string
  actionLabel: string
  onRun: () => void
  disabled: boolean
  loading: boolean
  result: RunResult | null
  steps: string[]
  responseEmpty: string
  sdkArgs: Record<string, unknown>
  userId: string
}) {
  return (
    <Paper withBorder radius={8} p="lg" bg="white" style={{ minHeight: 620 }}>
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={700} size="lg">{title}</Text>
            <Text size="sm" c="dimmed">{description}</Text>
          </Box>
          {control}
        </Group>

        <Group justify="space-between" align="center">
          <Badge variant="light" color="gray" ff="monospace">{toolName}</Badge>
        </Group>

        <Divider />

        {input}

        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">{shortcut}</Text>
          <Button onClick={onRun} loading={loading} disabled={disabled}>
            {actionLabel}
          </Button>
        </Group>

        <ToolActivity steps={steps} active={loading} completed={Boolean(result) && !loading} />

        <Box>
          <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: "uppercase" }}>Response</Text>
          <Paper withBorder radius={8} p="md" bg={result ? "white" : "gray.0"} mih={150}>
            <ResultBlock result={result} loading={loading} empty={responseEmpty} />
          </Paper>
        </Box>

        <Box mt="auto">
          <SdkExampleSection toolName={toolName} args={sdkArgs} userId={userId} />
        </Box>
      </Stack>
    </Paper>
  )
}

function ResultBlock({ result, loading, empty }: { result: RunResult | null; loading: boolean; empty: string }) {
  if (!result) {
    return <Text size="sm" c="dimmed">{loading ? "Running..." : empty}</Text>
  }

  return (
    <Stack gap="xs">
      <Group gap="sm">
        <Badge color={result.status >= 200 && result.status < 300 ? "green" : "red"} variant="light">
          {result.status === 0 ? "ERR" : result.status}
        </Badge>
        <Text size="xs" c="dimmed">{result.latency}ms</Text>
      </Group>
      <ResponseBody body={result.body} />
    </Stack>
  )
}

function ToolActivity({ steps, active, completed }: { steps: string[]; active: boolean; completed: boolean }) {
  const visible = active || completed
  return (
    <Box>
      <Text size="xs" fw={700} c="dimmed" mb="xs" style={{ textTransform: "uppercase" }}>Activity</Text>
      <Paper withBorder radius={8} p="sm" bg="gray.0">
        {!visible ? (
          <Text size="sm" c="dimmed">Activity appears here while the tool runs.</Text>
        ) : (
          <Stack gap={6}>
            {steps.map((step, index) => {
              const isCurrent = active && index === Math.min(2, steps.length - 1)
              const isDone = completed || (active && index < 2)
              return (
                <Group key={step} gap="xs" wrap="nowrap">
                  <Text size="xs" c={isDone ? "green.7" : isCurrent ? "blue.6" : "dimmed"} w={42}>
                    {isDone ? "Done" : isCurrent ? "..." : "--"}
                  </Text>
                  <Text
                    size="sm"
                    c={isDone ? "gray.7" : isCurrent ? "blue.7" : "dimmed"}
                    className={isCurrent ? "memexai-wave-text" : undefined}
                  >
                    {step}
                  </Text>
                </Group>
              )
            })}
          </Stack>
        )}
      </Paper>
      <style>{`
        .memexai-wave-text {
          animation: memexaiWave 1.25s ease-in-out infinite;
        }
        @keyframes memexaiWave {
          0%, 100% { opacity: 0.45; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-1px); }
        }
      `}</style>
    </Box>
  )
}

function SdkExampleSection({ toolName, args, userId }: { toolName: string; args: unknown; userId: string }) {
  const [opened, setOpened] = useState(false)
  return (
    <Box pt="xs">
      <Button
        variant="transparent"
        color="gray"
        size="xs"
        onClick={() => setOpened((next) => !next)}
        px={0}
        rightSection={<Text span size="sm" style={{ transform: opened ? "rotate(90deg)" : undefined }}>{">"}</Text>}
      >
        Usage example
      </Button>
      <Collapse in={opened}>
        <CopyCodeButton toolName={toolName} args={args} userId={userId} />
      </Collapse>
    </Box>
  )
}
