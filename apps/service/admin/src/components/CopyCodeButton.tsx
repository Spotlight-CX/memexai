import { Box, Button, Code, Group, SegmentedControl, Stack, Text, UnstyledButton } from "@mantine/core"
import { useMemo, useState } from "react"
import { loadPrefs, savePrefs, type SnippetHarness, type SnippetLanguage } from "./tool-utils"

const AGENTIC_TOOLS = new Set(["memory_memorize", "memory_search"])

const HARNESS_OPTIONS: { label: string; value: SnippetHarness }[] = [
  { label: "Vercel AI", value: "vercel-ai" },
  { label: "OpenAI", value: "openai" },
  { label: "LangChain", value: "langchain" },
  { label: "Raw SDK", value: "raw-sdk" },
]

function buildSnippet(language: SnippetLanguage, harness: SnippetHarness, toolName: string, args: unknown, userId: string): string {
  const url = window.location.origin
  if (language === "python") return buildPythonSnippet(url, toolName, args, userId)
  if (harness === "raw-sdk") return buildRawSdkSnippet(url, toolName, args, userId)
  if (harness === "openai") return buildOpenAISnippet(url, toolName, args, userId)
  if (harness === "langchain") return buildLangChainSnippet(url, toolName, args, userId)
  return buildVercelAISnippet(url, toolName, args, userId)
}

function buildVercelAISnippet(url: string, toolName: string, args: unknown, userId: string): string {
  const modeArg = AGENTIC_TOOLS.has(toolName) ? "" : ', { mode: "raw" }'
  const prompt = makePrompt(toolName, args)

  return `import { MemexAI } from "@memexai/sdk"
import { createVercelAITools } from "@memexai/sdk/adapters/vercel-ai"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const memex = new MemexAI({
  url: ${tsString(url)},
  apiKey: process.env.MEMEX_API_KEY ?? "YOUR_API_KEY",
})

const memory = memex.forUser({
  userId: ${tsString(userId)},
  actor: "assistant",
})

const tools = createVercelAITools(memory${modeArg})

const result = await generateText({
  model: createGoogleGenerativeAI()("gemini-2.5-flash"),
  system: "You are a helpful assistant with durable memory.",
  prompt: ${tsString(prompt)},
  tools,
  stopWhen: stepCountIs(5),
})

console.log(result.text)`
}

function buildOpenAISnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `import { MemexAI } from "@memexai/sdk"
import { createOpenAITools } from "@memexai/sdk/adapters/openai"

const memex = new MemexAI({
  url: ${tsString(url)},
  apiKey: process.env.MEMEX_API_KEY ?? "YOUR_API_KEY",
})

const memory = memex.forUser({
  userId: ${tsString(userId)},
  actor: "assistant",
})

const memexTools = createOpenAITools(memory)

// Pass memexTools.definitions to your OpenAI Responses or Chat Completions call.
console.log(memexTools.definitions)

const result = await memexTools.execute({
  name: ${tsString(toolName)},
  arguments: ${formatTs(args)},
})

console.log(result)`
}

function buildLangChainSnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `import { MemexAI } from "@memexai/sdk"
import { createLangChainTools } from "@memexai/sdk/adapters/langchain"

const memex = new MemexAI({
  url: ${tsString(url)},
  apiKey: process.env.MEMEX_API_KEY ?? "YOUR_API_KEY",
})

const memory = memex.forUser({
  userId: ${tsString(userId)},
  actor: "assistant",
})

const tools = createLangChainTools(memory)
const tool = tools.find((candidate) => candidate.name === ${tsString(toolName)})
if (!tool) throw new Error("MemexAI tool not found")

// Pass tools to your LangChain agent, or call a tool directly:
const result = await tool.call(${formatTs(args)})

console.log(result)`
}

function buildRawSdkSnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `import { MemexAI } from "@memexai/sdk"

const memex = new MemexAI({
  url: ${tsString(url)},
  apiKey: process.env.MEMEX_API_KEY ?? "YOUR_API_KEY",
})

const memory = memex.forUser({
  userId: ${tsString(userId)},
  actor: "assistant",
})

const result = await ${buildTsMemoryCall(toolName, args)}

console.log(result)`
}

function buildPythonSnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `from memexai import MemexAI

memex = MemexAI(
    url=${pyString(url)},
    api_key="YOUR_API_KEY",
)

memory = memex.for_user(${pyString(userId)}, actor="assistant")

result = await ${buildPythonMemoryCall(toolName, args)}
print(result)

await memex.close()`
}

function buildTsMemoryCall(toolName: string, args: unknown): string {
  const obj = asRecord(args)
  if (toolName === "memory_memorize") return `memory.memorize(${formatTsObjectOrString(obj, "text")})`
  if (toolName === "memory_search") return `memory.search(${formatTsObjectOrString(obj, "query")})`
  if (toolName === "memory_list") return `memory.listFiles(${formatTs(obj)})`
  if (toolName === "memory_read") return `memory.readFile(${formatTs(obj)})`
  if (toolName === "memory_write") return `memory.writeFile(${formatTs(obj)})`
  if (toolName === "memory_patch") return `memory.patchFile(${formatTs(obj)})`
  return `memory.executeTool({
  name: ${tsString(toolName)},
  arguments: ${indent(formatTs(args), 2).trimStart()},
})`
}

