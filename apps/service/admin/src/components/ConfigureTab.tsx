import {
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  UnstyledButton,
} from "@mantine/core"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useAdminData, adminQueryKey } from "../hooks"
import type { AdminFile } from "../types"
import { ChatContainer, ChatInputWrapper } from "./ChatLayout"

type ChatMessage = { role: "user" | "assistant"; content: string }
type ProposedChange = {
  path: string
  content: string
  currentContent: string | null
  isNew: boolean
}

function BeforeAfterView({ before, after }: { before: string | null; after: string }) {
  if (!before) {
    return (
      <Box
        p="sm"
        style={{
          background: "var(--mantine-color-green-0)",
          border: "1px solid var(--mantine-color-green-3)",
          borderRadius: 6,
          fontFamily: "monospace",
          fontSize: 11,
          whiteSpace: "pre-wrap",
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {after}
      </Box>
    )
  }
  return (
    <Group gap="sm" align="flex-start" grow>
      <Box style={{ minWidth: 0 }}>
        <Text size="xs" c="gray.5" mb={4}>Current</Text>
        <Box
          p="sm"
          style={{
            background: "var(--mantine-color-gray-0)",
            border: "1px solid var(--mantine-color-gray-3)",
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "pre-wrap",
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {before}
        </Box>
      </Box>
      <Box style={{ minWidth: 0 }}>
        <Text size="xs" c="gray.5" mb={4}>Proposed</Text>
        <Box
          p="sm"
          style={{
            background: "var(--mantine-color-green-0)",
            border: "1px solid var(--mantine-color-green-3)",
            borderRadius: 6,
            fontFamily: "monospace",
            fontSize: 11,
            whiteSpace: "pre-wrap",
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {after}
        </Box>
      </Box>
    </Group>
  )
}

function ChangeCard({
  change,
  onApply,
  onSkip,
}: {
  change: ProposedChange
  onApply: (change: ProposedChange) => Promise<void>
  onSkip: () => void
}) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (applied) {
    return (
      <Paper withBorder p="sm" radius="md" bg="green.0">
        <Group gap="xs">
          <Text size="xs" c="green.7" fw={500}>{change.path} — applied</Text>
        </Group>
      </Paper>
    )
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" style={{ minWidth: 0 }}>
            <Text size="sm" fw={600} ff="monospace" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {change.path}
            </Text>
            {change.isNew && <Badge size="xs" color="green">NEW</Badge>}
          </Group>
          <UnstyledButton onClick={() => setExpanded((e) => !e)}>
            <Text size="xs" c="gray.5">{expanded ? "hide" : "show"}</Text>
          </UnstyledButton>
        </Group>

        {expanded && (
          <BeforeAfterView before={change.currentContent} after={change.content} />
        )}

        {error && <Text size="xs" c="red">{error}</Text>}

        <Group gap="xs">
          <Button
            size="xs"
            loading={applying}
            onClick={async () => {
              setApplying(true)
              setError(null)
              try {
                await onApply(change)
                setApplied(true)
              } catch (err) {
                setError(err instanceof Error ? err.message : "Apply failed")
              } finally {
                setApplying(false)
              }
            }}
          >
            Apply
          </Button>
          <Button size="xs" variant="subtle" color="gray" onClick={onSkip}>
            Skip
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}

export function ConfigureTab({ secret, onBackToUser }: { secret: string; onBackToUser?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingChanges, setPendingChanges] = useState<Map<number, ProposedChange[]>>(new Map())
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [filesExpanded, setFilesExpanded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: filesData } = useAdminData<{ files: AdminFile[] }>(
    `/v1/admin/files?prefix=shared/`,
    secret,
  )
  const sharedFiles = (filesData?.files ?? []).filter((f) => !f.physicalPath.startsWith("shared/."))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, pendingChanges])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput("")
    setSendError(null)
    const userMsg: ChatMessage = { role: "user", content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setSending(true)

    try {
      const res = await fetch("/v1/admin/configure-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-memex-admin-secret": secret },
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message ?? "Request failed")

      const assistantMsg: ChatMessage = { role: "assistant", content: body.reply }
      const withAssistant = [...nextMessages, assistantMsg]
      setMessages(withAssistant)

      if (body.proposedChanges?.length) {
        setPendingChanges((prev) => {
          const next = new Map(prev)
          next.set(withAssistant.length - 1, body.proposedChanges)
          return next
        })
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Request failed")
      setMessages(nextMessages.slice(0, -1))
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const applyChange = async (change: ProposedChange) => {
    const res = await fetch(`/v1/admin/files/${encodeURIComponent(change.path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-memex-admin-secret": secret },
      body: JSON.stringify({ content: change.content, reason: "Applied via configure chat" }),
    })
    if (!res.ok) {
      const body = await res.json()
      throw new Error(body?.error?.message ?? "Apply failed")
    }
    queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/files?prefix=shared/`) })
  }

  const skipChange = (msgIndex: number, path: string) => {
    setSkipped((prev) => new Set([...prev, `${msgIndex}:${path}`]))
  }

  const noModel = sendError?.includes("MODEL_NOT_CONFIGURED")

  return (
    <Box h="100%" display="flex" style={{ flexDirection: "column" }}>
      {/* Chat area */}
      <ScrollArea style={{ flex: 1 }} p="lg">
        <ChatContainer>
          {messages.length === 0 && !noModel && (
            <Box py={120} ta="center">
              <Text size="lg" fw={500} c="gray.7">Memory Configuration</Text>
              <Text size="sm" c="gray.5" mt={4}>
                Describe what you'd like to change or add to your agent's shared context.
              </Text>
            </Box>
          )}

          {noModel && (
            <Paper withBorder p="lg" radius="md" bg="yellow.0">
              <Stack gap="xs">
                <Text size="sm" fw={500}>LLM not configured</Text>
                <Text size="xs" c="gray.7">
                  Configure chat requires a language model. Set{" "}
                  <Text component="span" ff="monospace" size="xs">GEMINI_API_KEY</Text>,{" "}
                  <Text component="span" ff="monospace" size="xs">OPENAI_API_KEY</Text>, or{" "}
                  <Text component="span" ff="monospace" size="xs">OLLAMA_MODEL</Text> in your environment and restart the service.
                </Text>
              </Stack>
            </Paper>
          )}

          {messages.map((msg, idx) => (
            <Stack key={idx} gap="sm">
              <Box>
                <Text size="xs" c="gray.5" mb={4}>{msg.role === "user" ? "You" : "Assistant"}</Text>
                <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</Text>
              </Box>

              {msg.role === "assistant" && pendingChanges.has(idx) && (
                <Stack gap="sm">
                  {(pendingChanges.get(idx) ?? [])
                    .filter((c) => !skipped.has(`${idx}:${c.path}`))
                    .map((change) => (
                      <ChangeCard
                        key={change.path}
                        change={change}
                        onApply={applyChange}
                        onSkip={() => skipChange(idx, change.path)}
                      />
                    ))}
                </Stack>
              )}
            </Stack>
          ))}

          {sending && (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="xs" c="gray.5">Thinking...</Text>
            </Group>
          )}

          {sendError && !noModel && <Text size="xs" c="red">{sendError}</Text>}

          <div ref={bottomRef} />
        </ChatContainer>
      </ScrollArea>

      {/* Input Island */}
      <Box
        px="lg"
        pb="lg"
        pt="sm"
      >
        <ChatInputWrapper>
          <Stack gap="xs">
            {/* Context Line */}
            <Group justify="space-between" align="center" px={4}>
              <Group gap="xs">
                {onBackToUser && (
                  <UnstyledButton onClick={onBackToUser}>
                    <Badge size="xs" color="blue" variant="filled" style={{ cursor: "pointer" }}>System Scope</Badge>
                  </UnstyledButton>
                )}
                <UnstyledButton onClick={() => setFilesExpanded(!filesExpanded)}>
                  <Badge size="xs" color="gray" variant="outline" style={{ cursor: "pointer" }}>
                    {sharedFiles.length} shared files {filesExpanded ? "↑" : "↓"}
                  </Badge>
                </UnstyledButton>
              </Group>
              {messages.length > 0 && (
                <Button variant="subtle" color="gray" size="xs" onClick={() => setMessages([])}>
                  Clear
                </Button>
              )}
            </Group>

            {/* Shared files expanded context */}
            {filesExpanded && (
              <Paper withBorder p="xs" radius="md" bg="gray.0">
                <Group gap="xs" wrap="wrap">
                  {sharedFiles.length === 0 && <Text size="xs" c="gray.5">No shared files.</Text>}
                  {sharedFiles.map((f) => (
                    <Badge key={f.physicalPath} size="xs" variant="subtle" color="gray" ff="monospace" style={{ textTransform: "none" }}>
                      {f.physicalPath}
                    </Badge>
                  ))}
                </Group>
              </Paper>
            )}

            <Group gap="sm" align="flex-end">
              <Textarea
                style={{ flex: 1 }}
                styles={{
                  input: {
                    background: "transparent",
                    border: "none",
                    fontSize: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                  }
                }}
                placeholder={noModel ? "Configure an LLM to use this feature" : "Describe changes to shared context..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                minRows={2}
                maxRows={12}
                autosize
                disabled={noModel || sending}
              />
              <Button onClick={send} loading={sending} disabled={!input.trim() || noModel} size="md" style={{ height: 42 }}>
                Send
              </Button>
            </Group>
          </Stack>
        </ChatInputWrapper>
      </Box>
    </Box>
  )
}
