import {
  Anchor,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core"
import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AdminProfilePanel } from "./WelcomeModal"
import welcomeImage from "../assets/welcome-memory.png"

const DOMAINS = [
  "Shopping / Commerce",
  "Travel & Hospitality",
  "Financial Services",
  "Health & Wellness",
  "Education & Learning",
  "Entertainment & Media",
  "Food & Delivery",
  "Productivity & Work",
  "Other",
]

const SLACK_INVITE_URL = "https://join.slack.com/t/memexaispace/shared_invite/zt-3yy24alf6-t1wRQsErf09JViHww_qlGw"

const STABILITY_OPTIONS = [
  { id: "volatile", label: "Changes often", hint: "Patch quickly and avoid treating old facts as final." },
  { id: "evolving", label: "Evolves gradually", hint: "Good default for preferences that refine over time." },
  { id: "static", label: "Rarely changes", hint: "Stable profile facts with explicit corrections." },
]

const TIMESTAMP_OPTIONS = [
  {
    id: "yes",
    label: "Yes — stamp facts with date learned",
    hint: "Agents append [YYYY-MM] to entries. Makes it easy to audit when a belief was formed and reason about recency.",
  },
  {
    id: "no",
    label: "No — plain facts only",
    hint: "Cleaner entries. Rely on revision history for date context.",
  },
]

type Step = 0 | 1 | 2 | 3 | 4
type GeneratedFile = {
  path: string
  content: string
  purpose?: string
  memorySchemaRole?: string
}
type SetupExample = {
  userMessage: string
  shouldStore: boolean
  reason: string
  targetFile: string | null
  memoryLines: string[]
}
type SetupExplanation = {
  summary: string
  schemaGuidance: string
  examples: SetupExample[]
  sharedMemoryIdeas: string[]
  rawToolNote: string
}

const OPTION_SELECTED_STYLE = {
  borderRadius: 8,
  border: "1.5px solid var(--mantine-color-blue-5)",
  background: "var(--mantine-color-blue-0)",
  cursor: "pointer",
} as const

const OPTION_DEFAULT_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--mantine-color-gray-3)",
  background: "rgba(255,255,255,0.82)",
  cursor: "pointer",
} as const

const FALLBACK_FILES: GeneratedFile[] = [
  {
    path: "shared/index.md",
    purpose: "Memory map",
    memorySchemaRole: "Shows agents which shared files define memory behavior.",
    content: [
      "# Shared Memory",
      "",
      "- `shared/user-memory.md` defines how agents manage per-user memory.",
      "- `shared/domain.md` defines product-specific memory judgment.",
      "",
    ].join("\n"),
  },
  {
    path: "shared/user-memory.md",
    purpose: "Agent rules",
    memorySchemaRole: "Defines what to remember, ignore, patch, and audit.",
    content: [
      "# User Memory Rules",
      "",
      "Store durable user preferences, constraints, goals, and corrections.",
      "Do not store one-off lookups, transient searches, or raw transcripts by default.",
      "When a user corrects older memory, patch the existing file instead of duplicating stale facts.",
      "",
      "## Timestamp Convention",
      "",
      "When writing a new fact, append the month it was learned: `- Prefers X [YYYY-MM]`.",
      "When patching a fact, update the timestamp to the current month.",
      "This is the only recency signal — MemexAI does not track which line was added when.",
      "",
    ].join("\n"),
  },
  {
    path: "shared/domain.md",
    purpose: "Domain rules",
    memorySchemaRole: "Adapts memory decisions to this product and its users.",
    content: [
      "# Domain Memory Guidance",
      "",
      "Use the admin's product description and selected categories to decide what improves personalization.",
      "Prefer concise user files such as `user/index.md`, `user/preferences.md`, and `user/constraints.md`.",
      "",
    ].join("\n"),
  },
]

