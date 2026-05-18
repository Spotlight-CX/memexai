import "@mantine/core/styles.css"
import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  MantineProvider,
  Menu,
  Modal,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core"
import { useState, useMemo } from "react"
import { createRoot } from "react-dom/client"
import { useAdminData } from "./hooks"
import { DotsHorizontalIcon } from "./icons"
import { FilesView } from "./components/FilesView"
import { SecretGate } from "./components/SecretGate"
import { ToolPlayground } from "./components/ToolPlayground"
import { WelcomeModal } from "./components/WelcomeModal"
import { UsersView, RevisionsView, AccessLogsView } from "./components/TableViews"
import { AdminSpotlight, SpotlightTrigger } from "./components/Spotlight"
import type { AdminFile, Overlay } from "./types"

type Page = "files" | "playground"

const ADMIN_SECRET_KEY = "memexai.adminSecret"
const API_KEY_KEY = "memexai.apiKey"

function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem(ADMIN_SECRET_KEY) ?? "")
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_KEY) ?? "")
  const [gateError, setGateError] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<Page>("files")

  const { data: filesData } = useAdminData<{ files: AdminFile[] }>(
    secret ? "/v1/admin/files" : null,
    secret,
  )
  const files = useMemo(() => filesData?.files ?? [], [filesData])

  const signOut = () => {
    localStorage.removeItem(ADMIN_SECRET_KEY)
    localStorage.removeItem(API_KEY_KEY)
    setSecret("")
    setApiKey("")
    setGateError(null)
  }

  const handleApiKeyInvalid = () => {
    localStorage.removeItem(API_KEY_KEY)
    setApiKey("")
    setSecret("")
    localStorage.removeItem(ADMIN_SECRET_KEY)
    setGateError("API key rejected — check the MEMEX_API_KEY value in your container environment.")
  }

  if (!secret) {
    return (
      <SecretGate
        error={gateError}
        onSubmit={({ secret: s, apiKey: k }) => {
          localStorage.setItem(ADMIN_SECRET_KEY, s)
          localStorage.setItem(API_KEY_KEY, k)
          setGateError(null)
          setSecret(s)
          setApiKey(k)
        }}
      />
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
            <ToolPlayground apiKey={apiKey} onApiKeyInvalid={handleApiKeyInvalid} />
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


createRoot(document.getElementById("root")!).render(<App />)
