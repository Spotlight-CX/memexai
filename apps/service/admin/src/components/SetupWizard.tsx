import {
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
  UnstyledButton,
} from "@mantine/core"
import { useState } from "react"

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

const USER_INFO_CATEGORIES = [
  { id: "preferences", label: "Preferences & tastes" },
  { id: "constraints", label: "Hard constraints (what they won't accept)" },
  { id: "goals", label: "Goals & active intentions" },
  { id: "history", label: "Past activity / history" },
  { id: "context", label: "Personal context (lifestyle, family, etc.)" },
]

const STABILITY_OPTIONS = [
  { id: "volatile", label: "Changes often — preferences shift a lot" },
  { id: "evolving", label: "Mostly stable — evolves gradually" },
  { id: "static", label: "Set once — rarely changes after onboarding" },
]

type Step = 0 | 1 | 2 | 3 | 4
type GeneratedFile = { path: string; content: string }

const OPTION_SELECTED_STYLE = {
  borderRadius: 8,
  border: "1.5px solid var(--mantine-color-blue-5)",
  background: "var(--mantine-color-blue-0)",
  cursor: "pointer",
} as const

const OPTION_DEFAULT_STYLE = {
  borderRadius: 8,
  border: "1.5px solid var(--mantine-color-gray-3)",
  background: "white",
  cursor: "pointer",
} as const