const FALLBACK_EXPLANATION: SetupExplanation = {
  summary: "Default agentic memory schema. Agents remember durable user facts, patch corrections, and ignore one-off queries.",
  schemaGuidance: [
    "Store explicit preferences, constraints, goals, and stable context.",
    "Patch older facts when the user corrects or supersedes them.",
    "Do not store raw transcripts, transient searches, or lookup results by default.",
  ].join("\n"),
  examples: [
    {
      userMessage: "Remember that I prefer boutique hotels, not large chains.",
      shouldStore: true,
      reason: "Durable preference.",
      targetFile: "user/preferences.md",
      memoryLines: ["- Prefers boutique hotels [YYYY-MM].", "- Avoids large hotel chains [YYYY-MM]."],
    },
    {
      userMessage: "What time is sunset in Rome next Friday?",
      shouldStore: false,
      reason: "One-off lookup, no lasting value.",
      targetFile: null,
      memoryLines: [],
    },
    {
      userMessage: "Actually, I am more into city breaks than resorts now.",
      shouldStore: true,
      reason: "Patches an older preference.",
      targetFile: "user/preferences.md",
      memoryLines: ["- Prefers city breaks [YYYY-MM].", "- (replaced resort preference)"],
    },
  ],
  sharedMemoryIdeas: ["Product features", "Safety rules", "Common queries", "Partner APIs"],
  rawToolNote: "Raw tools are for deterministic file control; agentic tools should handle normal memory flows.",
}

function clampText(value: string, max: number) {
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (trimmed.length <= max) return trimmed
  const sentenceEnd = Math.max(
    trimmed.lastIndexOf(". ", max),
    trimmed.lastIndexOf("! ", max),
    trimmed.lastIndexOf("? ", max),
  )
  if (sentenceEnd > 40) return trimmed.slice(0, sentenceEnd + 1)
  return `${trimmed.slice(0, max - 1).trimEnd()}...`
}

function splitGuidance(value: string) {
  return value
    .split(/\n|•|-/)
    .map((line) => clampText(line.replace(/^\s*\d+[\.)]\s*/, ""), 120))
    .filter(Boolean)
    .slice(0, 3)
}

function exampleKind(example: SetupExample, index: number) {
  if (!example.shouldStore) return { label: "IGNORE", color: "gray" }
  if (index === 2 || /supersede|update|patch|correct/i.test(example.reason + example.memoryLines.join(" "))) {
    return { label: "PATCH", color: "blue" }
  }
  return { label: "STORE", color: "green" }
}

function StepNote({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Paper withBorder p="md" radius="sm" style={{ background: "rgba(255,255,255,0.76)" }}>
      <Stack gap={4}>
        <Text size="xs" fw={700} c="blue.7" tt="uppercase">
          {title ?? "What happens here"}
        </Text>
        <Text size="sm" c="gray.7" style={{ lineHeight: 1.5 }}>{children}</Text>
      </Stack>
    </Paper>
  )
}

function ProgressLabel({ step, label }: { step: string; label: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="gray.5" fw={650}>{step}</Text>
      <Title order={3} fw={650}>{label}</Title>
    </Stack>
  )
}

function MemoryMap() {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      <Paper withBorder p="md" radius="sm">
        <Stack gap="xs">
          <Text size="sm" fw={700}>Memory Map</Text>
          <Box ff="monospace" fz={12} c="gray.8" style={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
            {"shared/ (written now)\n  index.md\n  user-memory.md\n  domain.md\n\nfuture user/ (not written now)\n  index.md\n  preferences.md\n  constraints.md"}
          </Box>
        </Stack>
      </Paper>
      <Paper withBorder p="md" radius="sm">
        <Stack gap="xs">
          <Text size="sm" fw={700}>Agent Boundaries</Text>
          {[
            "Read shared guidance",
            "Write private memory only under each user",
            "Cannot write shared/",
            "Revisions record writes",
            "Access logs record use",
          ].map((item) => (
            <Text key={item} size="sm" c="gray.7">- {item}</Text>
          ))}
        </Stack>
      </Paper>
    </SimpleGrid>
  )
}

