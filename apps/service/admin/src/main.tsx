import "@mantine/core/styles.css"
import {
  AppShell,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  MantineProvider,
  Paper,
  PasswordInput,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
  Tree,
  UnstyledButton,
  filterTreeData,
  getTreeExpandedState,
  useTree,
} from "@mantine/core"
import type { RenderTreeNodePayload, TreeNodeData } from "@mantine/core"
import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"

const storageKey = "memexai.adminSecret"

type AdminUser = {
  userId: string
  fileCount: number
  lastWriteAt: string | null
  lastReadAt: string | null
}

type AdminFile = {
  id: string
  physicalPath: string
  size: number
  createdAt: string
  updatedAt: string
  content?: string
}

type AdminRevision = {
  id: string
  physicalPath: string
  operation: string
  content: string
  reason: string | null
  actor: string | null
  userId: string | null
  toolCallId: string | null
  createdAt: string
}

type AdminAccessLog = {
  id: string
  physicalPath: string
  operation: string
  actor: string | null
  userId: string | null
  toolCallId: string | null
  createdAt: string
}

type FileTreeNode = TreeNodeData & {
  kind: "folder" | "file"
  children?: FileTreeNode[]
}

function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem(storageKey) ?? "")

  if (!secret) {
    return <SecretGate onSubmit={(value) => {
      localStorage.setItem(storageKey, value)
      setSecret(value)
    }} />
  }

  return (
    <MantineProvider defaultColorScheme="light">
      <AppShell
        header={{ height: 74 }}
        padding={0}
        styles={{
          root: { height: "100vh", background: "var(--mantine-color-gray-0)" },
          header: { borderBottom: "1px solid var(--mantine-color-gray-2)" },
          main: { height: "calc(100vh - 74px)", minHeight: 0, paddingTop: 74 },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
            <Box miw={220}>
              <Title order={3} size="h4">MemexAI Admin</Title>
              <Text c="dimmed" size="xs">Observe memory files, revisions, and access logs.</Text>
            </Box>
            <Button variant="subtle" color="gray" size="xs" onClick={() => {
              localStorage.removeItem(storageKey)
              setSecret("")
            }}>
              Forget secret
            </Button>
          </Group>
        </AppShell.Header>
        <AppShell.Main>
          <AdminTabs secret={secret} />
        </AppShell.Main>
      </AppShell>
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

function AdminTabs({ secret }: { secret: string }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  return (
    <Tabs defaultValue="files" h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <Tabs.List px="lg" h={42} style={{ flex: "0 0 auto", background: "var(--mantine-color-white)" }}>
        <Tabs.Tab value="users">Users</Tabs.Tab>
        <Tabs.Tab value="files">Files</Tabs.Tab>
        <Tabs.Tab value="revisions">Revisions</Tabs.Tab>
        <Tabs.Tab value="logs">Access Logs</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="users" style={{ flex: 1, minHeight: 0 }}><UsersView secret={secret} /></Tabs.Panel>
      <Tabs.Panel value="files" style={{ flex: 1, minHeight: 0 }}><FilesView secret={secret} selectedPath={selectedPath} onSelectPath={setSelectedPath} /></Tabs.Panel>
      <Tabs.Panel value="revisions" style={{ flex: 1, minHeight: 0 }}><RevisionsView secret={secret} physicalPath={selectedPath} /></Tabs.Panel>
      <Tabs.Panel value="logs" style={{ flex: 1, minHeight: 0 }}><AccessLogsView secret={secret} physicalPath={selectedPath} /></Tabs.Panel>
    </Tabs>
  )
}

function UsersView({ secret }: { secret: string }) {
  const { data, error } = useAdminData<{ users: AdminUser[] }>("/v1/admin/users", secret)
  if (error) return <ErrorText error={error} />

  return (
    <TableShell>
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr><Table.Th>User ID</Table.Th><Table.Th>Files</Table.Th><Table.Th>Last Write</Table.Th><Table.Th>Last Read</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(data?.users ?? []).map((user) => (
            <Table.Tr key={user.userId}>
              <Table.Td><Code>{user.userId}</Code></Table.Td>
              <Table.Td>{user.fileCount}</Table.Td>
              <Table.Td>{formatDate(user.lastWriteAt)}</Table.Td>
              <Table.Td>{formatDate(user.lastReadAt)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </TableShell>
  )
}

function FilesView({ secret, selectedPath, onSelectPath }: { secret: string; selectedPath: string | null; onSelectPath: (path: string) => void }) {
  const [search, setSearch] = useState("")
  const [selectedRevision, setSelectedRevision] = useState<AdminRevision | null>(null)
  const { data, error } = useAdminData<{ files: AdminFile[] }>("/v1/admin/files", secret)
  const { data: selected } = useAdminData<{ file: AdminFile }>(
    selectedPath ? `/v1/admin/files/${encodeURIComponent(selectedPath)}` : null,
    secret,
  )
  const { data: revisions, error: revisionsError } = useAdminData<{ revisions: AdminRevision[] }>(
    selectedPath ? `/v1/admin/revisions?physicalPath=${encodeURIComponent(selectedPath)}` : null,
    secret,
  )
  const tree = useTree()
  const files = data?.files ?? []
  const fileTree = useMemo(() => deriveTree(files), [files])
  const filePaths = useMemo(() => new Set(files.map((file) => file.physicalPath)), [files])
  const filteredTree = useMemo(() => filterTreeData(fileTree, search.trim()) as FileTreeNode[], [fileTree, search])
  const visibleContent = selectedRevision?.content ?? selected?.file?.content ?? ""
  const selectedFile = selected?.file

  useEffect(() => {
    if (selectedPath) tree.select(selectedPath)
    else tree.clearSelected()
  }, [selectedPath])

  useEffect(() => {
    if (search.trim()) tree.setExpandedState(getTreeExpandedState(filteredTree, "*"))
  }, [filteredTree, search])

  const handleSelectPath = (path: string) => {
    setSelectedRevision(null)
    onSelectPath(path)
    tree.select(path)
  }

  if (error) return <ErrorText error={error} />

  return (
    <Box h="100%" style={{ display: "grid", gridTemplateColumns: "280px minmax(520px, 1fr) 304px", minHeight: 0, background: "var(--mantine-color-white)" }}>
      <Stack gap="sm" p="md" h="100%" style={{ minHeight: 0, borderRight: "1px solid var(--mantine-color-gray-2)" }}>
        <Box>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">Files</Text>
          <Text size="xs" c="dimmed">{files.length} indexed memories</Text>
        </Box>
        <TextInput
          aria-label="Search files"
          placeholder="Search files"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          size="xs"
        />
        <ScrollArea flex={1} offsetScrollbars>
          {filteredTree.length ? (
            <Tree
              data={filteredTree}
              tree={tree}
              levelOffset={18}
              withLines
              renderNode={(payload) => (
                <FileTreeItem
                  payload={payload}
                  isFile={filePaths.has(payload.node.value)}
                  onSelectPath={handleSelectPath}
                />
              )}
            />
          ) : (
            <Text size="sm" c="dimmed" mt="md">No files match this search.</Text>
          )}
        </ScrollArea>
      </Stack>

      <ScrollArea h="100%">
        <Box px={{ base: "xl", xl: 64 }} py={48}>
          <Box maw={900} mx="auto">
            {selectedPath ? (
              <Stack gap="xl">
                <Stack gap="xs">
                  <Text size="xs" c="dimmed">Physical path</Text>
                  <Text ff="monospace" size="sm" c="dimmed" style={{ overflowWrap: "anywhere" }}>{selectedPath}</Text>
                  <Group gap="xs">
                    {selectedFile ? <Badge variant="light" color="gray">{selectedFile.size} bytes</Badge> : null}
                    {selectedFile ? <Badge variant="light" color="gray">Updated {formatDate(selectedFile.updatedAt)}</Badge> : null}
                    {selectedRevision ? <Badge variant="light" color="yellow">Historical revision</Badge> : <Badge variant="light" color="green">Latest</Badge>}
                  </Group>
                </Stack>

                {selectedRevision ? (
                  <Paper withBorder p="sm" radius="sm" bg="yellow.0">
                    <Group justify="space-between" gap="md" wrap="nowrap">
                      <Text size="sm" c="yellow.9">
                        Viewing {selectedRevision.operation} revision from {formatDate(selectedRevision.createdAt)}.
                      </Text>
                      <Button size="xs" variant="light" color="yellow" onClick={() => setSelectedRevision(null)}>View latest</Button>
                    </Group>
                  </Paper>
                ) : null}

                <DocumentBody content={visibleContent} path={selectedPath} />
              </Stack>
            ) : (
              <Box pt={96} ta="center">
                <Title order={2} fw={500}>Select a file</Title>
                <Text c="dimmed" mt="xs">Choose a memory from the tree to read its latest content and revisions.</Text>
              </Box>
            )}
          </Box>
        </Box>
      </ScrollArea>

      <Stack gap={0} h="100%" style={{ minHeight: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", background: "var(--mantine-color-gray-0)" }}>
        <Box p="md">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">Revision History</Text>
          <Text size="xs" c="dimmed">{selectedPath ? "File-specific changes" : "Select a file to inspect revisions."}</Text>
        </Box>
        <Divider />
        <ScrollArea flex={1} offsetScrollbars>
          <Stack gap={4} p="xs">
            {revisionsError ? <ErrorText error={revisionsError} /> : null}
            {!selectedPath ? <Text size="sm" c="dimmed" p="sm">Select a file to inspect revisions.</Text> : null}
            {selectedPath && !revisions?.revisions?.length ? <Text size="sm" c="dimmed" p="sm">No revisions for this file.</Text> : null}
            {(revisions?.revisions ?? []).map((revision) => (
              <RevisionRow
                key={revision.id}
                revision={revision}
                selected={selectedRevision?.id === revision.id}
                onClick={() => setSelectedRevision(revision)}
              />
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    </Box>
  )
}

function RevisionsView({ secret, physicalPath }: { secret: string; physicalPath: string | null }) {
  const query = physicalPath ? `/v1/admin/revisions?physicalPath=${encodeURIComponent(physicalPath)}` : "/v1/admin/revisions"
  const { data, error } = useAdminData<{ revisions: AdminRevision[] }>(query, secret)
  if (error) return <ErrorText error={error} />

  return (
    <TableShell>
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead><Table.Tr><Table.Th>Time</Table.Th><Table.Th>Path</Table.Th><Table.Th>Operation</Table.Th><Table.Th>Actor</Table.Th><Table.Th>Tool Call</Table.Th><Table.Th>Reason</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(data?.revisions ?? []).map((revision) => (
            <Table.Tr key={revision.id}>
              <Table.Td>{formatDate(revision.createdAt)}</Table.Td>
              <Table.Td><Code>{revision.physicalPath}</Code></Table.Td>
              <Table.Td>{revision.operation}</Table.Td>
              <Table.Td>{revision.actor ?? ""}</Table.Td>
              <Table.Td>{revision.toolCallId ?? ""}</Table.Td>
              <Table.Td>{revision.reason ?? ""}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </TableShell>
  )
}

function AccessLogsView({ secret, physicalPath }: { secret: string; physicalPath: string | null }) {
  const query = physicalPath ? `/v1/admin/access-logs?physicalPath=${encodeURIComponent(physicalPath)}` : "/v1/admin/access-logs"
  const { data, error } = useAdminData<{ accessLogs: AdminAccessLog[] }>(query, secret)
  if (error) return <ErrorText error={error} />

  return (
    <TableShell>
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead><Table.Tr><Table.Th>Time</Table.Th><Table.Th>User</Table.Th><Table.Th>Operation</Table.Th><Table.Th>Physical Path</Table.Th><Table.Th>Tool Call</Table.Th></Table.Tr></Table.Thead>
        <Table.Tbody>
          {(data?.accessLogs ?? []).map((log) => (
            <Table.Tr key={log.id}>
              <Table.Td>{formatDate(log.createdAt)}</Table.Td>
              <Table.Td>{log.userId ?? ""}</Table.Td>
              <Table.Td>{log.operation}</Table.Td>
              <Table.Td><Code>{log.physicalPath}</Code></Table.Td>
              <Table.Td>{log.toolCallId ?? ""}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </TableShell>
  )
}

function useAdminData<T>(path: string | null, secret: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    fetch(path, { headers: { "x-memex-admin-secret": secret } })
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error?.message ?? "Request failed")
        return body as T
      })
      .then((body) => {
        if (!cancelled) {
          setData(body)
          setError(null)
        }
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "Request failed")
      })
    return () => { cancelled = true }
  }, [path, secret])

  return { data, error }
}

function FileTreeItem({ payload, isFile, onSelectPath }: { payload: RenderTreeNodePayload; isFile: boolean; onSelectPath: (path: string) => void }) {
  const { node, expanded, hasChildren, selected, tree } = payload

  return (
    <UnstyledButton
      w="100%"
      px={6}
      py={4}
      style={{
        borderRadius: 6,
        background: selected && isFile ? "var(--mantine-color-blue-0)" : "transparent",
      }}
      onClick={() => {
        if (isFile) onSelectPath(node.value)
        else if (hasChildren) tree.toggleExpanded(node.value)
      }}
    >
      <Group gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed" w={14} ta="center">{hasChildren ? (expanded ? "v" : ">") : ""}</Text>
        <Text
          size="sm"
          fw={isFile && selected ? 600 : 400}
          c={isFile ? "gray.8" : "gray.7"}
          truncate
        >
          {node.label}
        </Text>
      </Group>
    </UnstyledButton>
  )
}

function RevisionRow({ revision, selected, onClick }: { revision: AdminRevision; selected: boolean; onClick: () => void }) {
  return (
    <UnstyledButton
      onClick={onClick}
      w="100%"
      p="sm"
      style={{
        borderRadius: 6,
        border: selected ? "1px solid var(--mantine-color-blue-3)" : "1px solid transparent",
        background: selected ? "var(--mantine-color-blue-0)" : "transparent",
      }}
    >
      <Stack gap={4}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" fw={700} tt="uppercase" c={selected ? "blue.8" : "gray.7"}>{revision.operation}</Text>
          <Text size="xs" c="dimmed">{formatDate(revision.createdAt)}</Text>
        </Group>
        {revision.reason ? <Text size="xs" c="gray.7" lineClamp={2}>{revision.reason}</Text> : null}
        <Group gap={6}>
          {revision.actor ? <Badge size="xs" variant="light" color="gray">{revision.actor}</Badge> : null}
          {revision.toolCallId ? <Badge size="xs" variant="light" color="gray">{revision.toolCallId}</Badge> : null}
        </Group>
      </Stack>
    </UnstyledButton>
  )
}

function DocumentBody({ content, path }: { content: string; path: string }) {
  const codeLike = isCodeLike(content, path)

  if (codeLike) {
    return (
      <Code
        block
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.7,
          fontSize: 14,
          background: "transparent",
          padding: 0,
        }}
      >
        {content}
      </Code>
    )
  }

  return (
    <Text
      component="pre"
      m={0}
      ff="var(--mantine-font-family)"
      size="md"
      lh={1.85}
      c="gray.9"
      style={{
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {content}
    </Text>
  )
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <Box h="100%" p="lg" style={{ minHeight: 0 }}>
      <Paper withBorder h="100%" style={{ overflow: "hidden" }}>
        <ScrollArea h="100%">
          {children}
        </ScrollArea>
      </Paper>
    </Box>
  )
}

function ErrorText({ error }: { error: string }) {
  return <Text c="red">{error}</Text>
}

function formatDate(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString()
}

function deriveTree(files: AdminFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const folders = new Map<string, FileTreeNode>()

  const getFolder = (path: string, label: string, siblings: FileTreeNode[]) => {
    const existing = folders.get(path)
    if (existing) return existing

    const next: FileTreeNode = { kind: "folder", value: path, label, children: [] }
    folders.set(path, next)
    siblings.push(next)
    return next
  }

  for (const file of files) {
    const parts = file.physicalPath.split("/")
    let siblings = root
    for (let index = 0; index < parts.length; index += 1) {
      const label = parts[index]
      const path = parts.slice(0, index + 1).join("/")
      const isFile = index === parts.length - 1
      if (isFile) {
        siblings.push({ kind: "file", value: file.physicalPath, label })
      } else {
        const folder = getFolder(path, label, siblings)
        siblings = folder.children ?? []
      }
    }
  }

  return sortTree(root)
}

function sortTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1
      return String(left.label).localeCompare(String(right.label))
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined,
    }))
}

function isCodeLike(content: string, path: string) {
  const extension = path.split(".").pop()?.toLowerCase()
  if (extension && ["json", "js", "jsx", "ts", "tsx", "md", "sql", "yaml", "yml", "toml", "xml", "html", "css"].includes(extension)) return true
  const trimmed = content.trim()
  if (!trimmed) return false
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true
  return content.split("\n").some((line) => /^\s{2,}\S/.test(line) || line.includes("=>") || line.includes("function "))
}

createRoot(document.getElementById("root")!).render(<App />)
