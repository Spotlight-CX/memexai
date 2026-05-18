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
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core"
import { useState, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { useAdminData } from "./hooks"
import { DotsHorizontalIcon } from "./icons"
import { FilesView } from "./components/FilesView"
import { ToolPlayground } from "./components/ToolPlayground"
import { WelcomeModal } from "./components/WelcomeModal"
import { UsersView, RevisionsView, AccessLogsView } from "./components/TableViews"
import { AdminSpotlight, SpotlightTrigger } from "./components/Spotlight"
import type { AdminFile, Overlay } from "./types"

type Page = "files" | "playground"

const storageKey = "memexai.adminSecret"

function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem(storageKey) ?? "")
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page>("files")

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
            <Group gap="lg" wrap="nowrap">
              <Title order={3} size="h4" fw={600}>MemexAI Admin</Title>
              <Group gap={0}>
                {(["files", "playground"] as Page[]).map((page) => (
                  <UnstyledButton
                    key={page}
                    onClick={() => setActivePage(page)}
                    px="sm"
                    py={6}
                    style={{
                      borderBottom: activePage === page
                        ? "2px solid var(--mantine-color-blue-5)"
                        : "2px solid transparent",
                    }}
                  >
                    <Text
                      size="sm"
                      fw={activePage === page ? 600 : 400}
                      c={activePage === page ? "blue.6" : "gray.6"}
                      style={{ textTransform: "capitalize" }}
                    >
                      {page}
                    </Text>
                  </UnstyledButton>
                ))}
              </Group>
            </Group>
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
          {activePage === "files" ? (
            <FilesView
              secret={secret}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
            />
          ) : (
            <ToolPlayground />
          )}
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

      <WelcomeModal />
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
