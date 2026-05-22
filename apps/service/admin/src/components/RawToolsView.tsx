import {
  Badge,
  Box,
  Button,
  Code,
  Group,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core"
import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useSearchParams } from "react-router-dom"
import remarkGfm from "remark-gfm"
import { CopyCodeButton } from "./CopyCodeButton"
import { ResponseBody } from "./ResponseBody"
import {
  type ArgMode,
  type PropSchema,
  type RunResult,
  type ToolDef,
  TOOL_SCAFFOLDS,
  detectKind,
  formToArgs,
  jsonToForm,
  loadPrefs,
  savePrefs,
  scaffoldToJson,
} from "./tool-utils"

type RawToolsViewProps = {
  apiKey: string
  tools: ToolDef[]
  toolsError: string | null
  userId: string
  userOptions: string[]
  onUserIdChange: (userId: string) => void
}

type SchemaFormFieldsProps = {
  properties: Record<string, PropSchema>
  required: string[]
  values: Record<string, string>
  onChange: (field: string, value: string) => void
}

function SchemaFormFields({ properties, required, values, onChange }: SchemaFormFieldsProps) {
  const entries = Object.entries(properties)
  if (entries.length === 0) {
    return <Text size="sm" c="dimmed">This tool takes no arguments.</Text>
  }

  return (
    <Stack gap="md">
      {entries.map(([name, prop]) => {
        const isRequired = required.includes(name)
        const kind = detectKind(name, prop)
        const value = values[name] ?? ""
        const label = (
          <Group gap={4} mb={2}>
            <Text size="xs" fw={600} style={{ fontFamily: "monospace" }}>{name}</Text>
            {isRequired
              ? <Badge size="xs" color="red" variant="dot">required</Badge>
              : <Badge size="xs" color="gray" variant="dot">optional</Badge>}
          </Group>
        )

        if (kind === "select") {
          return (
            <Box key={name}>
              {label}
              <Select
                data={prop.enum ?? []}
                value={value || null}
                onChange={(v) => onChange(name, v ?? "")}
                description={prop.description}
                placeholder="Select..."
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }
        if (kind === "number") {
          return (
            <Box key={name}>
              {label}
              <NumberInput
                value={value === "" ? "" : Number(value)}
                onChange={(v) => onChange(name, v === "" ? "" : String(v))}
                description={prop.description}
                placeholder="number"
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }
        if (kind === "boolean") {
          return (
            <Box key={name}>
              {label}
              <Group gap="sm" align="center">
                <Switch
                  checked={value === "true"}
                  onChange={(e) => onChange(name, String(e.currentTarget.checked))}
                  size="sm"
                />
                {prop.description && <Text size="xs" c="dimmed">{prop.description}</Text>}
              </Group>
            </Box>
          )
        }
        if (kind === "array") {
          return (
            <Box key={name}>
              {label}
              <Textarea
                value={value}
                onChange={(e) => onChange(name, e.currentTarget.value)}
                description={(prop.description ? prop.description + " - " : "") + "one item per line"}
                placeholder={"item 1\nitem 2"}
                minRows={3}
                autosize
                maxRows={8}
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }
        if (kind === "json") {
          return (
            <Box key={name}>
              {label}
              <Textarea
                value={value}
                onChange={(e) => onChange(name, e.currentTarget.value)}
                description={(prop.description ?? "") + " (JSON)"}
                placeholder='""'
                minRows={3}
                autosize
                maxRows={8}
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }
        if (kind === "textarea") {
          return (
            <Box key={name}>
              {label}
              <Textarea
                value={value}
                onChange={(e) => onChange(name, e.currentTarget.value)}
                description={prop.description}
                minRows={name === "content" || name === "text" ? 6 : 3}
                autosize
                maxRows={12}
                size="sm"
                styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
              />
            </Box>
          )
        }
        return (
          <Box key={name}>
            {label}
            <TextInput
              value={value}
              onChange={(e) => onChange(name, e.currentTarget.value)}
              description={prop.description}
              placeholder={name}
              size="sm"
              styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
            />
          </Box>
        )
      })}
    </Stack>
  )
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  h3: ({ children }) => (
    <Text fw={600} size="sm" mt="md" mb={4}>{children}</Text>
  ),
  p: ({ children }) => (
    <Text size="sm" c="dark.6" mb="xs" style={{ lineHeight: 1.6 }}>{children}</Text>
  ),
  table: ({ children }) => (
    <Box component="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, marginBottom: 12 }}>
      {children}
    </Box>
  ),
  th: ({ children }) => (
    <Box component="th" style={{ textAlign: "left", padding: "4px 8px", background: "var(--mantine-color-gray-1)", borderBottom: "1px solid var(--mantine-color-gray-3)", fontWeight: 600, fontSize: 11 }}>
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box component="td" style={{ padding: "4px 8px", borderBottom: "1px solid var(--mantine-color-gray-2)", verticalAlign: "top", fontFamily: "monospace", fontSize: 12 }}>
      {children}
    </Box>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-")
    return isBlock
      ? <Code block style={{ fontSize: 12, marginBottom: 12 }}>{children}</Code>
      : <Code style={{ fontSize: 12 }}>{children}</Code>
  },
  hr: () => (
    <Box style={{ borderTop: "1px solid var(--mantine-color-gray-2)", margin: "12px 0" }} />
  ),
  li: ({ children }) => (
    <Text component="li" size="sm" c="dark.6" mb={2}>{children}</Text>
  ),
}

export function RawToolsView({ apiKey, tools, toolsError, userId, userOptions, onUserIdChange }: RawToolsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTool = searchParams.get("tool") ?? ""
  const [argMode, setArgMode] = useState<ArgMode>(() => loadPrefs().argMode ?? "form")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [argsJson, setArgsJson] = useState<string>("{}")
  const [result, setResult] = useState<RunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [argsError, setArgsError] = useState<string | null>(null)

  const selectedToolDef = tools.find((t) => t.name === selectedTool)
  const schemaProps = selectedToolDef?.inputSchema?.properties ?? {}
  const requiredFields = selectedToolDef?.inputSchema?.required ?? []
  const currentArgs = useMemo(() => {
    if (!selectedToolDef) return {}
    if (argMode === "json") {
      try {
        return JSON.parse(argsJson)
      } catch {
        return {}
      }
    }
    return formToArgs(formValues, schemaProps, requiredFields)
  }, [argMode, argsJson, formValues, requiredFields, schemaProps, selectedToolDef])

  useEffect(() => {
    if (selectedTool || tools.length === 0) return
    doSelectTool(tools[0].name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tools, selectedTool])

  useEffect(() => {
    if (!selectedTool) {
      setFormValues({})
      setArgsJson("{}")
      return
    }
    setFormValues(TOOL_SCAFFOLDS[selectedTool] ?? {})
    setArgsJson(scaffoldToJson(selectedTool))
    setResult(null)
    setArgsError(null)
  }, [selectedTool])

  function doSelectTool(name: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set("view", "raw")
      next.set("tool", name)
      return next
    })
  }

  function handleArgModeChange(mode: ArgMode) {
    if (mode === argMode) return
    if (mode === "json") {
      setArgsJson(JSON.stringify(formToArgs(formValues, schemaProps, requiredFields), null, 2))
    } else {
      setFormValues(jsonToForm(argsJson, schemaProps))
    }
    setArgMode(mode)
    savePrefs({ ...loadPrefs(), argMode: mode })
  }

  function goQuickTest() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("view")
      next.delete("tool")
      return next
    })
  }

  async function handleRun() {
    if (!selectedTool) return
    let args: unknown
    if (argMode === "json") {
      try {
        args = JSON.parse(argsJson)
      } catch {
        setArgsError("Invalid JSON - fix before running")
        return
      }
    } else {
      args = formToArgs(formValues, schemaProps, requiredFields)
    }

    setLoading(true)
    setResult(null)
    const start = Date.now()
    try {
      const response = await fetch(`/v1/tools/${selectedTool}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ context: { userId: userId.trim() || "demo_user" }, arguments: args }),
      })
      const body = await response.json()
      setResult({ status: response.status, latency: Date.now() - start, body })
    } catch (e) {
      setResult({ status: 0, latency: Date.now() - start, body: { error: e instanceof Error ? e.message : "Network error" } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box px="sm" py={6} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}>
        <Group gap="sm" justify="space-between" align="center" wrap="nowrap">
          <Button size="xs" variant="subtle" onClick={goQuickTest}>
            * Memorize · Search ↑ Quick Test
          </Button>
          <Group gap="xs" align="center" wrap="nowrap" style={{ width: 420, maxWidth: "55%" }}>
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
        </Group>
      </Box>

      <Box style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <ScrollArea style={{ width: 220, flexShrink: 0, borderRight: "1px solid var(--mantine-color-gray-2)" }} py="xs">
          {!apiKey ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">Enter your API key to load tools.</Text>
          ) : tools.length === 0 && !toolsError ? (
            <Text size="xs" c="dimmed" px="sm" py="xs">Loading...</Text>
          ) : toolsError ? (
            <Text size="xs" c="red" px="sm" py="xs">{toolsError}</Text>
          ) : (
            <Stack gap={0}>
              <Text size="10px" fw={700} c="dimmed" px="sm" pt="xs" pb={4} style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Tools
              </Text>
              {tools.map((tool) => (
                <UnstyledButton
                  key={tool.name}
                  onClick={() => doSelectTool(tool.name)}
                  px="sm"
                  py={7}
                  style={{
                    background: selectedTool === tool.name ? "var(--mantine-color-blue-0)" : "transparent",
                    borderLeft: selectedTool === tool.name ? "2px solid var(--mantine-color-blue-5)" : "2px solid transparent",
                  }}
                >
                  <Text size="xs" fw={selectedTool === tool.name ? 600 : 400} truncate style={{ fontFamily: "monospace" }}>
                    {tool.name}
                  </Text>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea>

        {!selectedTool ? (
          <Box p="xl" style={{ flex: 1 }}>
            <Text c="dimmed" size="sm">
              {apiKey ? "Select a tool from the left panel." : "Enter your API key above to get started."}
            </Text>
          </Box>
        ) : (
          <Box style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
            <ScrollArea style={{ borderRight: "1px solid var(--mantine-color-gray-2)" }} p="lg">
              <Group justify="space-between" mb="md" align="center">
                <Text fw={700} size="sm" style={{ fontFamily: "monospace" }}>{selectedTool}</Text>
                <Button onClick={handleRun} loading={loading} disabled={!apiKey} size="xs">
                  ▶ Send
                </Button>
              </Group>

              <Box mb="lg">
                <Group justify="space-between" mb="md" align="center">
                  <Text size="xs" fw={700} c="dimmed" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    Arguments
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={argMode}
                    onChange={(v) => handleArgModeChange(v as ArgMode)}
                    data={[
                      { label: "Form", value: "form" },
                      { label: "JSON", value: "json" },
                    ]}
                  />
                </Group>

                {argMode === "form" ? (
                  <SchemaFormFields
                    properties={schemaProps}
                    required={requiredFields}
                    values={formValues}
                    onChange={(field, value) => setFormValues((prev) => ({ ...prev, [field]: value }))}
                  />
                ) : (
                  <Textarea
                    value={argsJson}
                    onChange={(e) => { setArgsJson(e.currentTarget.value); setArgsError(null) }}
                    error={argsError}
                    minRows={10}
                    autosize
                    maxRows={20}
                    styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun() }
                    }}
                  />
                )}

                <Group justify="space-between" align="flex-start" mt="md">
                  <Text size="xs" c="dimmed">⌘↵ to send</Text>
                  <CopyCodeButton toolName={selectedTool} args={currentArgs} userId={userId.trim() || "demo_user"} />
                </Group>
              </Box>

              {selectedToolDef?.description && (
                <Box pt="lg" style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}>
                  <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>
                    {selectedToolDef.description}
                  </ReactMarkdown>
                </Box>
              )}
            </ScrollArea>

            <Box style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: result ? undefined : "var(--mantine-color-gray-0)" }}>
              <Box px="lg" py="sm" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", flexShrink: 0 }}>
                <Group gap="sm" align="center">
                  <Text size="sm" fw={600}>Response</Text>
                  {result && (
                    <>
                      <Badge color={result.status >= 200 && result.status < 300 ? "green" : "red"} variant="light" size="sm">
                        {result.status === 0 ? "ERR" : result.status}
                      </Badge>
                      <Text size="xs" c="dimmed">{result.latency}ms</Text>
                    </>
                  )}
                </Group>
              </Box>
              <ScrollArea style={{ flex: 1 }} p="lg">
                {result ? (
                  <>
                    <ResponseBody body={result.body} />
                    <CopyCodeButton toolName={selectedTool} args={currentArgs} userId={userId.trim() || "demo_user"} />
                  </>
                ) : (
                  <Text size="sm" c="dimmed">{loading ? "Running..." : "Hit Send to see the response here."}</Text>
                )}
              </ScrollArea>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
