import { Button, Group, Modal, Stack, Text, TextInput, Title, ThemeIcon, Box } from "@mantine/core"
import { useForm } from "@mantine/form"
import { useState, useEffect } from "react"

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAxC6Ezy5xXPrszNu9zrIGyLtmaYFjVnxM",
  authDomain: "memexai.firebaseapp.com",
  projectId: "memexai",
  storageBucket: "memexai.firebasestorage.app",
  messagingSenderId: "960225585384",
  appId: "1:960225585384:web:3aee58fd1703286e21815d",
  measurementId: "G-MJ3JFQYC9B"
} as const

const FIREBASE_ENABLED = !!FIREBASE_CONFIG.apiKey

function SparklesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  )
}

export function WelcomeModal() {
  const [opened, setOpened] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    initialValues: { name: "", email: "", company: "", role: "" },
    validate: {
      email: (v) =>
        !v.trim()
          ? "Email is required"
          : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
          ? null
          : "Enter a valid email address",
      name: (v) => (v.trim() ? null : "Name is required"),
    },
    validateInputOnBlur: true,
  })

  useEffect(() => {
    if (!FIREBASE_ENABLED) return
    const stored = localStorage.getItem("memexai.welcomed")
    if (!stored) {
      setOpened(true)
      return
    }
    if (stored === "done") return
    const skippedAt = parseInt(stored, 10)
    if (Date.now() - skippedAt > 24 * 60 * 60 * 1000) {
      setOpened(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem("memexai.welcomed", Date.now().toString())
    setOpened(false)
  }

  async function submit(values: typeof form.values) {
    setLoading(true)
    try {
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/leads?key=${FIREBASE_CONFIG.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              name:      { stringValue: values.name },
              email:     { stringValue: values.email },
              company:   { stringValue: values.company },
              role:      { stringValue: values.role },
              timestamp: { timestampValue: new Date().toISOString() },
            },
          }),
        },
      )
    } catch { /* best-effort */ }
    localStorage.setItem("memexai.welcomed", "done")
    setLoading(false)
    setOpened(false)
  }

  return (
    <Modal
      opened={opened}
      onClose={dismiss}
      withCloseButton={false}
      size="lg"
      radius="lg"
      padding="xl"
      centered
    >
      <form onSubmit={form.onSubmit(submit)}>
        <Stack gap="lg">
          <Box>
            <Group justify="center" mb="md">
              <ThemeIcon variant="light" size="xl" radius="md" color="blue">
                <SparklesIcon />
              </ThemeIcon>
            </Group>
            <Title order={3} ta="center" fw={700}>Welcome to MemexAI</Title>
            <Text size="sm" c="dimmed" ta="center" mt={4} px="sm">
              We're building the future of personal knowledge. Help us shape it by sharing a bit about yourself.
            </Text>
          </Box>

          <Stack gap="md">
            <TextInput
              label="Full Name"
              placeholder="Jane Doe"
              radius="md"
              withAsterisk
              {...form.getInputProps("name")}
            />
            <TextInput
              label="Work Email"
              placeholder="jane@company.com"
              radius="md"
              withAsterisk
              {...form.getInputProps("email")}
            />
            <TextInput
              label="Organization"
              placeholder="Acme Inc."
              radius="md"
              {...form.getInputProps("company")}
            />
            <TextInput
              label="Your Role"
              placeholder="Product Designer"
              radius="md"
              {...form.getInputProps("role")}
            />
          </Stack>

          <Stack gap="xs" mt="sm">
            <Button type="submit" size="md" radius="md" loading={loading} fullWidth>
              Get Started
            </Button>
            <Button variant="subtle" color="gray" size="xs" onClick={dismiss} fullWidth>
              I'll do this later
            </Button>
          </Stack>
        </Stack>
      </form>
    </Modal>
  )
}
