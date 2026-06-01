import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core"
import { useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminQueryKey, useAdminData } from "../hooks"
import type {
  ObservabilityBucket,
  ObservabilityEvent,
  ObservabilityFileCount,
  ObservabilitySummary,
  ObservabilityTopFile,
  UserMemoryObservability,
} from "../types"
import { formatDate, relativeTime } from "../utils"
import { ErrorText } from "./TableViews"

type Filters = {
  range: "1h" | "24h" | "7d" | "30d"
  userId: string
  toolName: string
  operation: string
  status: string
  actor: string
  physicalPath: string
}

const EMPTY_FILTERS: Filters = {
  range: "24h",
  userId: "",
  toolName: "",
  operation: "",
  status: "",
  actor: "",
  physicalPath: "",
}

export function ObservabilityView({ secret }: { secret: string }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const query = useMemo(() => buildQuery(filters), [filters])
  const summary = useAdminData<ObservabilitySummary>(`/v1/admin/observability/summary?${query}`, secret)
  const timeseries = useAdminData<{ buckets: ObservabilityBucket[] }>(`/v1/admin/observability/timeseries?${query}&bucket=${filters.range === "30d" ? "day" : "hour"}`, secret)
  const topFiles = useAdminData<{ files: ObservabilityTopFile[] }>(`/v1/admin/observability/top-files?${query}&limit=10`, secret)
  const events = useAdminData<{ events: ObservabilityEvent[] }>(`/v1/admin/observability/events?${query}&limit=50`, secret)
  const userMemory = useAdminData<UserMemoryObservability>(
    filters.userId.trim() ? `/v1/admin/observability/user?${query}` : null,
    secret,
  )

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/summary?${query}`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/timeseries?${query}&bucket=${filters.range === "30d" ? "day" : "hour"}`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/top-files?${query}&limit=10`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/events?${query}&limit=50`) }),
    ])
  }

  const error = summary.error ?? timeseries.error ?? topFiles.error ?? events.error ?? userMemory.error
  const summaryData = summary.data
  const buckets = timeseries.data?.buckets ?? []
  const files = topFiles.data?.files ?? []
  const eventRows = events.data?.events ?? []

  return (
    <ScrollArea h="100%">
      <Stack gap="md" p="lg" maw={1440} mx="auto">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Title order={2} size="h3">Observability</Title>
            <Text size="sm" c="dimmed" mt={4}>Memory usage, latency, errors, and schema signals.</Text>
          </Box>
          <Group gap="xs">
            <Select
              aria-label="Time range"
              value={filters.range}
              onChange={(value) => setFilters((current) => ({ ...current, range: (value as Filters["range"]) ?? "24h" }))}
              data={[
                { value: "1h", label: "Last hour" },
                { value: "24h", label: "Last 24h" },
                { value: "7d", label: "Last 7d" },
                { value: "30d", label: "Last 30d" },
              ]}
              w={140}
              size="xs"
            />
            <Button size="xs" variant="light" onClick={refresh}>Refresh</Button>
          </Group>
        </Group>

        <Paper withBorder radius="sm" p="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 6 }} spacing="xs">
            <TextInput size="xs" label="User" placeholder="user_123" value={filters.userId} onChange={(event) => setFilters((current) => ({ ...current, userId: event.currentTarget.value }))} />
            <Select size="xs" label="Tool" placeholder="Any" clearable value={filters.toolName || null} onChange={(value) => setFilters((current) => ({ ...current, toolName: value ?? "" }))} data={["memory_list", "memory_read", "memory_write", "memory_patch", "memory_smart_read", "memory_search", "memory_memorize"]} />
            <Select size="xs" label="Operation" placeholder="Any" clearable value={filters.operation || null} onChange={(value) => setFilters((current) => ({ ...current, operation: value ?? "" }))} data={["list", "read", "write", "patch", "smart_read", "search", "memorize"]} />
            <Select size="xs" label="Status" placeholder="Any" clearable value={filters.status || null} onChange={(value) => setFilters((current) => ({ ...current, status: value ?? "" }))} data={["success", "error"]} />
            <TextInput size="xs" label="Actor" placeholder="assistant" value={filters.actor} onChange={(event) => setFilters((current) => ({ ...current, actor: event.currentTarget.value }))} />
            <TextInput size="xs" label="File path" placeholder="shared/index.md" value={filters.physicalPath} onChange={(event) => setFilters((current) => ({ ...current, physicalPath: event.currentTarget.value }))} />
          </SimpleGrid>
        </Paper>

        {error ? <ErrorText error={error} /> : null}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
          <MetricCard label="Tool calls" value={formatNumber(summaryData?.totals.toolCalls)} />
          <MetricCard label="Error rate" value={formatPercent(summaryData?.ratios.errorRate)} tone={(summaryData?.ratios.errorRate ?? 0) > 0 ? "red" : "green"} />
          <MetricCard label="p95 latency" value={formatMs(summaryData?.latency.p95Ms)} />
          <MetricCard label="Active users" value={formatNumber(summaryData?.totals.activeUsers)} />
          <MetricCard label="Read/write" value={summaryData?.ratios.readWriteRatio === null ? "n/a" : `${formatDecimal(summaryData?.ratios.readWriteRatio)} : 1`} />
        </SimpleGrid>

        {filters.userId.trim() ? (
          <UserMemoryPanel
            data={userMemory.data}
            userId={filters.userId.trim()}
            onOpenFile={(path) => navigate(`/files?path=${encodeURIComponent(path)}`)}
          />
        ) : null}

        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 0.9fr)",
            gap: 12,
          }}
        >
          <Panel title="Memory Activity" subtitle="Reads, writes, searches, and smart reads over time.">
            <StackedBars
              buckets={buckets}
              series={[
                { key: "reads", label: "Reads", color: "var(--mantine-color-blue-5)" },
                { key: "writes", label: "Writes", color: "var(--mantine-color-teal-5)" },
                { key: "searches", label: "Search", color: "var(--mantine-color-grape-5)" },
                { key: "smartReads", label: "Smart", color: "var(--mantine-color-orange-5)" },
              ]}
            />
          </Panel>
          <Panel title="Tool Latency" subtitle="p50 and p95 tool route duration.">
            <LineChart buckets={buckets} />
          </Panel>
          <Panel title="Top Files" subtitle="Most accessed memory paths.">
            <HorizontalBars
              files={files}
              onOpen={(path) => navigate(`/files?path=${encodeURIComponent(path)}`)}
            />
          </Panel>
          <Panel title="Recent Failures / Slow Calls" subtitle="Latest errors first, then the slowest calls.">
            <EventTable
              events={[...eventRows].sort((a, b) => {
                if (a.status !== b.status) return a.status === "error" ? -1 : 1
                return (b.durationMs ?? 0) - (a.durationMs ?? 0)
              }).slice(0, 10)}
              compact
            />
          </Panel>
        </Box>

        <Panel title="Event Stream" subtitle="Sanitized local observation events.">
          <EventTable events={eventRows} />
        </Panel>
      </Stack>
    </ScrollArea>
  )
}

