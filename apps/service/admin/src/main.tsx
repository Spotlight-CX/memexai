import "@mantine/core/styles.css"
import { Badge, Box, Button, Code, Group, MantineProvider, Paper, PasswordInput, Stack, Table, Tabs, Text, TextInput, Title } from "@mantine/core"
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
      <Box p="lg">
        <Group justify="space-between" align="center" mb="md">
          <Box>
            <Title order={2}>MemexAI Admin</Title>
            <Text c="dimmed" size="sm">Observe memory files, revisions, and access logs.</Text>
          </Box>
          <Button variant="light" color="gray" onClick={() => {
            localStorage.removeItem(storageKey)
            setSecret("")
          }}>
            Forget secret
          </Button>
        </Group>
        <AdminTabs secret={secret} />
      </Box>
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
    <Tabs defaultValue="users">
      <Tabs.List>
        <Tabs.Tab value="users">Users</Tabs.Tab>
        <Tabs.Tab value="files">Files</Tabs.Tab>
        <Tabs.Tab value="revisions">Revisions</Tabs.Tab>
        <Tabs.Tab value="logs">Access Logs</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="users" pt="md"><UsersView secret={secret} /></Tabs.Panel>
      <Tabs.Panel value="files" pt="md"><FilesView secret={secret} selectedPath={selectedPath} onSelectPath={setSelectedPath} /></Tabs.Panel>
      <Tabs.Panel value="revisions" pt="md"><RevisionsView secret={secret} physicalPath={selectedPath} /></Tabs.Panel>
      <Tabs.Panel value="logs" pt="md"><AccessLogsView secret={secret} physicalPath={selectedPath} /></Tabs.Panel>
    </Tabs>
  )
}

function UsersView({ secret }: { secret: string }) {
  const { data, error } = useAdminData<{ users: AdminUser[] }>("/v1/admin/users", secret)
  if (error) return <ErrorText error={error} />

  return (
    <Paper p="md">
      <Table striped highlightOnHover>
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
    </Paper>
  )
}

function FilesView({ secret, selectedPath, onSelectPath }: { secret: string; selectedPath: string | null; onSelectPath: (path: string) => void }) {
  const [prefix, setPrefix] = useState("")
  const query = prefix ? `/v1/admin/files?prefix=${encodeURIComponent(prefix)}` : "/v1/admin/files"
  const { data, error } = useAdminData<{ files: AdminFile[] }>(query, secret)
  const { data: selected } = useAdminData<{ file: AdminFile }>(
    selectedPath ? `/v1/admin/files/${encodeURIComponent(selectedPath)}` : null,
    secret,
  )
  const tree = useMemo(() => deriveTree(data?.files ?? []), [data])

  if (error) return <ErrorText error={error} />

  return (
    <Group align="stretch" gap="md" wrap="nowrap">
      <Paper p="md" style={{ width: "38%", minWidth: 360 }}>
        <TextInput label="Physical prefix" placeholder="users/user_123 or shared" value={prefix} onChange={(event) => setPrefix(event.currentTarget.value)} mb="md" />
        <Stack gap={6}>{tree.map((item) => (
          <Button
            key={item.path}
            variant={item.path === selectedPath ? "filled" : "subtle"}
            color={item.kind === "folder" ? "gray" : "blue"}
            justify="flex-start"
            onClick={() => item.kind === "file" && onSelectPath(item.path)}
          >
            {item.label}
          </Button>
        ))}</Stack>
      </Paper>
      <Paper p="md" style={{ flex: 1 }}>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>{selectedPath ?? "Select a file"}</Text>
          {selected?.file ? <Badge variant="light">{selected.file.size} bytes</Badge> : null}
        </Group>
        <Code block>{selected?.file?.content ?? ""}</Code>
      </Paper>
    </Group>
  )
}

function RevisionsView({ secret, physicalPath }: { secret: string; physicalPath: string | null }) {
  const query = physicalPath ? `/v1/admin/revisions?physicalPath=${encodeURIComponent(physicalPath)}` : "/v1/admin/revisions"
  const { data, error } = useAdminData<{ revisions: AdminRevision[] }>(query, secret)
  if (error) return <ErrorText error={error} />

  return (
    <Paper p="md">
      <Table striped highlightOnHover>
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
      <Text mt="md" fw={600}>Latest content snapshot</Text>
      <Code block>{data?.revisions?.[0]?.content ?? ""}</Code>
    </Paper>
  )
}

function AccessLogsView({ secret, physicalPath }: { secret: string; physicalPath: string | null }) {
  const query = physicalPath ? `/v1/admin/access-logs?physicalPath=${encodeURIComponent(physicalPath)}` : "/v1/admin/access-logs"
  const { data, error } = useAdminData<{ accessLogs: AdminAccessLog[] }>(query, secret)
  if (error) return <ErrorText error={error} />

  return (
    <Paper p="md">
      <Table striped highlightOnHover>
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
    </Paper>
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

function ErrorText({ error }: { error: string }) {
  return <Text c="red">{error}</Text>
}

function formatDate(value: string | null) {
  if (!value) return ""
  return new Date(value).toLocaleString()
}

function deriveTree(files: AdminFile[]) {
  const folders = new Set<string>()
  for (const file of files) {
    const parts = file.physicalPath.split("/")
    for (let index = 1; index < parts.length; index += 1) {
      folders.add(parts.slice(0, index).join("/"))
    }
  }

  return [
    ...Array.from(folders).sort().map((path) => ({ kind: "folder" as const, path, label: `${path}/` })),
    ...files.map((file) => ({ kind: "file" as const, path: file.physicalPath, label: file.physicalPath })),
  ]
}

createRoot(document.getElementById("root")!).render(<App />)
