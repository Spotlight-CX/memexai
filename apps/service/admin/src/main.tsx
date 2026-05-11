import "@mantine/core/styles.css"
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Menu,
  Modal,
  MantineProvider,
  Paper,
  PasswordInput,
  ScrollArea,
  Stack,
  Table,
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
  latestRevision?: {
    operation: string
    actor: string | null
    reason: string | null
    createdAt: string
  } | null
  revisionCount?: number
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

type Overlay = "users" | "revisions" | "logs" | null

function App() {
  const [secret, setSecret] = useState(() => localStorage.getItem(storageKey) ?? "")
  const [overlay, setOverlay] = useState<Overlay>(null)

  const signOut = () => {
    localStorage.removeItem(storageKey)
    setSecret("")
  }

  if (!secret) {
    return <SecretGate onSubmit={(value) => {
      localStorage.setItem(storageKey, value)
      setSecret(value)
    }} />
  }

  return (
    <MantineProvider defaultColorScheme="light">
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
            <Group gap={6}>
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
          <FilesView secret={secret} />
        </AppShell.Main>
      </AppShell>

      <Modal
        opened={overlay === "users"}
        onClose={() => setOverlay(null)}
        title="Users"
        size="xl"
      >
        <Box h="60vh" style={{ minHeight: 0 }}>
          <UsersView secret={secret} />
        </Box>
      </Modal>
      <Modal
        opened={overlay === "revisions"}
        onClose={() => setOverlay(null)}
        title="Revisions"
        size="xl"
      >
        <Box h="60vh" style={{ minHeight: 0 }}>
          <RevisionsView secret={secret} physicalPath={null} />
        </Box>
      </Modal>
      <Modal
        opened={overlay === "logs"}
        onClose={() => setOverlay(null)}
        title="Access Logs"
        size="xl"
      >
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

function FilesView({ secret }: { secret: string }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedRevision, setSelectedRevision] = useState<AdminRevision | null>(null)
  const [copied, setCopied] = useState(false)

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
    setSelectedPath(path)
    tree.select(path)
  }

  const handleCopyPath = () => {
    if (!selectedPath) return
    navigator.clipboard.writeText(selectedPath)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (error) return <ErrorText error={error} />

  const fileName = selectedPath ? selectedPath.split("/").pop() ?? selectedPath : null
  const latestRevision = selectedFile?.latestRevision ?? null
  const revisionCount = selectedFile?.revisionCount ?? 0

  return (
    <Box
      h="100%"
      style={{
        display: "grid",
        gridTemplateColumns: "264px minmax(0, 1fr) 296px",
        minHeight: 0,
        background: "var(--mantine-color-white)",
      }}
    >
      {/* Left: file tree */}
      <Stack gap={0} h="100%" style={{ minHeight: 0, borderRight: "1px solid var(--mantine-color-gray-2)" }}>
        <Box px={12} pt={12} pb={8}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6} style={{ letterSpacing: "0.04em" }}>
            Explorer
          </Text>
          <TextInput
            aria-label="Search files"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            size="xs"
            styles={{ input: { fontSize: 12 } }}
          />
        </Box>
        <ScrollArea flex={1} offsetScrollbars px={4}>
          {filteredTree.length ? (
            <Tree
              data={filteredTree}
              tree={tree}
              levelOffset={0}
              renderNode={(payload) => (
                <FileTreeItem
                  payload={payload}
                  isFile={filePaths.has(payload.node.value)}
                  onSelectPath={handleSelectPath}
                />
              )}
            />
          ) : (
            <Text size="xs" c="dimmed" mt="md" px={8}>No files match.</Text>
          )}
        </ScrollArea>
        <Box px={12} py={8} style={{ borderTop: "1px solid var(--mantine-color-gray-1)" }}>
          <Text size="xs" c="dimmed">{files.length} files indexed</Text>
        </Box>
      </Stack>

      {/* Center: file content */}
      <ScrollArea h="100%">
        <Box px={{ base: "xl", xl: 56 }} py={40}>
          <Box maw={860} mx="auto">
            {selectedPath ? (
              <Stack gap="xl">
                {/* File header */}
                <Stack gap={6}>
                  <Text fw={600} size="lg" c="gray.9" style={{ lineHeight: 1.2 }}>
                    {fileName}
                  </Text>
                  <Group gap={6} wrap="nowrap" align="center">
                    <Text
                      ff="monospace"
                      size="xs"
                      c="dimmed"
                      style={{ overflowWrap: "anywhere", cursor: "pointer", flex: 1 }}
                      onClick={handleCopyPath}
                      title="Click to copy"
                    >
                      {selectedPath}
                    </Text>
                    {copied && (
                      <Text size="xs" c="teal.6" fw={500} style={{ whiteSpace: "nowrap" }}>Copied!</Text>
                    )}
                  </Group>

                  {/* Last write strip */}
                  {latestRevision ? (
                    <Group gap={8} wrap="wrap" align="center" mt={2}>
                      {latestRevision.actor && (
                        <Badge
                          size="sm"
                          variant="light"
                          color={latestRevision.actor.includes("admin") ? "orange" : "blue"}
                          style={{ textTransform: "none", fontWeight: 500 }}
                        >
                          {latestRevision.actor}
                        </Badge>
                      )}
                      <Badge size="sm" variant="outline" color="gray" style={{ textTransform: "none" }}>
                        {latestRevision.operation}
                      </Badge>
                      {latestRevision.reason && (
                        <Text size="xs" c="gray.6" style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                          {latestRevision.reason}
                        </Text>
                      )}
                      <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
                        {relativeTime(latestRevision.createdAt)}
                      </Text>
                    </Group>
                  ) : null}

                  {/* Stats row */}
                  <Group gap={16} mt={2}>
                    {selectedFile ? (
                      <Text size="xs" c="dimmed">
                        {selectedFile.size} bytes
                        {revisionCount > 0 ? ` · ${revisionCount} revision${revisionCount !== 1 ? "s" : ""}` : ""}
                        {` · created ${formatDate(selectedFile.createdAt)}`}
                      </Text>
                    ) : null}
                    {selectedRevision
                      ? <Badge variant="light" color="yellow" size="xs">Historical revision</Badge>
                      : <Badge variant="light" color="green" size="xs">Latest</Badge>
                    }
                  </Group>
                </Stack>

                {selectedRevision ? (
                  <Paper withBorder p="sm" radius="sm" bg="yellow.0">
                    <Group justify="space-between" gap="md" wrap="nowrap">
                      <Text size="sm" c="yellow.9">
                        Viewing {selectedRevision.operation} from {formatDate(selectedRevision.createdAt)}.
                      </Text>
                      <Button size="xs" variant="light" color="yellow" onClick={() => setSelectedRevision(null)}>
                        View latest
                      </Button>
                    </Group>
                  </Paper>
                ) : null}

                <DocumentBody content={visibleContent} path={selectedPath} />
              </Stack>
            ) : (
              <Box pt={120} ta="center">
                <Text size="xl" fw={500} c="gray.7">Select a file</Text>
                <Text size="sm" c="dimmed" mt={6}>Choose a memory from the tree to inspect its content and revision history.</Text>
              </Box>
            )}
          </Box>
        </Box>
      </ScrollArea>

      {/* Right: revision sidebar */}
      <Stack gap={0} h="100%" style={{ minHeight: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", background: "var(--mantine-color-gray-0)" }}>
        <Box px={12} py={10}>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.04em" }}>Revisions</Text>
          <Text size="xs" c="dimmed" mt={2}>{selectedPath ? "File history" : "Select a file to inspect."}</Text>
        </Box>
        <Divider />
        <ScrollArea flex={1} offsetScrollbars>
          <Stack gap={4} p={8}>
            {revisionsError ? <ErrorText error={revisionsError} /> : null}
            {!selectedPath ? <Text size="xs" c="dimmed" p="xs">No file selected.</Text> : null}
            {selectedPath && !revisions?.revisions?.length ? <Text size="xs" c="dimmed" p="xs">No revisions yet.</Text> : null}
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

function UsersView({ secret }: { secret: string }) {
  const { data, error } = useAdminData<{ users: AdminUser[] }>("/v1/admin/users", secret)
  if (error) return <ErrorText error={error} />

  return (
    <TableShell>
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User ID</Table.Th>
            <Table.Th>Files</Table.Th>
            <Table.Th>Last Write</Table.Th>
            <Table.Th>Last Read</Table.Th>
          </Table.Tr>
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

function RevisionsView({ secret, physicalPath }: { secret: string; physicalPath: string | null }) {
  const query = physicalPath ? `/v1/admin/revisions?physicalPath=${encodeURIComponent(physicalPath)}` : "/v1/admin/revisions"
  const { data, error } = useAdminData<{ revisions: AdminRevision[] }>(query, secret)
  if (error) return <ErrorText error={error} />

  return (
    <TableShell>
      <Table striped highlightOnHover stickyHeader>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Path</Table.Th>
            <Table.Th>Op</Table.Th>
            <Table.Th>Actor</Table.Th>
            <Table.Th>Reason</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(data?.revisions ?? []).map((revision) => (
            <Table.Tr key={revision.id}>
              <Table.Td>{formatDate(revision.createdAt)}</Table.Td>
              <Table.Td><Code>{revision.physicalPath}</Code></Table.Td>
              <Table.Td>{revision.operation}</Table.Td>
              <Table.Td>{revision.actor ?? ""}</Table.Td>
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
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>User</Table.Th>
            <Table.Th>Op</Table.Th>
            <Table.Th>Path</Table.Th>
            <Table.Th>Tool Call</Table.Th>
          </Table.Tr>
        </Table.Thead>
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

// ── Tree icons ────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{
        transform: expanded ? "rotate(90deg)" : "none",
        transition: "transform 100ms ease",
        flexShrink: 0,
        color: "var(--mantine-color-gray-5)",
      }}
    >
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M1.5 4.5A1 1 0 012.5 3.5H6L7.5 5H13.5A1 1 0 0114.5 6V12.5A1 1 0 0113.5 13.5H2.5A1 1 0 011.5 12.5V4.5Z"
        fill={open ? "#f0b429" : "#de9b23"}
      />
    </svg>
  )
}

function FileDocIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M2 1.5A1 1 0 013 0.5H9L13.5 5V14.5A1 1 0 0112.5 15.5H3A1 1 0 012 14.5V1.5Z" fill="#c0cdd8" />
      <path d="M9 0.5V4.5H13.5" fill="#dce6ed" />
      <path d="M9 0.5V4.5H13.5" stroke="#b0c0cc" strokeWidth="0.75" fill="none" />
    </svg>
  )
}

function DotsHorizontalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13.5" cy="8" r="1.5" />
    </svg>
  )
}

// ── FileTreeItem ──────────────────────────────────────────────────────────────

function FileTreeItem({
  payload,
  isFile,
  onSelectPath,
}: {
  payload: RenderTreeNodePayload
  isFile: boolean
  onSelectPath: (path: string) => void
}) {
  const { node, expanded, hasChildren, selected, tree, level } = payload
  const [hovered, setHovered] = useState(false)

  return (
    <Box
      style={{
        height: 22,
        display: "flex",
        alignItems: "center",
        borderRadius: 3,
        paddingRight: 6,
        cursor: "pointer",
        background:
          selected && isFile
            ? "var(--mantine-color-blue-1)"
            : hovered
              ? "var(--mantine-color-gray-1)"
              : "transparent",
        userSelect: "none",
      }}
      onClick={() => {
        if (isFile) onSelectPath(node.value)
        else if (hasChildren) tree.toggleExpanded(node.value)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Indent guide lines */}
      {Array.from({ length: level }, (_, i) => (
        <Box
          key={i}
          style={{
            width: 16,
            height: "100%",
            flexShrink: 0,
            borderLeft: "1px solid var(--mantine-color-gray-2)",
            marginLeft: i === 0 ? 6 : 0,
          }}
        />
      ))}

      {/* Left gap at root level */}
      {level === 0 && (
        <Box style={{ width: 6, flexShrink: 0 }} />
      )}

      {/* Chevron slot */}
      <Box
        style={{
          width: 14,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {hasChildren ? <ChevronIcon expanded={expanded} /> : null}
      </Box>

      {/* Icon */}
      <Box
        style={{
          width: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginLeft: 3,
          marginRight: 5,
        }}
      >
        {isFile ? <FileDocIcon /> : <FolderIcon open={expanded} />}
      </Box>

      {/* Label */}
      <Text
        size="sm"
        fw={selected && isFile ? 600 : 400}
        c={isFile ? "gray.8" : "gray.7"}
        ff={isFile ? "monospace" : undefined}
        style={{
          fontSize: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={node.value}
      >
        {String(node.label)}
      </Text>
    </Box>
  )
}

// ── RevisionRow ───────────────────────────────────────────────────────────────

function RevisionRow({
  revision,
  selected,
  onClick,
}: {
  revision: AdminRevision
  selected: boolean
  onClick: () => void
}) {
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
          <Text size="xs" c="dimmed">{relativeTime(revision.createdAt)}</Text>
        </Group>
        {revision.reason ? (
          <Text size="xs" c="gray.7" lineClamp={2}>{revision.reason}</Text>
        ) : null}
        {revision.actor ? (
          <Badge size="xs" variant="light" color="gray" style={{ textTransform: "none" }}>{revision.actor}</Badge>
        ) : null}
      </Stack>
    </UnstyledButton>
  )
}

// ── DocumentBody ──────────────────────────────────────────────────────────────

function DocumentBody({ content, path }: { content: string; path: string }) {
  const codeLike = isCodeLike(content, path)

  if (codeLike) {
    return (
      <Code
        block
        style={{
          whiteSpace: "pre-wrap",
          lineHeight: 1.7,
          fontSize: 13,
          background: "var(--mantine-color-gray-0)",
          padding: "16px 20px",
          borderRadius: 6,
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
      style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
    >
      {content}
    </Text>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <Box h="100%" p="md" style={{ minHeight: 0 }}>
      <Paper withBorder h="100%" style={{ overflow: "hidden" }}>
        <ScrollArea h="100%">{children}</ScrollArea>
      </Paper>
    </Box>
  )
}

function ErrorText({ error }: { error: string }) {
  return <Text c="red" size="sm">{error}</Text>
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
        if (!cancelled) { setData(body); setError(null) }
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "Request failed")
      })
    return () => { cancelled = true }
  }, [path, secret])

  return { data, error }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(value: string | Date | null) {
  if (!value) return ""
  return new Date(value).toLocaleString()
}

function relativeTime(value: string | Date | null): string {
  if (!value) return ""
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(value)
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
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
      return String(a.label).localeCompare(String(b.label))
    })
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined,
    }))
}

function isCodeLike(content: string, path: string) {
  const ext = path.split(".").pop()?.toLowerCase()
  if (ext && ["json", "js", "jsx", "ts", "tsx", "md", "sql", "yaml", "yml", "toml", "xml", "html", "css"].includes(ext)) return true
  const trimmed = content.trim()
  if (!trimmed) return false
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return true
  return content.split("\n").some((line) => /^\s{2,}\S/.test(line) || line.includes("=>") || line.includes("function "))
}

createRoot(document.getElementById("root")!).render(<App />)