function UserMemoryPanel({ data, userId, onOpenFile }: {
  data: UserMemoryObservability | null
  userId: string
  onOpenFile: (path: string) => void
}) {
  const summary = data?.summary
  return (
    <Panel title={`User: ${userId}`} subtitle="How this user's memory is being read, written, searched, and revised.">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="xs" mb="md">
        <MetricCard label="Files read" value={formatNumber(summary?.filesRead)} />
        <MetricCard label="Files written" value={formatNumber(summary?.filesWritten)} />
        <MetricCard label="Searches" value={formatNumber(summary?.searches)} />
        <MetricCard label="Failed calls" value={formatNumber(summary?.failedCalls)} tone={(summary?.failedCalls ?? 0) > 0 ? "red" : "green"} />
        <MetricCard label="p95 latency" value={formatMs(summary?.p95Ms)} />
      </SimpleGrid>
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <FileCountList title="Top read files" files={data?.topReadFiles ?? []} onOpenFile={onOpenFile} />
        <FileCountList title="Top written files" files={data?.topWrittenFiles ?? []} onOpenFile={onOpenFile} />
        <FileCountList title="Repeated rewrites" files={data?.rewrittenFiles ?? []} onOpenFile={onOpenFile} />
        <FileCountList title="Created, rarely read" files={data?.rarelyReadFiles ?? []} onOpenFile={onOpenFile} />
      </Box>
      <Box mt="md">
        <Text size="sm" fw={650} mb={6}>Recent user tool calls</Text>
        <EventTable events={data?.recentEvents ?? []} compact />
      </Box>
    </Panel>
  )
}

