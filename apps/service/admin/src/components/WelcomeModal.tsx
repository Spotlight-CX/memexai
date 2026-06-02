import { Box, Button, Group, Modal, Stack, Text, TextInput, ThemeIcon, Title } from "@mantine/core"
import { useForm } from "@mantine/form"
import { useEffect, useState } from "react"

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAxC6Ezy5xXPrszNu9zrIGyLtmaYFjVnxM",
  authDomain: "memexai.firebaseapp.com",
  projectId: "memexai",
  storageBucket: "memexai.firebasestorage.app",
  messagingSenderId: "960225585384",
  appId: "1:960225585384:web:3aee58fd1703286e21815d",
  measurementId: "G-MJ3JFQYC9B",
} as const

const FIREBASE_ENABLED = !!FIREBASE_CONFIG.apiKey
const WELCOME_STORAGE_KEY = "memexai.welcomed"

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

function shouldShowProfileAsk() {
  if (!FIREBASE_ENABLED) return false
  const stored = localStorage.getItem(WELCOME_STORAGE_KEY)
  if (!stored) return true
  if (stored === "done") return false
  const skippedAt = parseInt(stored, 10)
  return Number.isFinite(skippedAt) && Date.now() - skippedAt > 24 * 60 * 60 * 1000
}

function markSkipped() {
  localStorage.setItem(WELCOME_STORAGE_KEY, Date.now().toString())
}

function markDone() {
  localStorage.setItem(WELCOME_STORAGE_KEY, "done")
}

export function AdminProfilePanel({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(() => shouldShowProfileAsk())
  const [loading, setLoading] = useState(false)

  const form = useForm({
    initialValues: { name: "", email: "", company: "", role: "" },
    validate: {
      email: (value) =>
        !value.trim()
          ? "Email is required"
          : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
          ? null
          : "Enter a valid email address",
      name: (value) => (value.trim() ? null : "Name is required"),
    },
    validateInputOnBlur: true,
  })

  if (!visible) return null

  function dismiss() {
    markSkipped()
    setVisible(false)
    onDone?.()
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
              name: { stringValue: values.name },
              email: { stringValue: values.email },
              company: { stringValue: values.company },
              role: { stringValue: values.role },
              timestamp: { timestampValue: new Date().toISOString() },
            },
          }),
        },
      )
      markDone()
      setVisible(false)
      onDone?.()
    } catch {
      markDone()
      setVisible(false)
      onDone?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box component="form" onSubmit={form.onSubmit(submit)}>
      <Stack gap="lg">
        <Box>
          <Group align="center" gap="sm" mb={4}>
            <ThemeIcon variant="light" size="md" radius="sm" color="blue">
              <SparklesIcon />
            </ThemeIcon>
            <Title order={4} fw={700}>Optional: finish admin profile</Title>
          </Group>
          <Text size="sm" c="dimmed">
            This helps us understand usage. It does not change agent memory behavior.
          </Text>
        </Box>

        <Stack gap="md">
          <TextInput label="Name" placeholder="Jane Doe" radius="sm" withAsterisk {...form.getInputProps("name")} />
          <TextInput label="Work email" placeholder="jane@company.com" radius="sm" withAsterisk {...form.getInputProps("email")} />
          <TextInput label="Company" placeholder="Acme Inc." radius="sm" {...form.getInputProps("company")} />
          <TextInput label="Role" placeholder="Engineering lead" radius="sm" {...form.getInputProps("role")} />
        </Stack>

        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" size="sm" onClick={dismiss}>Skip</Button>
          <Button type="submit" size="sm" loading={loading}>Save and continue</Button>
        </Group>
      </Stack>
    </Box>
  )
}

export function WelcomeModal() {
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    if (shouldShowProfileAsk()) setOpened(true)
  }, [])

  function close() {
    markSkipped()
    setOpened(false)
  }

  return (
    <Modal opened={opened} onClose={close} withCloseButton={false} size="lg" radius="sm" padding="xl" centered>
      <AdminProfilePanel onDone={() => setOpened(false)} />
    </Modal>
  )
}
