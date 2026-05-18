import { Box, Button, MantineProvider, Paper, PasswordInput, Stack, Text, Title, Tooltip, ActionIcon, Group } from "@mantine/core"
import { useState } from "react"

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

function LabelWithInfo({ label, description }: { label: string; description: string }) {
  return (
    <Group gap={6} align="center" mb={4}>
      <Text size="sm" fw={500}>
        {label}
      </Text>
      <Tooltip label={description} position="top" withArrow transitionProps={{ transition: 'fade', duration: 200 }}>
        <ActionIcon variant="transparent" color="gray" size="xs" aria-label={description} style={{ cursor: 'help' }}>
          <InfoIcon />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

export function SecretGate({
  onSubmit,
  error,
}: {
  onSubmit: (v: { secret: string; apiKey: string }) => void
  error?: string | null
}) {
  const [secret, setSecret] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const canSubmit = secret.trim()
  const submit = () => {
    if (canSubmit) onSubmit({ secret: secret.trim(), apiKey: apiKey.trim() })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  return (
    <MantineProvider defaultColorScheme="dark">
      <style>{`
        body { margin: 0; padding: 0; overflow: hidden; background-color: #050505; }
      `}</style>
      <Box
        onMouseMove={handleMouseMove}
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: `radial-gradient(1000px circle at ${mousePos.x}px ${mousePos.y}px, rgba(45, 200, 150, 0.08), transparent 40%)`,
        }}
      >
        <Paper
          withBorder
          p={40}
          radius="md"
          shadow="xl"
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: "rgba(20, 20, 20, 0.8)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(255, 255, 255, 0.1)",
            zIndex: 1,
          }}
        >
          <Stack gap="xl">
            <Box>
              <Title order={2} fw={700} ta="center">
                MemexAI Admin
              </Title>
              <Text c="dimmed" size="sm" ta="center" mt={4}>
                Unlock your agent's memory
              </Text>
            </Box>

            {error && (
              <Text
                size="sm"
                c="red.4"
                p="sm"
                style={{
                  background: "rgba(255, 0, 0, 0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 0, 0, 0.1)",
                }}
              >
                {error}
              </Text>
            )}

            <Stack gap="md">
              <Box>
                <LabelWithInfo label="Admin Secret" description="MEMEX_ADMIN_SECRET env var" />
                <PasswordInput
                  placeholder="dev-admin-secret"
                  value={secret}
                  onChange={(e) => setSecret(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit()
                  }}
                />
              </Box>
              <Box>
                <LabelWithInfo label="Agent API Key" description="MEMEX_API_KEY env var — used by the Tool Playground" />
                <PasswordInput
                  placeholder="dev-api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit()
                  }}
                />
              </Box>
            </Stack>

            <Button
              fullWidth
              size="md"
              disabled={!canSubmit}
              onClick={submit}
              variant="filled"
              color="teal.6"
            >
              Continue
            </Button>
          </Stack>
        </Paper>
      </Box>
    </MantineProvider>
  )
}