function FileCountList({ title, files, onOpenFile }: {
  title: string
  files: ObservabilityFileCount[]
  onOpenFile: (path: string) => void
}) {
  return (
    <Paper withBorder radius="sm" p="sm" bg="gray.0">
      <Text size="xs" fw={650} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>{title}</Text>
      <Stack gap={6} mt="xs">
        {files.length ? files.map((file) => (
          <UnstyledButton key={file.physicalPath} onClick={() => onOpenFile(file.physicalPath)} style={{ width: "100%" }}>
            <Group gap="xs" justify="space-between" wrap="nowrap">
              <Code style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{file.physicalPath}</Code>
              <Badge size="xs" variant="light">{file.count}</Badge>
            </Group>
          </UnstyledButton>
        )) : <Text size="xs" c="dimmed">No matching files.</Text>}
      </Stack>
    </Paper>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: "red" | "green" }) {
  return (
    <Paper withBorder radius="sm" p="md">
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: "0.04em" }}>{label}</Text>
      <Text size="xl" fw={650} c={tone ? `${tone}.7` : "gray.9"} mt={4}>{value}</Text>
    </Paper>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Paper withBorder radius="sm" p="md" style={{ minWidth: 0, minHeight: 260 }}>
      <Group justify="space-between" align="flex-start" mb="sm">
        <Box>
          <Text fw={650}>{title}</Text>
          <Text size="xs" c="dimmed">{subtitle}</Text>
        </Box>
      </Group>
      {children}
    </Paper>
  )
}

function StackedBars({ buckets, series }: {
  buckets: ObservabilityBucket[]
  series: Array<{ key: "reads" | "writes" | "searches" | "smartReads"; label: string; color: string }>
}) {
  if (!buckets.length) return <EmptyChart />
  const max = Math.max(1, ...buckets.map((bucket) => series.reduce((sum, item) => sum + Number(bucket[item.key] ?? 0), 0)))
  const width = 720
  const height = 220
  const gap = 3
  const barWidth = Math.max(4, (width - gap * (buckets.length - 1)) / buckets.length)

  return (
    <Box>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Memory activity chart">
        <line x1="0" x2={width} y1={height - 22} y2={height - 22} stroke="var(--mantine-color-gray-3)" />
        {buckets.map((bucket, index) => {
          const x = index * (barWidth + gap)
          let y = height - 22
          return (
            <g key={bucket.bucketStart}>
              {series.map((item) => {
                const value = Number(bucket[item.key] ?? 0)
                const h = (value / max) * (height - 42)
                y -= h
                return <rect key={item.key} x={x} y={y} width={barWidth} height={h} fill={item.color} rx={1} />
              })}
            </g>
          )
        })}
      </svg>
      <Group gap="xs" mt={4}>
        {series.map((item) => <Legend key={item.key} color={item.color} label={item.label} />)}
      </Group>
    </Box>
  )
}

