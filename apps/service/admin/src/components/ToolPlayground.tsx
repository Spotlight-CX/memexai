import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  PasswordInput,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  UnstyledButton,
} from "@mantine/core"
import { useEffect, useState } from "react"

const API_KEY_STORAGE = "memexai.apiKey"
const DEMO_USER = "demo_user"

type ToolDef = {
  name: string
  description: string
  inputSchema: {
    type: string
    properties?: Record<string, { type?: string; description?: string }>
    required?: string[]
  }
}

type RunResult = {
  status: number
  latency: number
  body: unknown
}

const TOOL_SCAFFOLDS: Record<string, string> = {
  memory_list: "{}",
  memory_read: JSON.stringify({ path: "user/" }, null, 2),
  memory_write: JSON.stringify({ path: "user/note.md", content: "", reason: "" }, null, 2),
  memory_patch: JSON.stringify(
    { path: "user/note.md", operation: "append_lines", after_heading: "", lines: [] },
    null,
    2,
  ),
  memory_search: JSON.stringify({ query: "" }, null, 2),
  memory_memorize: JSON.stringify({ text: "" }, null, 2),
  memory_smart_read: "{}",
}

export function ToolPlayground() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? "")
  const [tools, setTools] = useState<ToolDef[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<string>("")
  const [argsJson, setArgsJson] = useState<string>("{}")
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [argsError, setArgsError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) {
      setTools([])
      setToolsError(null)
      return
    }
    let cancelled = false
    fetch("/v1/tools", { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body?.error?.message ?? `HTTP ${r.status}`)
        return body.tools as ToolDef[]
      })
      .then((t) => {
        if (!cancelled) {
          setTools(t)
          setToolsError(null)
          if (t.length && !selectedTool) selectTool(t[0].name)
        }
      })
      .catch((e) => {
        if (!cancelled) setToolsError(e instanceof Error ? e.message : "Failed to load tools")
      })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  function selectTool(name: string) {
    setSelectedTool(name)
    setArgsJson(TOOL_SCAFFOLDS[name] ?? "{}")
    setResult(null)
    setArgsError(null)
  }

  async function handleRun() {
    let args: unknown
    try {
      args = JSON.parse(argsJson)
    } catch {
      setArgsError("Invalid JSON — fix before running")
      return
    }
    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      const response = await fetch(`/v1/tools/${selectedTool}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ context: { userId: DEMO_USER }, arguments: args }),
      })
      const body = await response.json()
      setResult({ status: response.status, latency: Date.now() - start, body })
    } catch (e) {
      setResult({
        status: 0,
        latency: Date.now() - start,
        body: { error: e instanceof Error ? e.message : "Network error" },
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedToolDef = tools.find((t) => t.name === selectedTool)
  const schemaProps = Object.entries(selectedToolDef?.inputSchema?.properties ?? {})
  const requiredFields = selectedToolDef?.inputSchema?.required ?? []

  return (
    <Box
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* API Key strip */}
      <Box
        px="lg"
        py="sm"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}
      >
        <Group gap="lg" align="flex-end" wrap="nowrap">
          <PasswordInput
            label="API Key"
            value={apiKey}
            onChange={(e) => {
              const val = e.currentTarget.value
              setApiKey(val)
              localStorage.setItem(API_KEY_STORAGE, val)
              setSelectedTool("")
              setResult(null)
            }}
            placeholder="Bearer token for tool execution"
            style={{ width: 380 }}
            styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
          />
          <Text size="xs" c="dimmed" pb={6}>
            Saved locally · running as{" "}
            <Text span fw={600} c="gray.7">
              {DEMO_USER}
            </Text>
          </Text>
          {toolsError && (
            <Text size="xs" c="red" pb={6}>
              {toolsError}
            </Text>
          )}
        </Group>
      </Box>

      {/* Main two-column area */}
      <Box
        style={{
          flex: 1,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "200px 1fr",
        }}
      >
        {/* Left: tool list + schema */}
        <Box
          style={{
            borderRight: "1px solid var(--mantine-color-gray-2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <ScrollArea style={{ flex: 1 }} py="xs">
            {!apiKey ? (
              <Text size="xs" c="dimmed" px="sm" py="xs">
                Enter your API key above to load tools.
              </Text>
            ) : tools.length === 0 && !toolsError ? (
              <Text size="xs" c="dimmed" px="sm" py="xs">
                Loading…
              </Text>
            ) : (
              <Stack gap={0}>
                {tools.map((tool) => (
                  <UnstyledButton
                    key={tool.name}
                    onClick={() => selectTool(tool.name)}
                    px="sm"
                    py={6}
                    style={{
                      background:
                        selectedTool === tool.name
                          ? "var(--mantine-color-blue-0)"
                          : "transparent",
                      borderLeft:
                        selectedTool === tool.name
                          ? "2px solid var(--mantine-color-blue-5)"
                          : "2px solid transparent",
                    }}
                  >
                    <Text size="xs" fw={selectedTool === tool.name ? 600 : 400} truncate>
                      {tool.name}
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            )}
          </ScrollArea>

          {/* Schema panel */}
          {selectedToolDef && (
            <Box
              p="sm"
              style={{ borderTop: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}
            >
              <Text size="xs" fw={700} c="dimmed" mb={6} style={{ letterSpacing: "0.05em" }}>
                SCHEMA
              </Text>
              {schemaProps.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No arguments
                </Text>
              ) : (
                <Stack gap={4}>
                  {schemaProps.map(([name, prop]) => {
                    const isRequired = requiredFields.includes(name)
                    return (
                      <Box key={name}>
                        <Group gap={4} wrap="nowrap">
                          <Text size="xs" fw={500} style={{ fontFamily: "monospace" }}>
                            {name}
                            {!isRequired && "?"}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {prop.type ?? "any"}
                          </Text>
                        </Group>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          )}
        </Box>

        {/* Right: args + result */}
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {!selectedTool ? (
            <Box p="xl">
              <Text c="dimmed" size="sm">
                {apiKey ? "Select a tool from the left panel." : "Enter your API key above to get started."}
              </Text>
            </Box>
          ) : (
            <>
              {/* Args section */}
              <Box p="lg" style={{ flexShrink: 0 }}>
                <Text fw={600} size="sm" mb="sm">
                  {selectedTool}
                </Text>
                <Textarea
                  label="Arguments (JSON)"
                  value={argsJson}
                  onChange={(e) => {
                    setArgsJson(e.currentTarget.value)
                    setArgsError(null)
                  }}
                  error={argsError}
                  minRows={6}
                  autosize
                  maxRows={12}
                  styles={{
                    input: { fontFamily: "monospace", fontSize: 12 },
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault()
                      handleRun()
                    }
                  }}
                />
                <Group justify="space-between" mt="sm" align="center">
                  <Text size="xs" c="dimmed">
                    ⌘↵ to run
                  </Text>
                  <Button
                    onClick={handleRun}
                    loading={loading}
                    disabled={!apiKey}
                    size="sm"
                  >
                    ▶ Run Tool
                  </Button>
                </Group>
              </Box>

              {/* Result section */}
              {result && (
                <>
                  <Divider />
                  <ScrollArea style={{ flex: 1 }} p="lg">
                    <Group gap="sm" mb="sm" align="center">
                      <Text size="sm" fw={500}>
                        Result
                      </Text>
                      <Badge
                        color={result.status >= 200 && result.status < 300 ? "green" : "red"}
                        variant="light"
                        size="sm"
                      >
                        {result.status === 0 ? "ERR" : result.status}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {result.latency}ms
                      </Text>
                    </Group>
                    <Code
                      block
                      style={{
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: "unset",
                      }}
                    >
                      {JSON.stringify(result.body, null, 2)}
                    </Code>
                  </ScrollArea>
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}
