import { Box, Code, Paper, ScrollArea, Table, Text } from "@mantine/core"
import { useAdminData } from "../hooks"
import type { AdminAccessLog, AdminRevision, AdminUser } from "../types"
import { formatDate } from "../utils"

export function UsersView({ secret }: { secret: string }) {
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

export function RevisionsView({
  secret,
  physicalPath,
  actor,
  userId,
}: {
  secret: string
  physicalPath: string | null
  actor?: string
  userId?: string
}) {
  const params = new URLSearchParams()
  if (physicalPath) params.set("physicalPath", physicalPath)
  if (actor) params.set("actor", actor)
  if (userId) params.set("userId", userId)
  const query = `/v1/admin/revisions${params.size ? `?${params.toString()}` : ""}`
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

export function AccessLogsView({ secret, physicalPath }: { secret: string; physicalPath: string | null }) {
  const query = physicalPath
    ? `/v1/admin/access-logs?physicalPath=${encodeURIComponent(physicalPath)}`
    : "/v1/admin/access-logs"
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

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <Box h="100%" p="md" style={{ minHeight: 0 }}>
      <Paper withBorder h="100%" style={{ overflow: "hidden" }}>
        <ScrollArea h="100%">{children}</ScrollArea>
      </Paper>
    </Box>
  )
}

export function ErrorText({ error }: { error: string }) {
  return <Text c="red" size="sm">{error}</Text>
}