function LineChart({ buckets }: { buckets: ObservabilityBucket[] }) {
  if (!buckets.length || buckets.every((bucket) => bucket.p50Ms === null && bucket.p95Ms === null)) return <EmptyChart />
  const width = 520
  const height = 220
  const values = buckets.flatMap((bucket) => [bucket.p50Ms ?? 0, bucket.p95Ms ?? 0])
  const max = Math.max(1, ...values)
  const x = (index: number) => buckets.length === 1 ? width / 2 : (index / (buckets.length - 1)) * (width - 16) + 8
  const y = (value: number | null) => height - 22 - ((value ?? 0) / max) * (height - 42)
  const pathFor = (key: "p50Ms" | "p95Ms") => buckets.map((bucket, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(bucket[key])}`).join(" ")

  return (
    <Box>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Tool latency chart">
        <line x1="0" x2={width} y1={height - 22} y2={height - 22} stroke="var(--mantine-color-gray-3)" />
        <path d={pathFor("p95Ms")} fill="none" stroke="var(--mantine-color-red-5)" strokeWidth="2" />
        <path d={pathFor("p50Ms")} fill="none" stroke="var(--mantine-color-blue-5)" strokeWidth="2" />
      </svg>
      <Group gap="xs" mt={4}>
        <Legend color="var(--mantine-color-blue-5)" label="p50" />
        <Legend color="var(--mantine-color-red-5)" label="p95" />
      </Group>
    </Box>
  )
}

function HorizontalBars({ files, onOpen }: { files: ObservabilityTopFile[]; onOpen: (path: string) => void }) {
  if (!files.length) return <EmptyChart />
  const max = Math.max(1, ...files.map((file) => file.totalHits))
  return (
    <Stack gap={8}>
      {files.map((file) => (
        <UnstyledButton key={file.physicalPath} onClick={() => onOpen(file.physicalPath)} style={{ width: "100%" }}>
          <Group gap="xs" wrap="nowrap">
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Code style={{ maxWidth: "75%", overflow: "hidden", textOverflow: "ellipsis" }}>{file.physicalPath}</Code>
                <Text size="xs" c="dimmed">{file.totalHits} hits</Text>
              </Group>
              <Box mt={5} h={7} bg="gray.1" style={{ borderRadius: 4, overflow: "hidden" }}>
                <Box h="100%" w={`${Math.max(3, (file.totalHits / max) * 100)}%`} bg="blue.5" />
              </Box>
            </Box>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  )
}

function EventTable({ events, compact = false }: { events: ObservabilityEvent[]; compact?: boolean }) {
  if (!events.length) return <Text size="sm" c="dimmed" py="xl" ta="center">No events for this filter.</Text>
  return (
    <ScrollArea>
      <Table striped highlightOnHover stickyHeader={!compact} fz="xs" miw={compact ? 520 : 920}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Tool</Table.Th>
            {!compact && <Table.Th>Operation</Table.Th>}
            <Table.Th>User</Table.Th>
            {!compact && <Table.Th>Path</Table.Th>}
            <Table.Th>Duration</Table.Th>
            <Table.Th>Error</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {events.map((event) => (
            <Table.Tr key={event.id}>
              <Table.Td>
                <Tooltip label={formatDate(event.createdAt)}>
                  <Text size="xs" style={{ whiteSpace: "nowrap" }}>{relativeTime(event.createdAt)}</Text>
                </Tooltip>
              </Table.Td>
              <Table.Td><Badge size="xs" color={event.status === "error" ? "red" : "green"} variant="light">{event.status}</Badge></Table.Td>
              <Table.Td>{event.toolName ?? event.eventType}</Table.Td>
              {!compact && <Table.Td>{event.operation ?? ""}</Table.Td>}
              <Table.Td>{event.userId ?? ""}</Table.Td>
              {!compact && <Table.Td><Code>{event.physicalPath ?? ""}</Code></Table.Td>}
              <Table.Td>{formatMs(event.durationMs)}</Table.Td>
              <Table.Td>{event.errorCode ?? ""}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}

function EmptyChart() {
  return (
    <Box h={220} display="flex" style={{ alignItems: "center", justifyContent: "center", border: "1px dashed var(--mantine-color-gray-3)", borderRadius: 6 }}>
      <Text size="sm" c="dimmed">No data for this filter.</Text>
    </Box>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={5}>
      <Box w={8} h={8} style={{ borderRadius: 2, background: color }} />
      <Text size="xs" c="dimmed">{label}</Text>
    </Group>
  )
}

function buildQuery(filters: Filters) {
  const params = new URLSearchParams()
  params.set("from", rangeStart(filters.range).toISOString())
  for (const [key, value] of Object.entries(filters)) {
    if (key === "range") continue
    const trimmed = String(value).trim()
    if (trimmed) params.set(key, trimmed)
  }
  return params.toString()
}

function rangeStart(range: Filters["range"]) {
  const now = Date.now()
  if (range === "1h") return new Date(now - 60 * 60 * 1000)
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000)
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000)
  return new Date(now - 24 * 60 * 60 * 1000)
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "0"
}

function formatPercent(value: number | null | undefined) {
  return `${(((value ?? 0) * 100)).toFixed(1)}%`
}

function formatDecimal(value: number | null | undefined) {
  if (value === null || value === undefined) return "0"
  return value.toFixed(value >= 10 ? 0 : 1)
}

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a"
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value)}ms`
}
