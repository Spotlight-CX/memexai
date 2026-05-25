import "@mantine/core/styles.css"
import "@mantine/code-highlight/styles.css"
import { CodeHighlightAdapterProvider, createHighlightJsAdapter } from "@mantine/code-highlight"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import hljs from "highlight.js/lib/core"
import bash from "highlight.js/lib/languages/bash"
import json from "highlight.js/lib/languages/json"
import python from "highlight.js/lib/languages/python"
import typescript from "highlight.js/lib/languages/typescript"
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
import { useState, useMemo, useEffect } from "react"
import { createRoot } from "react-dom/client"
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { useAdminData } from "./hooks"
import { DotsHorizontalIcon, ExternalLinkIcon } from "./icons"
import { FilesView } from "./components/FilesView"
import { SecretGate } from "./components/SecretGate"
import { SetupWizard } from "./components/SetupWizard"
import { ConfigureTab } from "./components/ConfigureTab"
import { ToolPlayground } from "./components/ToolPlayground"
import { WelcomeModal } from "./components/WelcomeModal"
import { UsersView, RevisionsView, AccessLogsView } from "./components/TableViews"
import { AdminSpotlight, SpotlightTrigger } from "./components/Spotlight"
import type { AdminFile, Overlay } from "./types"

const ADMIN_SECRET_KEY = "memexai.adminSecret"
const API_KEY_KEY = "memexai.apiKey"
const queryClient = new QueryClient()
hljs.registerLanguage("bash", bash)
hljs.registerLanguage("json", json)
hljs.registerLanguage("python", python)
hljs.registerLanguage("tsx", typescript)
hljs.registerLanguage("typescript", typescript)

const PAGES = ["files", "configure", "playground"] as const
type Page = (typeof PAGES)[number]

function AdminApp({ secret, apiKey, onSignOut, onApiKeyInvalid, gateError: _gateError }: {
  secret: string
  apiKey: string
  onSignOut: () => void
  onApiKeyInvalid: () => void
  gateError: string | null
}) {
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [filesRefreshKey, setFilesRefreshKey] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()

  const { data: filesData } = useAdminData<{ files: AdminFile[] }>(
    secret ? "/v1/admin/files" : null,
    secret,
    filesRefreshKey,
  )
  const files = useMemo(() => filesData?.files ?? [], [filesData])

  const activePage = (PAGES.find((p) => location.pathname === "/" + p) ?? "files") as Page

  // Redirect to setup wizard if shared/.setup-complete marker is missing
  useEffect(() => {
    if (!filesData) return
    const hasSetupComplete = files.some((f) => f.physicalPath === "shared/.setup-complete")
    if (!hasSetupComplete && location.pathname !== "/setup") {
      navigate("/setup")
    }
  }, [filesData, files, location.pathname, navigate])

  return (
    <MantineProvider defaultColorScheme="light">
      <AdminSpotlight
        files={files}
        onSelectFile={(path) => navigate("/files?path=" + encodeURIComponent(path))}
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
                {PAGES.map((page) => (
                  <UnstyledButton
                    key={page}
                    onClick={() => navigate("/" + page)}
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
                  <Menu.Item
                    leftSection={<ExternalLinkIcon />}
                    component="a"
                    href="https://join.slack.com/t/memexaispace/shared_invite/zt-3yy24alf6-t1wRQsErf09JViHww_qlGw"
                    target="_blank"
                  >
                    Community / Support
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={onSignOut}>Sign out</Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Main>
          <Routes>
            <Route path="/files" element={<FilesView secret={secret} />} />
            <Route path="/configure" element={<ConfigureTab secret={secret} />} />
            <Route path="/playground" element={<ToolPlayground apiKey={apiKey} secret={secret} onApiKeyInvalid={onApiKeyInvalid} />} />
            <Route path="/setup" element={<SetupWizard secret={secret} onComplete={() => { navigate("/files"); setFilesRefreshKey((k) => k + 1) }} />} />
            <Route path="*" element={<Navigate to="/files" replace />} />
          </Routes>
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

function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem(ADMIN_SECRET_KEY) ?? "")
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_KEY) ?? "")
  const [gateError, setGateError] = useState<string | null>(null)

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
    <BrowserRouter basename="/admin">
      <AdminApp
        secret={secret}
        apiKey={apiKey}
        onSignOut={signOut}
        onApiKeyInvalid={handleApiKeyInvalid}
        gateError={gateError}
      />
    </BrowserRouter>
  )
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <CodeHighlightAdapterProvider adapter={createHighlightJsAdapter(hljs)}>
      <App />
    </CodeHighlightAdapterProvider>
  </QueryClientProvider>,
)