function FileLabel(path: string, fallback: string) {
  if (path === "shared/index.md") return "Memory map"
  if (path === "shared/user-memory.md") return "Agent rules"
  if (path === "shared/domain.md") return "Domain rules"
  return fallback || "Shared guidance"
}

export function SetupWizard({ secret, onComplete }: { secret: string; onComplete: () => void }) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>(0)
  const [productDescription, setProductDescription] = useState("")
  const [domain, setDomain] = useState("")
  const [memorableExample, setMemorableExample] = useState("")
  const [neverStore, setNeverStore] = useState("")
  const [forgettingProblem, setForgettingProblem] = useState("")
  const [stability, setStability] = useState("")
  const [includeTimestamps, setIncludeTimestamps] = useState("yes")
  const [extra, setExtra] = useState("")
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [explanation, setExplanation] = useState<SetupExplanation | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [revisionInstruction, setRevisionInstruction] = useState("")
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [usedFallback, setUsedFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedStability = useMemo(
    () => STABILITY_OPTIONS.find((option) => option.id === stability),
    [stability],
  )

  const useFallbackSchema = (message: string) => {
    setGeneratedFiles(FALLBACK_FILES)
    setExplanation(FALLBACK_EXPLANATION)
    setUsedFallback(true)
    setError(message)
    setStep(3)
  }

  const generateFiles = async (instruction = "") => {
    setGenerating(true)
    setError(null)
    setUsedFallback(false)
    try {
      const res = await fetch("/v1/admin/setup-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-memex-admin-secret": secret },
        body: JSON.stringify({
          productDescription,
          domain,
          memorableExample: memorableExample.trim() || undefined,
          neverStore: neverStore.trim() || undefined,
          forgettingProblem: forgettingProblem.trim() || undefined,
          stability,
          includeTimestamps: includeTimestamps === "yes",
          extra: extra.trim() || undefined,
          revisionInstruction: instruction.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 404 || res.status === 503) {
          useFallbackSchema(body?.error?.message ?? "LLM setup generation is unavailable, so MemexAI drafted a default schema you can apply.")
          return
        }
        throw new Error(body?.error?.message ?? "Generation failed")
      }
      setGeneratedFiles(body.files)
      setExplanation(body.explanation ?? null)
      setRevisionInstruction("")
      setStep(3)
    } catch (err) {
      useFallbackSchema(err instanceof Error ? err.message : "Generation failed, so MemexAI drafted a default schema you can apply.")
    } finally {
      setGenerating(false)
    }
  }

  const applyAll = async () => {
    setApplying(true)
    setError(null)
    try {
      for (const file of generatedFiles) {
        const res = await fetch(`/v1/admin/files/${encodeURIComponent(file.path)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-memex-admin-secret": secret },
          body: JSON.stringify({ content: file.content, reason: "Initial setup via setup wizard" }),
        })
        if (!res.ok) {
          const body = await res.json()
          throw new Error(body?.error?.message ?? `Failed to write ${file.path}`)
        }
      }
      // Invalidate the file list and shared/index.md content so the setup
      // completion check in main.tsx sees fresh data when navigating away.
      await queryClient.invalidateQueries()
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed")
    } finally {
      setApplying(false)
    }
  }

  if (step === 0) {
    return (
      <Box h="100%" style={{ overflowY: "auto" }} p={{ base: "lg", md: "xl" }}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "xl", md: 48 }} maw={980} mx="auto" h="100%" style={{ alignItems: "center" }}>
          <Box
            h={{ base: 260, md: 440 }}
            style={{
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--mantine-color-gray-2)",
              background: "linear-gradient(135deg, #edf7f5, #f8fbff)",
            }}
          >
            <img
              src={welcomeImage}
              alt="Abstract memory paths connecting an admin console to private user memories"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </Box>
          <Stack gap="xl">
            <Stack gap="sm">
              <Badge variant="light" color="blue" w="fit-content">First-time setup</Badge>
              <Title order={1} fw={720} style={{ lineHeight: 1.08 }}>Welcome to MemexAI Admin</Title>
              <Text c="gray.7" size="md" style={{ lineHeight: 1.65 }}>
                Set up how agents remember user facts for your product. You will define product context,
                choose what memory matters, review an LLM-drafted memory plan, then apply it when ready.
              </Text>
            </Stack>
            <StepNote title="Before we start">
              Nothing is written until you review and apply the plan. The wizard drafts shared agent guidance files;
              private user memory is created later only when agents use memory tools.
            </StepNote>
            <Button size="md" w="fit-content" onClick={() => setStep(1)}>Configure agent memory</Button>
          </Stack>
        </SimpleGrid>
      </Box>
    )
  }

  if (step === 1) {
    return (
      <Box h="100%" style={{ overflowY: "auto" }} p="xl">
        <Stack maw={680} mx="auto" gap="xl">
          <ProgressLabel step="Step 1 of 3 - Product Context" label="Teach MemexAI what your product does" />
          <StepNote>
            We use this description to draft shared agent guidance for your agents. You can review and change
            everything before applying.
          </StepNote>
          <Stack gap="sm">
            <Text size="sm" fw={650}>What does your product do?</Text>
            <Text size="xs" c="gray.6">
              One sentence is enough. Example: "A real estate assistant helping renters compare apartments."
            </Text>
            <Textarea
              placeholder='e.g. "A shopping assistant that learns style and suggests products"'
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              minRows={4}
              autosize
            />
          </Stack>
          <Stack gap="sm">
            <Text size="sm" fw={650}>Product space</Text>
            <Group gap="sm" wrap="wrap">
              {DOMAINS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setDomain(d)}
                  style={{
                    ...(domain === d ? OPTION_SELECTED_STYLE : OPTION_DEFAULT_STYLE),
                    padding: "8px var(--mantine-spacing-md)",
                  }}
                >
                  <Text size="sm" c={domain === d ? "blue.7" : "gray.7"}>{d}</Text>
                </button>
              ))}
            </Group>
          </Stack>
          <Group justify="flex-end">
            <Button
              disabled={!productDescription.trim() || !domain}
              onClick={() => setStep(2)}
            >
              Next
            </Button>
          </Group>
        </Stack>
      </Box>
    )
  }

  if (step === 2) {
    return (
      <Box h="100%" style={{ overflowY: "auto" }} p="xl">
        <Stack maw={760} mx="auto" gap="xl">
          <ProgressLabel step="Step 2 of 3 - Memory Behavior" label="Show agents what good memory looks like" />
          <StepNote>
            Concrete examples work better than abstract categories. Describe real interactions from your product — the
            generator will infer what to store, what to ignore, and how to structure user files from them.
          </StepNote>

          <Stack gap="sm">
            <Text size="sm" fw={650}>Give an example of something a user might say that agents should definitely remember.</Text>
            <Text size="xs" c="gray.6">
              Think of a real message in your product that carries a durable fact. The more specific, the better.
            </Text>
            <Textarea
              placeholder='e.g. "I have a nut allergy and a monthly budget of ₹40k" or "I prefer morning calls, I work from home on Tuesdays"'
              value={memorableExample}
              onChange={(e) => setMemorableExample(e.target.value)}
              minRows={3}
              autosize
            />
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={650}>What should agents never store from your users?</Text>
            <Text size="xs" c="gray.6">
              Privacy rules, irrelevant chatter, one-off lookups, or anything that would clutter memory over time.
            </Text>
            <Textarea
              placeholder='e.g. "One-off searches, credit card details, venting messages, or queries that have no impact on future recommendations"'
              value={neverStore}
              onChange={(e) => setNeverStore(e.target.value)}
              minRows={2}
              autosize
            />
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={650}>What goes wrong when your agent forgets user context?</Text>
            <Text size="xs" c="gray.6">
              Describe the worst-case experience. This helps the schema prioritize the right facts.
            </Text>
            <Textarea
              placeholder='e.g. "Recommending expensive options to budget-conscious users" or "Asking the same onboarding questions on every session"'
              value={forgettingProblem}
              onChange={(e) => setForgettingProblem(e.target.value)}
              minRows={2}
              autosize
            />
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={650}>How stable is the information your agents will remember?</Text>
            <Text size="xs" c="gray.6">
              This sets how aggressively agents should patch vs. accumulate facts over time.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {STABILITY_OPTIONS.map((opt) => {
                const selected = stability === opt.id
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setStability(opt.id)}
                    style={{
                      ...(selected ? OPTION_SELECTED_STYLE : OPTION_DEFAULT_STYLE),
                      padding: "var(--mantine-spacing-md)",
                      textAlign: "left",
                    }}
                  >
                    <Stack gap={4}>
                      <Text size="sm" fw={650}>{opt.label}</Text>
                      <Text size="xs" c="gray.6">{opt.hint}</Text>
                    </Stack>
                  </button>
                )
              })}
            </SimpleGrid>
            {selectedStability && <Text size="xs" c="gray.6">Selected: {selectedStability.hint}</Text>}
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={650}>Should agents stamp facts with when they were learned?</Text>
            <Text size="xs" c="gray.6">
              Without line-level diffs in memory files, a timestamp inline is the only way to know when a belief was formed.
              Example: <Text span ff="monospace" size="xs">- Prefers boutique hotels [2025-01]</Text>
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {TIMESTAMP_OPTIONS.map((opt) => {
                const selected = includeTimestamps === opt.id
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => setIncludeTimestamps(opt.id)}
                    style={{
                      ...(selected ? OPTION_SELECTED_STYLE : OPTION_DEFAULT_STYLE),
                      padding: "var(--mantine-spacing-md)",
                      textAlign: "left",
                    }}
                  >
                    <Stack gap={4}>
                      <Text size="sm" fw={650}>{opt.label}</Text>
                      <Text size="xs" c="gray.6">{opt.hint}</Text>
                    </Stack>
                  </button>
                )
              })}
            </SimpleGrid>
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={650}>Anything else agents should know? <Text span c="gray.5" fw={400}>(optional)</Text></Text>
            <Textarea
              placeholder='e.g. "Agents interact primarily with first-time buyers; never assume prior real-estate experience."'
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              minRows={2}
              autosize
            />
          </Stack>

          {error && <Text size="sm" c="red">{error}</Text>}

          <Group justify="space-between">
            <Button variant="subtle" color="gray" onClick={() => setStep(1)}>Back</Button>
            <Button
              loading={generating}
              disabled={!stability}
              onClick={() => generateFiles()}
            >
              Draft schema
            </Button>
          </Group>
        </Stack>
      </Box>
    )
  }

  if (step === 3) {
    const guidance = splitGuidance(explanation?.schemaGuidance ?? "")
    const examples = (explanation?.examples.length ? explanation.examples : FALLBACK_EXPLANATION.examples).slice(0, 3)
    const sharedIdeas = (explanation?.sharedMemoryIdeas.length ? explanation.sharedMemoryIdeas : FALLBACK_EXPLANATION.sharedMemoryIdeas).slice(0, 4)

    return (
      <Box h="100%" style={{ overflowY: "auto" }} p="xl">
        <Stack maw={980} mx="auto" gap="xl">
          <ProgressLabel step="Step 3 of 3 - Agentic Memory Schema" label="Review the drafted agent memory plan" />
          <StepNote>
            MemexAI drafted this memory schema with an LLM from your answers. It will write shared agent guidance
            files, not private user memories. Review what agents will store, where it goes, and ask for changes before applying.
          </StepNote>
          {usedFallback && error && (
            <Paper withBorder p="md" radius="sm" style={{ background: "var(--mantine-color-yellow-0)" }}>
              <Text size="sm" c="yellow.9">{error}</Text>
            </Paper>
          )}

          <Paper withBorder p="lg" radius="sm">
            <Stack gap="md">
              <Stack gap={4}>
                <Text size="sm" fw={700}>Schema summary</Text>
                <Text size="xs" c="gray.6">
                  Here, schema means shared instructions and future user-memory file patterns agents follow.
                </Text>
                <Text size="sm" c="gray.7" style={{ lineHeight: 1.55 }}>
                  {clampText(explanation?.summary ?? FALLBACK_EXPLANATION.summary, 180)}
                </Text>
              </Stack>
              <Stack gap={6}>
                <Text size="sm" fw={700}>Agent rules</Text>
                {(guidance.length ? guidance : splitGuidance(FALLBACK_EXPLANATION.schemaGuidance)).map((line) => (
                  <Text key={line} size="sm" c="gray.7">- {line}</Text>
                ))}
              </Stack>
              <MemoryMap />
            </Stack>
          </Paper>

          <Paper withBorder p="lg" radius="sm">
            <Stack gap="md">
              <Text size="sm" fw={700}>Quick examples</Text>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                {examples.map((example, index) => {
                  const kind = exampleKind(example, index)
                  return (
                    <Box
                      key={`${example.userMessage}-${index}`}
                      p="md"
                      style={{
                        border: "1px solid var(--mantine-color-gray-2)",
                        borderRadius: 8,
                        background: kind.color === "green" ? "var(--mantine-color-green-0)" : kind.color === "blue" ? "var(--mantine-color-blue-0)" : "var(--mantine-color-gray-0)",
                        minHeight: 178,
                      }}
                    >
                      <Stack gap="xs">
                        <Group gap="xs" align="flex-start" wrap="nowrap">
                          <Badge size="sm" color={kind.color}>{kind.label}</Badge>
                          <Text size="sm" fw={650} style={{ lineHeight: 1.4 }}>"{clampText(example.userMessage, 95)}"</Text>
                        </Group>
                        {example.targetFile ? (
                          <Text size="xs" c="gray.7">Target: <Text span ff="monospace">{example.targetFile}</Text></Text>
                        ) : (
                          <Text size="xs" c="gray.7">{clampText(example.reason, 72)}</Text>
                        )}
                        {example.memoryLines.slice(0, 2).map((line) => (
                          <Text key={line} size="xs" c="gray.7">- {clampText(line.replace(/^-\s*/, ""), 72)}</Text>
                        ))}
                      </Stack>
                    </Box>
                  )
                })}
              </SimpleGrid>
            </Stack>
          </Paper>

          <Paper withBorder p="lg" radius="sm">
            <Stack gap="md">
              <Stack gap={4}>
                <Text size="sm" fw={700}>Ask for a change</Text>
                <Text size="xs" c="gray.6">
                  Regeneration replaces this draft before anything is written. Keep it direct, like "make budget a hard constraint."
                </Text>
              </Stack>
              <Textarea
                placeholder="e.g. Make budget a hard constraint, not a preference"
                value={revisionInstruction}
                onChange={(event) => setRevisionInstruction(event.currentTarget.value)}
                minRows={2}
                autosize
              />
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Text size="xs" c="gray.6">Optional shared files</Text>
                  {sharedIdeas.map((idea) => (
                    <Badge key={idea} variant="light" color="gray">{clampText(idea, 28)}</Badge>
                  ))}
                </Group>
                <Button
                  variant="light"
                  loading={generating}
                  disabled={!revisionInstruction.trim()}
                  onClick={() => generateFiles(revisionInstruction)}
                >
                  Regenerate draft with changes
                </Button>
              </Group>
              {explanation?.rawToolNote && (
                <Text size="xs" c="gray.6">{clampText(explanation.rawToolNote, 150)}</Text>
              )}
            </Stack>
          </Paper>

          <Paper withBorder p="lg" radius="sm">
            <Stack gap="sm">
              <Text size="sm" fw={700}>Shared files that will be written</Text>
              <Text size="xs" c="gray.6">
                These shared files are readable by agents across users. Future `user/` files are not created during setup.
              </Text>
              {generatedFiles.map((file) => (
                <Box key={file.path} py="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-1)" }}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text size="sm" fw={650} ff="monospace">{file.path}</Text>
                      <Text size="sm" c="gray.6">{FileLabel(file.path, file.purpose ?? "")}</Text>
                    </Group>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
                    >
                      {expandedFile === file.path ? "Hide" : "Preview"}
                    </Button>
                  </Group>
                  {expandedFile === file.path && (
                    <Box
                      mt="sm"
                      p="sm"
                      style={{
                        background: "var(--mantine-color-gray-0)",
                        borderRadius: 6,
                        fontFamily: "monospace",
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        maxHeight: 260,
                        overflowY: "auto",
                      }}
                    >
                      {file.content}
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>

          {error && !usedFallback && <Text size="sm" c="red">{error}</Text>}

          <Group justify="space-between">
            <Button variant="subtle" color="gray" onClick={() => setStep(2)}>Back</Button>
            <Button loading={applying} onClick={applyAll}>Apply shared memory guidance</Button>
          </Group>
        </Stack>
      </Box>
    )
  }

  return (
    <Box h="100%" style={{ overflowY: "auto" }} p="xl">
      <Stack gap="xl" maw={920} mx="auto">
        <Stack gap="xs">
          <Title order={2} fw={650}>Agent memory guidance applied</Title>
          <Text c="gray.6" size="sm" style={{ lineHeight: 1.6 }}>
            Agents can now read shared guidance before saving durable facts for each user.
            No private user memories were created during setup.
          </Text>
        </Stack>

        <StepNote title="What happened">
          Setup wrote shared agent guidance files and marked onboarding complete. New agent requests can use this
          guidance immediately through the prompt block.
        </StepNote>

        <Stack gap="sm">
          <Text size="sm" fw={700}>Best next steps</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Paper withBorder p="md" radius="sm">
              <Stack gap="xs">
                <Text size="sm" fw={700}>View files</Text>
                <Text size="xs" c="gray.6">Inspect and edit the generated files as your policy evolves.</Text>
                <Button size="xs" onClick={onComplete}>Open files</Button>
              </Stack>
            </Paper>
            <Paper withBorder p="md" radius="sm">
              <Stack gap="xs">
                <Text size="sm" fw={700}>Observe activity</Text>
                <Text size="xs" c="gray.6">Watch reads, writes, revisions, and schema signals once agents run.</Text>
                <Button size="xs" variant="light" onClick={() => { window.location.href = "/admin/observability" }}>
                  Open observability
                </Button>
              </Stack>
            </Paper>
            <Paper withBorder p="md" radius="sm">
              <Stack gap="xs">
                <Text size="sm" fw={700}>Test playground</Text>
                <Text size="xs" c="gray.6">Simulate memorize and search against a demo user before wiring agents.</Text>
                <Button size="xs" variant="light" onClick={() => { window.location.href = "/admin/playground" }}>
                  Test now
                </Button>
              </Stack>
            </Paper>
            <Paper withBorder p="md" radius="sm">
              <Stack gap="xs">
                <Text size="sm" fw={700}>Join Slack</Text>
                <Text size="xs" c="gray.6">Ask setup questions, share memory patterns, and get product support.</Text>
                <Button size="xs" variant="light" component="a" href={SLACK_INVITE_URL} target="_blank" rel="noreferrer">
                  Join community
                </Button>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Stack>

        <AdminProfilePanel />

        <Paper withBorder p="md" radius="sm">
          <Group justify="space-between" align="center">
            <Text size="xs" c="gray.6">
              Dreams can clean up growing user memory in the background when you are ready.
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="subtle" onClick={() => { window.location.href = "/admin/dreams" }}>
                Set up dreaming
              </Button>
              <Anchor href="https://memexai.space/docs/concepts/access-logs" target="_blank" size="xs">
                Access log docs
              </Anchor>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  )
}
