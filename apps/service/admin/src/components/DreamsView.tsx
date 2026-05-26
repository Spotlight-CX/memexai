import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Menu,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from "@mantine/core"
import { useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminHeaders } from "../api"
import { adminQueryKey, useAdminData } from "../hooks"
import { DotsHorizontalIcon } from "../icons"
import type { AdminDreamConfigRow, AdminDreamUser, Pagination } from "../types"
import { formatDate, relativeTime } from "../utils"
import { ErrorText, RevisionsView, TableShell } from "./TableViews"

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
  { value: "idle", label: "Idle" },
]

const WINDOW_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "1h", label: "Last 1 hour" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
]

type DreamUsersResponse = {
  users: AdminDreamUser[]
  summary: { running: number; failed: number; completed: number; paused: number }
  pagination: Pagination
  serverTime: string
}

type DreamConfigResponse = {
  config: Record<string, string>
  rows: AdminDreamConfigRow[]
}

export function DreamsView({ secret }: { secret: string }) {
  const [status, setStatus] = useState("all")
  const [windowValue, setWindowValue] = useState("24h")
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState("50")
  const [offset, setOffset] = useState(0)
  const [revisionUser, setRevisionUser] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const usersPath = useMemo(() => {
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    if (query.trim()) params.set("q", query.trim())
    const from = fromForWindow(windowValue)
    if (from) params.set("from", from)
    params.set("limit", limit)
    params.set("offset", String(offset))
    return `/v1/admin/dream/users?${params.toString()}`
  }, [status, query, windowValue, limit, offset])

  const { data, error } = useAdminData<DreamUsersResponse>(usersPath, secret, { refetchInterval: 3000 })
  const { data: configData, error: configError } = useAdminData<DreamConfigResponse>("/v1/admin/dream/config", secret, { refetchInterval: 10_000 })
  const pagination = data?.pagination ?? { limit: Number(limit), offset, total: 0, hasMore: false }
  const pageEnd = pagination.total === 0 ? 0 : Math.min(pagination.offset + pagination.limit, pagination.total)
  const pageStart = pagination.total === 0 ? 0 : pagination.offset + 1

  const resetPage = (fn: () => void) => {
    setOffset(0)
    fn()
  }

  const togglePaused = async (user: AdminDreamUser) => {
    await fetch(`/v1/admin/dream/users/${encodeURIComponent(user.userId)}/paused`, {
      method: "PUT",
      headers: { ...adminHeaders(secret), "content-type": "application/json" },
      body: JSON.stringify({ paused: !user.paused }),
    })
    await queryClient.invalidateQueries({ queryKey: adminQueryKey(usersPath) })
  }

  if (error) return <ErrorText error={error} />

  return (
    <Box h="100%" p="lg" style={{ minHeight: 0 }}>
      <Stack gap="md" h="100%" style={{ minHeight: 0 }}>
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text fw={650} size="xl">Dreams</Text>
            <Text size="sm" c="dimmed">Background memory consolidation</Text>
          </Box>
          <Text size="xs" c="dimmed">{data?.serverTime ? `Updated ${relativeTime(data.serverTime)}` : ""}</Text>
        </Group>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
          <SummaryCard label="Running" value={data?.summary.running ?? 0} color="blue" />
          <SummaryCard label="Failed" value={data?.summary.failed ?? 0} color="red" />
          <SummaryCard label="Completed" value={data?.summary.completed ?? 0} color="green" />
          <SummaryCard label="Paused" value={data?.summary.paused ?? 0} color="gray" />
        </SimpleGrid>

        <Paper withBorder p="sm" radius="sm">
          <Text size="sm" c={configError ? "red.6" : "dimmed"}>
            {configError ? configError : formatConfig(configData?.config)}
          </Text>
        </Paper>

        <Group gap="sm" wrap="nowrap">
          <TextInput
            aria-label="Search users"
            placeholder="Search user..."
            value={query}
            onChange={(event) => resetPage(() => setQuery(event.currentTarget.value))}
            style={{ flex: 1 }}
          />
          <Select aria-label="Status" data={STATUS_OPTIONS} value={status} onChange={(value) => resetPage(() => setStatus(value ?? "all"))} w={150} />
          <Select aria-label="Time window" data={WINDOW_OPTIONS} value={windowValue} onChange={(value) => resetPage(() => setWindowValue(value ?? "24h"))} w={160} />
          <Select aria-label="Page size" data={["25", "50", "100", "200"].map((value) => ({ value, label: `${value} / page` }))} value={limit} onChange={(value) => resetPage(() => setLimit(value ?? "50"))} w={140} />
        </Group>

        <Box style={{ flex: 1, minHeight: 0 }}>
          <TableShell>
            <Table striped highlightOnHover stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Started</Table.Th>
                  <Table.Th>Last Dreamed</Table.Th>
                  <Table.Th>Files</Table.Th>
                  <Table.Th>Runs</Table.Th>
                  <Table.Th>Paused</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(data?.users ?? []).map((user) => (
                  <Table.Tr key={user.userId}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Code>{user.userId}</Code>
                        {user.error && <Text size="xs" c="red.7">{user.error}</Text>}
                      </Stack>
                    </Table.Td>
                    <Table.Td><StatusBadge user={user} /></Table.Td>
                    <Table.Td>{user.lastStartedAt ? relativeTime(user.lastStartedAt) : ""}</Table.Td>
                    <Table.Td>{formatDate(user.lastDreamedAt)}</Table.Td>
                    <Table.Td>{user.filesTouched ?? ""}</Table.Td>
                    <Table.Td>{user.dreamCount}</Table.Td>
                    <Table.Td>
                      <Switch
                        size="xs"
                        checked={user.paused}
                        onChange={() => void togglePaused(user)}
                        aria-label={`Toggle paused for ${user.userId}`}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end" shadow="md">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${user.userId}`}>
                            <DotsHorizontalIcon />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item onClick={() => navigate(`/files?path=${encodeURIComponent(`users/${user.userId}/dream-log.md`)}`)}>
                            Open dream log
                          </Menu.Item>
                          <Menu.Item onClick={() => setRevisionUser(user.userId)}>
                            View dream revisions
                          </Menu.Item>
                          <Menu.Item onClick={() => void togglePaused(user)}>
                            {user.paused ? "Resume dreaming" : "Pause dreaming"}
                          </Menu.Item>
                          <Menu.Item onClick={() => navigator.clipboard.writeText(user.userId)}>
                            Copy user ID
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </TableShell>
        </Box>

        <Group justify="space-between">
          <Text size="sm" c="dimmed">Showing {pageStart}-{pageEnd} of {pagination.total}</Text>
          <Group gap="xs">
            <Button size="xs" variant="light" disabled={pagination.offset === 0} onClick={() => setOffset(Math.max(0, pagination.offset - pagination.limit))}>Previous</Button>
            <Button size="xs" variant="light" disabled={!pagination.hasMore} onClick={() => setOffset(pagination.offset + pagination.limit)}>Next</Button>
          </Group>
        </Group>
      </Stack>

      <Modal opened={!!revisionUser} onClose={() => setRevisionUser(null)} title={revisionUser ? `Dream revisions: ${revisionUser}` : "Dream revisions"} size="xl">
        <Box h="60vh" style={{ minHeight: 0 }}>
          <RevisionsView secret={secret} physicalPath={null} actor="dream-agent" userId={revisionUser ?? undefined} />
        </Box>
      </Modal>
    </Box>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Paper withBorder p="sm" radius="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={650}>{label}</Text>
      <Text size="xl" fw={700} c={`${color}.7`}>{value}</Text>
    </Paper>
  )
}

function StatusBadge({ user }: { user: AdminDreamUser }) {
  if (user.paused) return <Badge color="gray" variant="light">Paused</Badge>
  const color = user.status === "running" ? "blue" : user.status === "failed" ? "red" : user.status === "completed" ? "green" : "gray"
  return <Badge color={color} variant={user.status === "running" ? "dot" : "light"}>{user.status}</Badge>
}

function fromForWindow(value: string): string | null {
  const now = Date.now()
  if (value === "1h") return new Date(now - 60 * 60 * 1000).toISOString()
  if (value === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString()
  if (value === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
  return null
}

function formatConfig(config: Record<string, string> | undefined): string {
  if (!config) return "Config loading..."
  return [
    `enabled=${config.dream_enabled ?? "false"}`,
    `interval=${config.dream_interval_minutes ?? "60"}m`,
    `grace=${config.dream_grace_period_minutes ?? "30"}m`,
    `max writes=${config.dream_max_writes ?? "10"}`,
    `conc=${config.dream_concurrency ?? "3"}`,
  ].join(" · ")
}
