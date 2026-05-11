import "@mantine/core/styles.css"
import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  MantineProvider,
  Menu,
  Modal,
  PasswordInput,
  Stack,
  Title,
} from "@mantine/core"
import { useState, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { useAdminData } from "./hooks"
import { DotsHorizontalIcon } from "./icons"
import { FilesView } from "./components/FilesView"
import { UsersView, RevisionsView, AccessLogsView } from "./components/TableViews"
import { AdminSpotlight, SpotlightTrigger } from "./components/Spotlight"
import type { AdminFile, Overlay } from "./types"

const storageKey = "memexai.adminSecret"

function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem(storageKey) ?? "")
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const { data: filesData } = useAdminData<{ files: AdminFile[] }>(
    secret ? "/v1/admin/files" : null,
    secret,
  )
  const files = useMemo(() => filesData?.files ?? [], [filesData])

  const signOut = () => {
    localStorage.removeItem(storageKey)
    setSecret("")
  }

  if (!secret) {
    return (
      <SecretGate onSubmit={(value) => {
        localStorage.setItem(storageKey, value)
        setSecret(value)
      }} />
    )
  }

  return (
    <MantineProvider defaultColorScheme="light">
      <AdminSpotlight
        files={files}
        onSelectFile={setSelectedPath}
        onOpenOverlay={setOverlay}
      />

      <AppShell
        header={{ height: 56 }}
        padding={0}
        styles={{
          root: { height: "100vh", background: "var(--mantine-color-gray-0)" },
          header: { borderBottom: "1px solid var(--mantine-color-gray-2)" },
          main: { height: "calc(100vh - 56px)", minHeight: 0, paddingTop: 56 },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
            <Box miw={200}>
              <Title order={3} size="h4" fw={600}>MemexAI Admin</Title>
            </Box>
            <Group gap={4}>
              <SpotlightTrigger />
              <Menu shadow="md" width={180} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="md" aria-label="More options">
                    <DotsHorizontalIcon />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => setOverlay("users")}>Users</Menu.Item>
                  <Menu.Item onClick={() => setOverlay("revisions")}>Revisions</Menu.Item>
                  <Menu.Item onClick={() => setOverlay("logs")}>Access Logs</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={signOut}>Sign out</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          <FilesView
            secret={secret}
            selectedPath={selectedPath}
            onSelectPath={setSelectedPath}
          />
        </AppShell.Main>
      </AppShell>

      <Modal opened={overlay === "users"} onClose={() => setOverlay(null)} title="Users" size="xl">
        <Box h="60vh" style={{ minHeight: 0 }}>
          <UsersView secret={secret} />
        </Box>
      </Modal>
      <Modal opened={overlay === "revisions"} onClose={() => setOverlay(null)} title="Revisions" size="xl">
        <Box h="60vh" style={{ minHeight: 0 }}>
          <RevisionsView secret={secret} physicalPath={null} />
        </Box>
      </Modal>
      <Modal opened={overlay === "logs"} onClose={() => setOverlay(null)} title="Access Logs" size="xl">
        <Box h="60vh" style={{ minHeight: 0 }}>
          <AccessLogsView secret={secret} physicalPath={null} />
        </Box>
      </Modal>
    </MantineProvider>
  )
}

function SecretGate({ onSubmit }: { onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("")
  return (
    <MantineProvider defaultColorScheme="light">
      <Box maw={420} mx="auto" mt={96} p="lg">
        <Stack gap="md">
          <Title order={2}>MemexAI Admin</Title>
          <PasswordInput
            label="Admin secret"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim()) onSubmit(value.trim())
            }}
          />
          <Button disabled={!value.trim()} onClick={() => onSubmit(value.trim())}>Continue</Button>
        </Stack>
      </Box>
    </MantineProvider>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
