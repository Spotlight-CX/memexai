import { Anchor, Box, Button, Code, Divider, Group, Modal, Stack, Text, Title } from "@mantine/core"
import { useState } from "react"
import { AdminProfilePanel } from "./WelcomeModal"

const SETUP_PROMPT = "Read https://memexai.space/docs/setup and configure MemexAI memory for this project using the admin CLI."

export function FirstRunModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copyPrompt() {
    navigator.clipboard.writeText(SETUP_PROMPT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      radius="sm"
      padding="xl"
      centered
      title={
        <Title order={4} fw={700}>Memory files are at their defaults</Title>
      }
    >
      <Stack gap="xl">
        <Stack gap="sm">
          <Text size="sm" c="gray.7" style={{ lineHeight: 1.6 }}>
            The shared memory files haven't been customized yet. Most teams set this up
            from a coding agent — paste the prompt below into Claude Code, Cursor, or any
            coding assistant and it will configure everything via the admin CLI.
          </Text>
          <Box
            p="md"
            style={{
              background: "var(--mantine-color-gray-0)",
              border: "1px solid var(--mantine-color-gray-2)",
              borderRadius: 8,
            }}
          >
            <Stack gap="xs">
              <Text size="xs" fw={650} c="gray.5" tt="uppercase">Paste into your coding agent</Text>
              <Code block style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {SETUP_PROMPT}
              </Code>
            </Stack>
          </Box>
          <Group gap="sm">
            <Button size="xs" variant="light" onClick={copyPrompt}>
              {copied ? "Copied!" : "Copy prompt"}
            </Button>
            <Anchor href="https://memexai.space/docs/setup" target="_blank" size="xs">
              Read the setup guide →
            </Anchor>
          </Group>
        </Stack>

        <Divider label="Optional: tell us who's using this" labelPosition="center" />

        <AdminProfilePanel onDone={onClose} />
      </Stack>
    </Modal>
  )
}
