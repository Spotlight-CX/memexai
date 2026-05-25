import { Box, Button, Group, SegmentedControl, Stack, Text, UnstyledButton } from "@mantine/core"
import { useMemo, useState } from "react"
import {
  loadPrefs,
  savePrefs,
  type PythonSnippetHarness,
  type SnippetLanguage,
  type TypeScriptSnippetHarness,
} from "./tool-utils"

type SnippetHarness = TypeScriptSnippetHarness | PythonSnippetHarness

const AGENTIC_TOOLS = new Set(["memory_memorize", "memory_search"])
const LANGUAGE_OPTIONS: { label: string; value: SnippetLanguage }[] = [
  { label: "TypeScript", value: "typescript" },
  { label: "Python", value: "python" },
]
const TYPESCRIPT_HARNESSES: { label: string; value: TypeScriptSnippetHarness }[] = [
  { label: "Vercel AI", value: "vercel-ai" },
  { label: "OpenAI", value: "openai" },
  { label: "LangChain", value: "langchain" },
  { label: "Raw SDK", value: "raw-sdk" },
]
const PYTHON_HARNESSES: { label: string; value: PythonSnippetHarness }[] = [
  { label: "Raw SDK", value: "raw-sdk" },
  { label: "LangChain", value: "langchain" },
  { label: "LlamaIndex", value: "llamaindex" },
  { label: "CrewAI", value: "crewai" },
]

function buildSnippet(
  language: SnippetLanguage,
  harness: SnippetHarness,
  toolName: string,
  args: unknown,
  userId: string,
): string {
  const url = window.location.origin
  if (language === "python") return buildPythonSnippet(url, harness as PythonSnippetHarness, toolName, args, userId)
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

function buildPythonSnippet(
  url: string,
  harness: PythonSnippetHarness,
  toolName: string,
  args: unknown,
  userId: string,
): string {
  if (harness === "langchain") return buildPythonLangChainSnippet(url, toolName, args, userId)
  if (harness === "llamaindex") return buildPythonLlamaIndexSnippet(url, toolName, args, userId)
  if (harness === "crewai") return buildPythonCrewAISnippet(url, toolName, args, userId)
  return buildPythonRawSdkSnippet(url, toolName, args, userId)
}

function buildPythonRawSdkSnippet(url: string, toolName: string, args: unknown, userId: string): string {
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

function buildPythonLangChainSnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `from memexai import MemexAI
from memexai.adapters.langchain import get_langchain_tools

memex = MemexAI(
    url=${pyString(url)},
    api_key="YOUR_API_KEY",
)

memory = memex.for_user(${pyString(userId)}, actor="assistant")
tools = get_langchain_tools(memory)
tool = next((candidate for candidate in tools if candidate.name == ${pyString(toolName)}), None)
if tool is None:
    raise RuntimeError("MemexAI tool not found")

tool_args = ${formatPy(args)}
result = await tool.ainvoke(tool_args)
print(result)

await memex.close()`
}

function buildPythonLlamaIndexSnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `from memexai import MemexAI
from memexai.adapters.llamaindex import get_llamaindex_tools

memex = MemexAI(
    url=${pyString(url)},
    api_key="YOUR_API_KEY",
)

memory = memex.for_user(${pyString(userId)}, actor="assistant")
tools = get_llamaindex_tools(memory)
tool = next((candidate for candidate in tools if candidate.metadata.name == ${pyString(toolName)}), None)
if tool is None:
    raise RuntimeError("MemexAI tool not found")

tool_args = ${formatPy(args)}
result = await tool.acall(**tool_args)
print(result)

await memex.close()`
}