export function SetupWizard({ secret, onComplete }: { secret: string; onComplete: () => void }) {
  const [step, setStep] = useState<Step>(0)
  const [productDescription, setProductDescription] = useState("")
  const [domain, setDomain] = useState("")
  const [userInfoCategories, setUserInfoCategories] = useState<string[]>([])
  const [stability, setStability] = useState("")
  const [extra, setExtra] = useState("")
  const [questionIndex, setQuestionIndex] = useState(0)
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleCategory = (id: string) => {
    setUserInfoCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const generateFiles = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/v1/admin/setup-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-memex-admin-secret": secret },
        body: JSON.stringify({ productDescription, domain, userInfoCategories, extra: extra || undefined }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message ?? "Generation failed")
      setGeneratedFiles(body.files)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
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
      await fetch(`/v1/admin/files/${encodeURIComponent("shared/.setup-complete")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-memex-admin-secret": secret },
        body: JSON.stringify({
          content: `Setup completed at ${new Date().toISOString()}\n\nProduct: ${productDescription}\nDomain: ${domain}`,
          reason: "Setup wizard complete",
        }),
      })
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed")
    } finally {
      setApplying(false)
    }
  }

  if (step === 0) {
    return (
      <Box h="100%" display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
        <Stack align="center" gap="xl" maw={480} px="lg">
          <Stack gap="xs" align="center">
            <Title order={2} fw={600}>Welcome to MemexAI</Title>
            <Text c="gray.6" ta="center" size="sm">
              Let's configure how agents manage memory for your product. Takes about 2 minutes.
            </Text>
          </Stack>
          <Button size="md" onClick={() => setStep(1)}>Get started</Button>
        </Stack>
      </Box>
    )
  }

  if (step === 1) {
    return (
      <Box h="100%" style={{ overflowY: "auto" }} p="xl">
        <Stack maw={520} mx="auto" gap="xl">
          <Stack gap="xs">
            <Text size="xs" c="gray.5" fw={500}>Step 1 of 3 — Your product</Text>
            <Title order={3} fw={600}>What does your product do?</Title>
          </Stack>
          <Textarea
            placeholder='e.g. "A shopping assistant that learns your style and suggests products"'
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            minRows={3}
            autosize
          />
          <Stack gap="sm">
            <Text size="sm" c="gray.6">What space does it operate in?</Text>
            <Group gap="sm" wrap="wrap">
              {DOMAINS.map((d) => (
                <UnstyledButton
                  key={d}
                  onClick={() => setDomain(d)}
                  px="md"
                  py={8}
                  style={domain === d ? OPTION_SELECTED_STYLE : OPTION_DEFAULT_STYLE}
                >
                  <Text size="sm" c={domain === d ? "blue.7" : "gray.7"}>{d}</Text>
                </UnstyledButton>
              ))}
            </Group>
          </Stack>
          <Group justify="flex-end">
            <Button
              disabled={!productDescription.trim() || !domain}
              onClick={() => { setQuestionIndex(0); setStep(2) }}
            >
              Next →
            </Button>
          </Group>
        </Stack>
      </Box>
    )
  }

  if (step === 2) {
    return (
      <Box h="100%" display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
        <Stack maw={520} w="100%" px="lg" gap="xl">
          <Text size="xs" c="gray.5" fw={500}>
            Step 2 of 3 — Question {questionIndex + 1} of 3
          </Text>

          {questionIndex === 0 && (
            <Stack gap="md">
              <Title order={3} fw={600}>What does your product learn about each user?</Title>
              <Text size="sm" c="gray.6">Select all that apply</Text>
              <Stack gap="xs">
                {USER_INFO_CATEGORIES.map((cat) => {
                  const selected = userInfoCategories.includes(cat.id)
                  return (
                    <UnstyledButton
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      p="md"
                      style={selected ? OPTION_SELECTED_STYLE : OPTION_DEFAULT_STYLE}
                    >
                      <Group gap="sm">
                        <Box
                          w={18} h={18}
                          style={{
                            borderRadius: 4,
                            border: `2px solid ${selected ? "var(--mantine-color-blue-5)" : "var(--mantine-color-gray-4)"}`,
                            background: selected ? "var(--mantine-color-blue-5)" : "white",
                            flexShrink: 0,
                          }}
                        />
                        <Text size="sm">{cat.label}</Text>
                      </Group>
                    </UnstyledButton>
                  )
                })}
              </Stack>
            </Stack>
          )}

          {questionIndex === 1 && (
            <Stack gap="md">
              <Title order={3} fw={600}>How stable is the information your users share?</Title>
              <Stack gap="xs">
                {STABILITY_OPTIONS.map((opt) => {
                  const selected = stability === opt.id
                  return (
                    <UnstyledButton
                      key={opt.id}
                      onClick={() => setStability(opt.id)}
                      p="md"
                      style={selected ? OPTION_SELECTED_STYLE : OPTION_DEFAULT_STYLE}
                    >
                      <Text size="sm">{opt.label}</Text>
                    </UnstyledButton>
                  )
                })}
              </Stack>
            </Stack>
          )}

          {questionIndex === 2 && (
            <Stack gap="md">
              <Title order={3} fw={600}>Anything specific agents should always track?</Title>
              <Text size="sm" c="gray.6">Optional — describe in your own words</Text>
              <Textarea
                placeholder='e.g. "how they want to be addressed, key people they mention, recurring topics they care about"'
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                minRows={3}
                autosize
              />
            </Stack>
          )}

          {error && <Text size="sm" c="red">{error}</Text>}

          <Group justify="space-between">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                if (questionIndex === 0) setStep(1)
                else setQuestionIndex((q) => (q - 1) as 0 | 1 | 2)
              }}
            >
              ← Back
            </Button>
            {questionIndex < 2 ? (
              <Button
                disabled={
                  (questionIndex === 0 && userInfoCategories.length === 0) ||
                  (questionIndex === 1 && !stability)
                }
                onClick={() => setQuestionIndex((q) => (q + 1) as 1 | 2)}
              >
                → Continue
              </Button>
            ) : (
              <Button loading={generating} onClick={generateFiles}>
                → Continue
              </Button>
            )}
          </Group>
        </Stack>
      </Box>
    )
  }

  if (step === 3) {
    return (
      <Box h="100%" style={{ overflowY: "auto" }} p="xl">
        <Stack maw={680} mx="auto" gap="xl">
          <Stack gap="xs">
            <Text size="xs" c="gray.5" fw={500}>Step 3 of 3 — Review</Text>
            <Title order={3} fw={600}>Here's your memory configuration</Title>
            <Text size="sm" c="gray.6">
              Review the files that will be created or updated, then apply all.
            </Text>
          </Stack>

          <Stack gap="md">
            {generatedFiles.map((file) => (
              <Paper key={file.path} withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text size="sm" fw={600} ff="monospace">{file.path}</Text>
                    <UnstyledButton
                      onClick={() => setExpandedFile(expandedFile === file.path ? null : file.path)}
                    >
                      <Text size="xs" c="blue.6">{expandedFile === file.path ? "hide" : "preview"}</Text>
                    </UnstyledButton>
                  </Group>
                  {expandedFile === file.path && (
                    <Box
                      p="sm"
                      style={{
                        background: "var(--mantine-color-gray-0)",
                        borderRadius: 6,
                        fontFamily: "monospace",
                        fontSize: 12,
                        whiteSpace: "pre-wrap",
                        maxHeight: 300,
                        overflowY: "auto",
                      }}
                    >
                      {file.content}
                    </Box>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>

          {error && <Text size="sm" c="red">{error}</Text>}

          <Group justify="space-between">
            <Button variant="subtle" color="gray" onClick={() => setStep(2)}>← Back</Button>
            <Button loading={applying} onClick={applyAll}>Apply all</Button>
          </Group>
        </Stack>
      </Box>
    )
  }

  return (
    <Box h="100%" display="flex" style={{ alignItems: "center", justifyContent: "center" }}>
      <Stack align="center" gap="xl" maw={480} px="lg">
        <Stack gap="xs" align="center">
          <Title order={2} fw={600}>All set!</Title>
          <Text c="gray.6" ta="center" size="sm">
            Agents will now use your memory configuration. You can refine it anytime from the Configure tab.
          </Text>
        </Stack>
        <Button onClick={onComplete}>Go to admin →</Button>
      </Stack>
    </Box>
  )
}
