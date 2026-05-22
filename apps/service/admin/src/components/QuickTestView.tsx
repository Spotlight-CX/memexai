import { Badge, Box, Button, Group, Paper, SimpleGrid, Stack, Switch, Text, TextInput, Textarea } from "@mantine/core"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { CopyCodeButton } from "./CopyCodeButton"
import { ResponseBody } from "./ResponseBody"
import type { RunResult } from "./tool-utils"

type QuickTestViewProps = {
  apiKey: string
  userId: string
  userOptions: string[]
  onUserIdChange: (userId: string) => void
}

function ResultBlock({ result, loading }: { result: RunResult | null; loading: boolean }) {
  if (!result) {
    return <Text size="sm" c="dimmed">{loading ? "Running..." : "Response appears here."}</Text>
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

async function runTool(apiKey: string, toolName: string, userId: string, args: Record<string, unknown>): Promise<RunResult> {
  const start = Date.now()
  try {
    const response = await fetch(`/v1/tools/${toolName}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ context: { userId: userId.trim() || "demo_user" }, arguments: args }),
    })
    const body = await response.json()
    return { status: response.status, latency: Date.now() - start, body }
  } catch (e) {
    return { status: 0, latency: Date.now() - start, body: { error: e instanceof Error ? e.message : "Network error" } }
  }
}

export function QuickTestView({ apiKey, userId, userOptions, onUserIdChange }: QuickTestViewProps) {
  const [, setSearchParams] = useSearchParams()
  const [memorizeText, setMemorizeText] = useState("")
  const [dryRun, setDryRun] = useState(false)
  const [memorizeLoading, setMemorizeLoading] = useState(false)
  const [memorizeResult, setMemorizeResult] = useState<RunResult | null>(null)
  const [query, setQuery] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResult, setSearchResult] = useState<RunResult | null>(null)

  const effectiveUserId = userId.trim() || "demo_user"
  const memorizeArgs = dryRun ? { text: memorizeText, dryRun } : { text: memorizeText }
  const searchArgs = { query }

  async function handleMemorize() {
    if (!apiKey || !memorizeText.trim()) return
    setMemorizeLoading(true)
    setMemorizeResult(null)
    setMemorizeResult(await runTool(apiKey, "memory_memorize", effectiveUserId, memorizeArgs))
    setMemorizeLoading(false)
  }

  async function handleSearch() {
    if (!apiKey || !query.trim()) return
    setSearchLoading(true)
    setSearchResult(null)
    setSearchResult(await runTool(apiKey, "memory_search", effectiveUserId, searchArgs))
    setSearchLoading(false)
  }

  function openRaw(tool?: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("view", "raw")
      if (tool) next.set("tool", tool)
      else next.delete("tool")
      return next
    })
  }

  return (
    <Box style={{ height: "100%", overflow: "auto" }} p="lg">
      <Stack gap="lg" maw={1180} mx="auto">
        <Group justify="space-between" gap="md" align="center">
          <Group gap="xs" align="center" wrap="nowrap" style={{ width: 400, maxWidth: "100%" }}>
            <Text size="xs" fw={600} c="dimmed" style={{ whiteSpace: "nowrap" }}>User</Text>
            <TextInput
              size="xs"
              value={userId}
              onChange={(e) => onUserIdChange(e.currentTarget.value)}
              placeholder="Enter or select a userId..."
              style={{ flex: 1, minWidth: 0 }}
              styles={{ input: { fontFamily: "monospace", fontSize: 11 } }}
              list="playground-user-options"
            />
            <datalist id="playground-user-options">
              {userOptions.map((u) => <option key={u} value={u} />)}
            </datalist>
          </Group>
          <Button size="xs" variant="subtle" onClick={() => openRaw()}>
            Raw Tools
          </Button>
        </Group>

        {!apiKey && (
          <Paper withBorder radius={8} p="sm">
            <Text size="sm" c="dimmed">Enter your API key to run playground requests.</Text>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Paper withBorder radius={8} p="lg">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Box>
                  <Text fw={700}>Memorize</Text>
                  <Text size="xs" c="dimmed">memory_memorize</Text>
                </Box>
                <Switch
                  label="Dry run"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.currentTarget.checked)}
                  size="sm"
                />
              </Group>
              <Textarea
                value={memorizeText}
                onChange={(e) => setMemorizeText(e.currentTarget.value)}
                placeholder="Remember that I prefer quiet neighborhoods near parks."
                minRows={9}
                autosize
                maxRows={16}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault()
                    handleMemorize()
                  }
                }}
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">⌘↵ to memorize</Text>
                <Button onClick={handleMemorize} loading={memorizeLoading} disabled={!apiKey || !memorizeText.trim()}>
                  Memorize
                </Button>
              </Group>
              <ResultBlock result={memorizeResult} loading={memorizeLoading} />
              <CopyCodeButton toolName="memory_memorize" args={memorizeArgs} userId={effectiveUserId} />
            </Stack>
          </Paper>

          <Paper withBorder radius={8} p="lg">
            <Stack gap="md">
              <Box>
                <Text fw={700}>Search</Text>
                <Text size="xs" c="dimmed">memory_search</Text>
              </Box>
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
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Enter to search</Text>
                <Button onClick={handleSearch} loading={searchLoading} disabled={!apiKey || !query.trim()}>
                  Search
                </Button>
              </Group>
              <Box style={{ minHeight: 268 }}>
                <ResultBlock result={searchResult} loading={searchLoading} />
              </Box>
              <CopyCodeButton toolName="memory_search" args={searchArgs} userId={effectiveUserId} />
            </Stack>
          </Paper>
        </SimpleGrid>

        <Group gap="xs">
          <Button size="xs" variant="subtle" onClick={() => openRaw()}>▸ Raw Tools</Button>
          {["memory_list", "memory_read", "memory_write", "memory_patch"].map((tool) => (
            <Button key={tool} size="xs" variant="subtle" onClick={() => openRaw(tool)}>
              {tool}
            </Button>
          ))}
        </Group>
      </Stack>
    </Box>
  )
}
