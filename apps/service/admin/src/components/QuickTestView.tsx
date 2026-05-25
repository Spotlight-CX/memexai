import {
  Badge,
  Box,
  Button,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  Textarea,
  UnstyledButton,
} from "@mantine/core"
import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useRunToolMutation } from "../playground-api"
import { ChatContainer, ChatInputWrapper } from "./ChatLayout"
import { ConfigureTab } from "./ConfigureTab"
import {
  EntryRow,
  MEMORIZE_STEPS,
  SEARCH_STEPS,
  type TimelineEntry,
} from "./PlaygroundTimeline"
import { UserSelector } from "./UserSelector"

type QuickTestViewProps = {
  apiKey: string
  secret: string
  userId: string
  onUserIdChange: (userId: string) => void
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
    <Stack gap={0} h="100%" style={{ overflow: "hidden", background: "transparent" }}>
      {/* Content Area */}
      <Box flex={1} style={{ minHeight: 0, position: "relative" }}>
        {scope === "system" ? (
          <Box h="100%">
            <ConfigureTab secret={secret} onBackToUser={() => setScope("user")} />
          </Box>
        ) : (
          <ScrollArea h="100%" viewportRef={viewportRef} p="lg">
            <ChatContainer maw={760}>
              {timeline.length === 0 ? (
                <Box py={120} style={{ textAlign: "center" }}>
                  <Text size="lg" fw={500} c="gray.7">MemexAI Playground</Text>
                  <Text size="sm" c="gray.5" mt={4}>
                    Interact with your agent's memory using Memorize or Search.
                  </Text>
                  <Button variant="subtle" size="xs" color="gray" mt="xl" onClick={openAdvanced}>
                    Advanced Tools
                  </Button>
                </Box>
              ) : (
                <Box pb={40}>
                  {timeline.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      secret={secret}
                      onNavigateToFile={(path) => navigate(`/files?path=${encodeURIComponent(path)}`)}
                    />
                  ))}
                </Box>
              )}
            </ChatContainer>
          </ScrollArea>
        )}
      </Box>

      {/* Action Island */}
      {scope === "user" && (
        <Box px="lg" pb="lg" pt="sm" style={{ flexShrink: 0 }}>
          <ChatInputWrapper maw={760}>
            <Stack gap="xs">
              {/* Context Row */}
              <Group justify="space-between" align="center" px={4}>
                <Group gap="xs">
                  <UnstyledButton onClick={() => setScope("system")}>
                    <Badge size="xs" color="gray" variant="outline" style={{ cursor: "pointer" }}>User Scope</Badge>
                  </UnstyledButton>
                  <Box style={{ minWidth: 140 }}>
                    <UserSelector secret={secret} value={userId} onChange={onUserIdChange} compact />
                  </Box>
                </Group>

                <Group gap="sm" align="center">
                  <SegmentedControl
                    value={mode}
                    onChange={(v) => setMode(v as "store" | "recall")}
                    data={[
                      { label: "Memorize", value: "store" },
                      { label: "Search", value: "recall" },
                    ]}
                    size="xs"
                    style={{ flexShrink: 0 }}
                  />
                  {mode === "store" && (
                    <Switch
                      label="Dry run"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.currentTarget.checked)}
                      size="xs"
                    />
                  )}
                  {timeline.length > 0 && (
                    <Button variant="subtle" color="gray" size="xs" onClick={() => setTimeline([])}>
                      Clear
                    </Button>
                  )}
                </Group>
              </Group>

              {/* Input Row */}
              <Group align="flex-end" gap="sm" wrap="nowrap">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.currentTarget.value)}
                    placeholder={mode === "store" ? "Remember that I prefer quiet neighborhoods near parks." : "Search memory..."}
                    autosize
                    minRows={2}
                    maxRows={12}
                    styles={{
                      input: {
                        background: "transparent",
                        border: "none",
                        fontSize: 14,
                        paddingTop: 10,
                        paddingBottom: 10,
                      }
                    }}
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
                  size="md"
                  style={{ flexShrink: 0, height: 42 }}
                >
                  Send
                </Button>
              </Group>
            </Stack>
          </ChatInputWrapper>
        </Box>
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