function buildPythonMemoryCall(toolName: string, args: unknown): string {
  const obj = asRecord(args)
  if (toolName === "memory_memorize") return `memory.memorize(${formatPythonObjectOrString(obj, "text")})`
  if (toolName === "memory_search") return `memory.search(${formatPythonObjectOrString(obj, "query")})`
  if (toolName === "memory_list") return `memory.list_files(${formatPythonKwargs(obj)})`
  if (toolName === "memory_read") return `memory.read_file(${formatPythonRequiredString(obj, "path")})`
  if (toolName === "memory_write") return `memory.write_file(${formatPythonWriteArgs(obj)})`
  if (toolName === "memory_patch") return `memory.patch_file(${formatPythonPatchArgs(obj)})`
  return `memory.execute_tool(${pyString(toolName)}, ${formatPy(args)})`
}

function makePrompt(toolName: string, args: unknown): string {
  const obj = asRecord(args)
  if (toolName === "memory_memorize" && typeof obj.text === "string" && obj.text.trim()) return obj.text
  if (toolName === "memory_search" && typeof obj.query === "string" && obj.query.trim()) return obj.query
  return `Use ${toolName} with these arguments: ${JSON.stringify(args)}`
}

function formatTsObjectOrString(obj: Record<string, unknown>, key: string): string {
  const keys = Object.keys(obj)
  if (keys.length === 1 && typeof obj[key] === "string") return tsString(obj[key])
  return formatTs(obj)
}

function formatPythonObjectOrString(obj: Record<string, unknown>, key: string): string {
  const keys = Object.keys(obj)
  if (keys.length === 1 && typeof obj[key] === "string") return pyString(obj[key])
  return formatPy(obj)
}

function formatPythonKwargs(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return ""
  return entries.map(([key, value]) => `${toSnakeCase(key)}=${formatPy(value)}`).join(", ")
}

function formatPythonRequiredString(obj: Record<string, unknown>, key: string): string {
  const value = typeof obj[key] === "string" ? obj[key] : ""
  return pyString(value)
}

function formatPythonWriteArgs(obj: Record<string, unknown>): string {
  const path = formatPythonRequiredString(obj, "path")
  const content = typeof obj.content === "string" ? pyString(obj.content) : pyString("")
  const rest = Object.entries(obj)
    .filter(([key, value]) => !["path", "content"].includes(key) && value !== undefined)
    .map(([key, value]) => `${toSnakeCase(key)}=${formatPy(value)}`)
  return [path, content, ...rest].join(", ")
}

function formatPythonPatchArgs(obj: Record<string, unknown>): string {
  const path = formatPythonRequiredString(obj, "path")
  const operation = typeof obj.operation === "string" ? pyString(obj.operation) : pyString("")
  const rest = Object.entries(obj)
    .filter(([key, value]) => !["path", "operation"].includes(key) && value !== undefined)
    .map(([key, value]) => `${toSnakeCase(key)}=${formatPy(value)}`)
  return [path, operation, ...rest].join(", ")
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function formatTs(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "undefined"
}

function formatPy(value: unknown): string {
  return (JSON.stringify(value, null, 2) ?? "None")
    .replace(/\btrue\b/g, "True")
    .replace(/\bfalse\b/g, "False")
    .replace(/\bnull\b/g, "None")
}

function tsString(value: unknown): string {
  return JSON.stringify(String(value))
}

function pyString(value: unknown): string {
  return JSON.stringify(String(value))
}

function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces)
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n")
}

function toSnakeCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
}

export function CopyCodeButton({
  toolName,
  args,
  userId,
}: {
  toolName: string
  args: unknown
  userId: string
}) {
  const prefs = loadPrefs()
  const [opened, setOpened] = useState(false)
  const [language, setLanguage] = useState<SnippetLanguage>(prefs.snippetLanguage ?? "typescript")
  const [harness, setHarness] = useState<SnippetHarness>(prefs.snippetHarness ?? "vercel-ai")
  const [copied, setCopied] = useState(false)

  const snippet = useMemo(() => buildSnippet(language, harness, toolName, args, userId), [args, harness, language, toolName, userId])

  function handleLanguageChange(nextLanguage: string) {
    const snippetLanguage = nextLanguage as SnippetLanguage
    setLanguage(snippetLanguage)
    savePrefs({ ...loadPrefs(), snippetLanguage })
  }

  function handleHarnessChange(nextHarness: string) {
    const snippetHarness = nextHarness as SnippetHarness
    setHarness(snippetHarness)
    savePrefs({ ...loadPrefs(), snippetHarness })
  }

  function handleCopy() {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <Box mt="sm" style={{ minWidth: 0 }}>
      <UnstyledButton
        onClick={() => setOpened((value) => !value)}
        style={{ width: "100%", borderTop: "1px solid var(--mantine-color-gray-2)", paddingTop: 8 }}
      >
        <Group gap="xs" justify="space-between">
          <Text size="xs" c="dimmed" fw={600}>SDK example</Text>
          <Text size="xs" c="dimmed">{opened ? "Hide" : "Show"} copy snippet</Text>
        </Group>
      </UnstyledButton>

      {opened && (
        <Stack gap="xs" mt="xs">
          <Group gap="xs" justify="space-between" align="center">
            <SegmentedControl
              size="xs"
              value={language}
              onChange={handleLanguageChange}
              data={[
                { label: "TypeScript", value: "typescript" },
                { label: "Python", value: "python" },
              ]}
            />
            <Button size="xs" variant="subtle" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </Group>

          {language === "typescript" && (
            <SegmentedControl
              size="xs"
              value={harness}
              onChange={handleHarnessChange}
              data={HARNESS_OPTIONS}
              fullWidth
            />
          )}

          <Code block style={{ fontSize: 11, whiteSpace: "pre", overflowX: "auto" }}>
            {snippet}
          </Code>
        </Stack>
      )}
    </Box>
  )
}