function buildPythonCrewAISnippet(url: string, toolName: string, args: unknown, userId: string): string {
  return `import inspect

from memexai import MemexAI
from memexai.adapters.crewai import get_crewai_tools

memex = MemexAI(
    url=${pyString(url)},
    api_key="YOUR_API_KEY",
)

memory = memex.for_user(${pyString(userId)}, actor="assistant")
tools = get_crewai_tools(memory)
tool = next((candidate for candidate in tools if candidate.name == ${pyString(toolName)}), None)
if tool is None:
    raise RuntimeError("MemexAI tool not found")

tool_args = ${formatPy(args)}
maybe_result = tool.run(**tool_args)
result = await maybe_result if inspect.isawaitable(maybe_result) else maybe_result
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

function isSnippetLanguage(value: unknown): value is SnippetLanguage {
  return value === "typescript" || value === "python"
}

function isTypeScriptHarness(value: unknown): value is TypeScriptSnippetHarness {
  return value === "vercel-ai" || value === "openai" || value === "langchain" || value === "raw-sdk"
}

function isPythonHarness(value: unknown): value is PythonSnippetHarness {
  return value === "raw-sdk" || value === "langchain" || value === "llamaindex" || value === "crewai"
}

function harnessLabel(language: SnippetLanguage, harness: SnippetHarness): string {
  const options = language === "python" ? PYTHON_HARNESSES : TYPESCRIPT_HARNESSES
  return options.find((option) => option.value === harness)?.label ?? "Raw SDK"
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
  const initialLanguage = isSnippetLanguage(prefs.snippetLanguage) ? prefs.snippetLanguage : "typescript"
  const initialTypeScriptHarness = isTypeScriptHarness(prefs.typescriptSnippetHarness)
    ? prefs.typescriptSnippetHarness
    : isTypeScriptHarness(prefs.snippetHarness)
      ? prefs.snippetHarness
      : "vercel-ai"
  const initialPythonHarness = isPythonHarness(prefs.pythonSnippetHarness) ? prefs.pythonSnippetHarness : "raw-sdk"
  const [opened, setOpened] = useState(false)
  const [language, setLanguage] = useState<SnippetLanguage>(initialLanguage)
  const [typescriptHarness, setTypeScriptHarness] = useState<TypeScriptSnippetHarness>(initialTypeScriptHarness)
  const [pythonHarness, setPythonHarness] = useState<PythonSnippetHarness>(initialPythonHarness)
  const [copied, setCopied] = useState(false)
  const currentHarness = language === "python" ? pythonHarness : typescriptHarness
  const harnessOptions = language === "python" ? PYTHON_HARNESSES : TYPESCRIPT_HARNESSES
  const title = `${language === "python" ? "Python" : "TypeScript"} - ${harnessLabel(language, currentHarness)}`

  const snippet = useMemo(
    () => buildSnippet(language, currentHarness, toolName, args, userId),
    [args, currentHarness, language, toolName, userId],
  )

  function handleLanguageChange(nextLanguage: string) {
    if (!isSnippetLanguage(nextLanguage)) return
    setLanguage(nextLanguage)
    savePrefs({ ...loadPrefs(), snippetLanguage: nextLanguage })
  }

  function handleHarnessChange(nextHarness: string) {
    if (language === "python") {
      if (!isPythonHarness(nextHarness)) return
      setPythonHarness(nextHarness)
      savePrefs({ ...loadPrefs(), pythonSnippetHarness: nextHarness })
    } else {
      if (!isTypeScriptHarness(nextHarness)) return
      setTypeScriptHarness(nextHarness)
      savePrefs({ ...loadPrefs(), typescriptSnippetHarness: nextHarness })
    }
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
          <Group gap="xs" justify="space-between" align="flex-end" wrap="wrap">
            <Box style={{ flex: "1 1 150px", minWidth: 0 }}>
              <Text size="10px" c="dimmed" fw={700} mb={3} style={{ textTransform: "uppercase" }}>
                Language
              </Text>
              <SegmentedControl
                size="xs"
                value={language}
                onChange={handleLanguageChange}
                data={LANGUAGE_OPTIONS}
                fullWidth
              />
            </Box>
            <Box style={{ flex: "1.4 1 210px", minWidth: 0 }}>
              <Text size="10px" c="dimmed" fw={700} mb={3} style={{ textTransform: "uppercase" }}>
                Harness
              </Text>
              <SegmentedControl
                size="xs"
                value={currentHarness}
                onChange={handleHarnessChange}
                data={harnessOptions}
                fullWidth
              />
            </Box>
          </Group>

          <Box
            style={{
              border: "1px solid var(--mantine-color-gray-3)",
              borderRadius: 8,
              background: "var(--mantine-color-gray-0)",
              overflow: "hidden",
            }}
          >
            <Group justify="space-between" px="sm" py={6} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
              <Text size="xs" fw={700} c="gray.7">{title}</Text>
              <Button size="compact-xs" variant="subtle" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </Group>
            <Box
              component="pre"
              m={0}
              p="sm"
              style={{
                maxHeight: 360,
                minHeight: 220,
                overflow: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: "pre",
              }}
            >
              {snippet}
            </Box>
          </Box>
        </Stack>
      )}
    </Box>
  )
}
