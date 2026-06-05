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
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminQueryKey, useAdminData } from "../hooks"
import type {
  AdminUser,
  ObservabilityBucket,
  ObservabilityEvent,
  ObservabilityFileCount,
  ObservabilitySummary,
  ObservabilityTopFile,
  ObservabilityTree,
  ObservabilityTreeNode,
  ObservabilityTreeNodeDetail,
  UserMemoryObservability,
} from "../types"
import { formatDate, relativeTime } from "../utils"
import { ErrorText } from "./TableViews"

type Filters = {
  range: "1h" | "24h" | "7d" | "30d"
  mode: "all" | "user"
  userId: string
  toolName: string
  operation: string
  status: string
  actor: string
  physicalPath: string
}

const EMPTY_FILTERS: Filters = {
  range: "24h",
  mode: "all",
  userId: "",
  toolName: "",
  operation: "",
  status: "",
  actor: "",
  physicalPath: "",
}

export function ObservabilityView({ secret }: { secret: string }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [selectedNodePath, setSelectedNodePath] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const query = useMemo(() => buildQuery(filters), [filters])
  const users = useAdminData<{ users: AdminUser[] }>("/v1/admin/users?limit=100", secret)
  const summary = useAdminData<ObservabilitySummary>(`/v1/admin/observability/summary?${query}`, secret)
  const timeseries = useAdminData<{ buckets: ObservabilityBucket[] }>(`/v1/admin/observability/timeseries?${query}&bucket=${filters.range === "30d" ? "day" : "hour"}`, secret)
  const topFiles = useAdminData<{ files: ObservabilityTopFile[] }>(`/v1/admin/observability/top-files?${query}&limit=10`, secret)
  const tree = useAdminData<ObservabilityTree>(`/v1/admin/observability/tree?${query}`, secret)
  const events = useAdminData<{ events: ObservabilityEvent[] }>(`/v1/admin/observability/events?${query}&limit=50`, secret)
  const userMemory = useAdminData<UserMemoryObservability>(
    filters.mode === "user" && filters.userId.trim() ? `/v1/admin/observability/user?${query}` : null,
    secret,
  )
  const selectedNode = selectedNodePath ?? tree.data?.selectedNode?.normalizedPath ?? tree.data?.nodes[0]?.normalizedPath ?? null
  const selectedNodeDetail = useAdminData<ObservabilityTreeNodeDetail>(
    selectedNode ? `/v1/admin/observability/tree-node?${query}&path=${encodeURIComponent(selectedNode)}&bucket=${filters.range === "30d" ? "day" : "hour"}` : null,
    secret,
  )

  useEffect(() => {
    if (filters.mode !== "user" || filters.userId.trim() || !users.data?.users.length) return
    setFilters((current) => ({ ...current, userId: users.data?.users[0]?.userId ?? "" }))
  }, [filters.mode, filters.userId, users.data?.users])

  useEffect(() => {
    setSelectedNodePath(null)
  }, [query])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/summary?${query}`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/timeseries?${query}&bucket=${filters.range === "30d" ? "day" : "hour"}`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/top-files?${query}&limit=10`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/tree?${query}`) }),
      queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/observability/events?${query}&limit=50`) }),
    ])
  }

  const error = summary.error ?? timeseries.error ?? topFiles.error ?? tree.error ?? events.error ?? userMemory.error ?? selectedNodeDetail.error
  const summaryData = summary.data
  const buckets = timeseries.data?.buckets ?? []
  const files = topFiles.data?.files ?? []
  const eventRows = events.data?.events ?? []
  const userOptions = (users.data?.users ?? []).map((user) => ({ value: user.userId, label: user.userId }))

  return (
    <ScrollArea h="100%">
      <Stack gap="md" p="lg" maw={1440} mx="auto">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Title order={2} size="h3">Observability</Title>
            <Text size="sm" c="dimmed" mt={4}>System health, memory topology, hygiene, and usage evolution.</Text>
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
            <Select size="xs" label="Mode" value={filters.mode} onChange={(value) => setFilters((current) => ({ ...current, mode: (value as Filters["mode"]) ?? "all", userId: value === "user" ? current.userId : "" }))} data={[{ value: "all", label: "All" }, { value: "user", label: "User" }]} />
            <Select size="xs" label="Scope" placeholder={filters.mode === "user" ? "Select scope" : "All scopes"} disabled={filters.mode !== "user"} searchable clearable={false} value={filters.mode === "user" ? filters.userId || null : null} onChange={(value) => setFilters((current) => ({ ...current, userId: value ?? "" }))} data={userOptions} />
            <Select size="xs" label="Tool" placeholder="Any" clearable value={filters.toolName || null} onChange={(value) => setFilters((current) => ({ ...current, toolName: value ?? "" }))} data={["memory_list", "memory_read", "memory_write", "memory_patch", "memory_smart_read", "memory_search", "memory_memorize"]} />
            <Select size="xs" label="Operation" placeholder="Any" clearable value={filters.operation || null} onChange={(value) => setFilters((current) => ({ ...current, operation: value ?? "" }))} data={["list", "read", "write", "patch", "smart_read", "search", "memorize"]} />
            <Select size="xs" label="Status" placeholder="Any" clearable value={filters.status || null} onChange={(value) => setFilters((current) => ({ ...current, status: value ?? "" }))} data={["success", "error"]} />
            <TextInput size="xs" label="Actor" placeholder="assistant" value={filters.actor} onChange={(event) => setFilters((current) => ({ ...current, actor: event.currentTarget.value }))} />
          </SimpleGrid>
        </Paper>

        {error ? <ErrorText error={error} /> : null}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="sm">
          <MetricCard label="Tool calls" value={formatNumber(summaryData?.totals.toolCalls)} />
          <MetricCard label="Error rate" value={formatPercent(summaryData?.ratios.errorRate)} tone={(summaryData?.ratios.errorRate ?? 0) > 0 ? "red" : "green"} />
          <MetricCard label="p95 latency" value={formatMs(summaryData?.latency.p95Ms)} />
          <MetricCard label="Active scopes" value={formatNumber(summaryData?.totals.activeUsers)} />
          <MetricCard label="Read/write" value={summaryData ? (summaryData.ratios.readWriteRatio === null ? "n/a" : `${formatDecimal(summaryData.ratios.readWriteRatio)} : 1`) : "n/a"} />
          <MetricCard label="SLA" value={(summaryData?.ratios.errorRate ?? 0) > 0.1 || (summaryData?.latency.p95Ms ?? 0) > 1000 ? "watch" : "ok"} tone={(summaryData?.ratios.errorRate ?? 0) > 0.1 || (summaryData?.latency.p95Ms ?? 0) > 1000 ? "red" : "green"} />
        </SimpleGrid>

        <TopologyPanel
          tree={tree.data}
          selectedPath={selectedNode}
          onSelect={setSelectedNodePath}
        />

        {filters.mode === "user" && filters.userId.trim() ? (
          <UserMemoryPanel
            data={userMemory.data}
            userId={filters.userId.trim()}
            onOpenFile={(path) => navigate(`/files?path=${encodeURIComponent(path)}`)}
          />
        ) : null}

        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
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
              onOpen={setSelectedNodePath}
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

        <MemoryTreePanel
          tree={tree.data}
          detail={selectedNodeDetail.data}
          selectedPath={selectedNode}
          onSelect={setSelectedNodePath}
          onOpenFile={(path) => navigate(`/files?path=${encodeURIComponent(path)}`)}
        />

        <MemoryHygienePanel tree={tree.data} onSelect={setSelectedNodePath} />

        <Panel title="Event Stream" subtitle="Sanitized local observation events.">
          <EventTable events={eventRows} />
        </Panel>
      </Stack>
    </ScrollArea>
  )
}

function TopologyPanel({ tree, selectedPath, onSelect }: {
  tree: ObservabilityTree | null
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const roots = (tree?.nodes ?? []).filter((node) => node.parentPath === null)
  const summary = tree?.summary
  return (
    <Panel title="Memory Topology" subtitle="A heat map of shared guidance and scoped memory usage.">
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        <Stack gap={5}>
          <Text size="xs" c="dimmed" fw={650} tt="uppercase" style={{ letterSpacing: "0.04em" }}>Topology Map</Text>
          {roots.length ? roots.map((root) => (
            <TopologyNode
              key={root.normalizedPath}
              node={root}
              nodes={tree?.nodes ?? []}
              selectedPath={selectedPath}
              onSelect={onSelect}
              maxHits={Math.max(1, ...((tree?.nodes ?? []).map((node) => node.totalHits)))}
            />
          )) : <Text size="sm" c="dimmed">No memory activity for this filter yet.</Text>}
        </Stack>
        <Stack gap={8}>
          <Text size="xs" c="dimmed" fw={650} tt="uppercase" style={{ letterSpacing: "0.04em" }}>Hygiene Summary</Text>
          <MiniStat label="Hot files" value={summary?.hotFiles} />
          <MiniStat label="Cold files" value={summary?.coldFiles} />
          <MiniStat label="High churn" value={summary?.highChurn} />
          <MiniStat label="Large hot files" value={summary?.hotLargeFiles} />
          <MiniStat label="Search-heavy" value={summary?.searchHeavy} />
        </Stack>
        <Stack gap={8}>
          <Text size="xs" c="dimmed" fw={650} tt="uppercase" style={{ letterSpacing: "0.04em" }}>Evolution</Text>
          <MiniStat label="Revisions" value={summary?.revisions} />
          <MiniStat label="New files" value={summary?.newFiles} />
          <MiniStat label="Updated" value={summary?.updatedFiles} />
          <MiniStat label="Stale" value={summary?.staleFiles} />
        </Stack>
      </Box>
    </Panel>
  )
}

function TopologyNode({ node, nodes, selectedPath, onSelect, maxHits }: {
  node: ObservabilityTreeNode
  nodes: ObservabilityTreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
  maxHits: number
}) {
  const children = nodes.filter((item) => item.parentPath === node.normalizedPath).sort((a, b) => b.totalHits - a.totalHits)
  const selected = selectedPath === node.normalizedPath
  return (
    <Box>
      <UnstyledButton onClick={() => onSelect(node.normalizedPath)} style={{ width: "100%" }}>
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 1fr) minmax(90px, 0.8fr) auto",
            gap: 8,
            alignItems: "center",
            minHeight: 28,
            padding: "3px 6px",
            paddingLeft: 6 + node.depth * 16,
            borderRadius: 4,
            background: selected ? "var(--mantine-color-blue-0)" : "transparent",
          }}
        >
          <Code style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{node.normalizedPath}</Code>
          <HeatBar value={node.totalHits} max={maxHits} />
          <Group gap={5} wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>{node.totalHits} hits</Text>
            {node.badges.slice(0, 2).map((badge) => <SignalBadge key={badge} badge={badge} />)}
          </Group>
        </Box>
      </UnstyledButton>
      {children.slice(0, node.depth === 0 ? 8 : 4).map((child) => (
        <TopologyNode key={child.normalizedPath} node={child} nodes={nodes} selectedPath={selectedPath} onSelect={onSelect} maxHits={maxHits} />
      ))}
    </Box>
  )
}

function MemoryTreePanel({ tree, detail, selectedPath, onSelect, onOpenFile }: {
  tree: ObservabilityTree | null
  detail: ObservabilityTreeNodeDetail | null
  selectedPath: string | null
  onSelect: (path: string) => void
  onOpenFile: (path: string) => void
}) {
  const nodes = tree?.nodes ?? []
  const selected = detail?.node ?? nodes.find((node) => node.normalizedPath === selectedPath) ?? null
  return (
    <Panel title="Memory Tree" subtitle="Drill from aggregate memory concepts into exact concrete paths.">
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <Paper withBorder radius="sm" p="sm" bg="gray.0">
          <Stack gap={4}>
            {nodes.filter((node) => node.parentPath === null).map((node) => (
              <TreeRow key={node.normalizedPath} node={node} nodes={nodes} selectedPath={selectedPath} onSelect={onSelect} />
            ))}
            {!nodes.length ? <Text size="sm" c="dimmed">No memory activity for this filter yet.</Text> : null}
          </Stack>
        </Paper>
        <Paper withBorder radius="sm" p="md">
          {selected ? (
            <Stack gap="md">
              <Box>
                <Text size="xs" c="dimmed" fw={650} tt="uppercase" style={{ letterSpacing: "0.04em" }}>Selected Node</Text>
                <Code>{selected.normalizedPath}</Code>
              </Box>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xs">
                <MiniMetric label="Hits" value={selected.totalHits} />
                <MiniMetric label="Reads" value={selected.reads} />
                <MiniMetric label="Writes" value={selected.writes} />
                <MiniMetric label={selected.kind === "folder" ? "Peak p95" : "p95"} value={formatMs(selected.p95Ms)} />
                <MiniMetric label="Scopes" value={selected.uniqueUsers} />
                <MiniMetric label="Errors" value={selected.errors} />
                <MiniMetric label="Revisions" value={selected.revisions} />
                <MiniMetric label="Files" value={selected.files} />
              </SimpleGrid>
              <TinyActivityChart buckets={detail?.activity ?? []} />
              <Box
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 12,
                }}
              >
                <CountList
                  title="Top concrete paths"
                  rows={(detail?.topConcretePaths ?? []).map((row) => ({
                    label: displayMemoryPath(row.physicalPath),
                    count: row.count,
                    onClick: isConcreteMemoryPath(row.physicalPath) ? () => onOpenFile(row.physicalPath) : undefined,
                  }))}
                />
                <CountList
                  title="Top scopes"
                  rows={(detail?.topScopes ?? []).map((row) => ({ label: row.userId ?? "unknown", count: row.count }))}
                />
                <CountList
                  title="Co-hit memory concepts"
                  rows={(detail?.coHitNodes ?? []).map((row) => ({ label: row.normalizedPath, count: row.count, onClick: () => onSelect(row.normalizedPath) }))}
                />
              </Box>
            </Stack>
          ) : <Text size="sm" c="dimmed">Select a node to inspect it.</Text>}
        </Paper>
      </Box>
    </Panel>
  )
}

function TreeRow({ node, nodes, selectedPath, onSelect }: {
  node: ObservabilityTreeNode
  nodes: ObservabilityTreeNode[]
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const children = nodes.filter((item) => item.parentPath === node.normalizedPath).sort((a, b) => b.totalHits - a.totalHits)
  const selected = selectedPath === node.normalizedPath
  return (
    <Box>
      <UnstyledButton onClick={() => onSelect(node.normalizedPath)} style={{ width: "100%" }}>
        <Group
          gap="xs"
          justify="space-between"
          wrap="nowrap"
          style={{
            minHeight: 24,
            paddingLeft: node.depth * 14,
            borderRadius: 4,
            background: selected ? "var(--mantine-color-blue-0)" : "transparent",
          }}
        >
          <Code style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{node.label}{node.kind === "folder" ? "/" : ""}</Code>
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="dimmed">{node.totalHits}</Text>
            {node.badges.slice(0, 1).map((badge) => <SignalBadge key={badge} badge={badge} />)}
          </Group>
        </Group>
      </UnstyledButton>
      {children.slice(0, 25).map((child) => <TreeRow key={child.normalizedPath} node={child} nodes={nodes} selectedPath={selectedPath} onSelect={onSelect} />)}
      {children.length > 25 ? (
        <Text size="xs" c="dimmed" pl={node.depth * 14 + 14}>
          {children.length - 25} more nodes hidden by this view.
        </Text>
      ) : null}
    </Box>
  )
}

function MemoryHygienePanel({ tree, onSelect }: { tree: ObservabilityTree | null; onSelect: (path: string) => void }) {
  const hygiene = tree?.hygiene
  return (
    <Panel title="Memory Hygiene" subtitle="Hot, cold, churn-heavy, large, search-heavy, and shared guidance signals.">
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        <NodeSignalList title="Hot files" nodes={hygiene?.hotFiles ?? []} onSelect={onSelect} detail="hits" />
        <NodeSignalList title="Cold files" nodes={hygiene?.coldFiles ?? []} onSelect={onSelect} detail="no hits" />
        <NodeSignalList title="High revision churn" nodes={hygiene?.highChurn ?? []} onSelect={onSelect} detail="revisions" countKey="revisions" />
        <NodeSignalList title="Hot large files" nodes={hygiene?.hotLargeFiles ?? []} onSelect={onSelect} detail="chars" countKey="size" />
        <NodeSignalList title="Search-heavy nodes" nodes={hygiene?.searchHeavy ?? []} onSelect={onSelect} detail="searches" countKey="searches" />
        <NodeSignalList title="Shared guidance usage" nodes={hygiene?.sharedUsage ?? []} onSelect={onSelect} detail="hits" />
      </Box>
    </Panel>
  )
}

function NodeSignalList({ title, nodes, onSelect, detail, countKey = "totalHits" }: {
  title: string
  nodes: ObservabilityTreeNode[]
  onSelect: (path: string) => void
  detail: string
  countKey?: "totalHits" | "revisions" | "size" | "searches"
}) {
  return (
    <Paper withBorder radius="sm" p="sm" bg="gray.0">
      <Text size="xs" fw={650} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>{title}</Text>
      <Stack gap={6} mt="xs">
        {nodes.length ? nodes.map((node) => {
          const value = countKey === "size" ? (node.size ?? 0) : countKey === "searches" ? node.searches + node.smartReads : node[countKey]
          return (
            <UnstyledButton key={node.normalizedPath} onClick={() => onSelect(node.normalizedPath)} style={{ width: "100%" }}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Code style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>{node.normalizedPath}</Code>
                  <Text size="xs" c="dimmed" truncate>{detail}</Text>
                </Box>
                <Badge size="xs" variant="light">{value}</Badge>
              </Group>
            </UnstyledButton>
          )
        }) : <Text size="xs" c="dimmed">No signal yet.</Text>}
      </Stack>
    </Paper>
  )
}

function MiniStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={650}>{formatNumber(value)}</Text>
    </Group>
  )
}

function MiniMetric({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <Paper withBorder radius="sm" p="xs" bg="gray.0">
      <Text size="xs" c="dimmed" fw={600}>{label}</Text>
      <Text size="sm" fw={650}>{typeof value === "number" ? formatNumber(value) : value ?? "n/a"}</Text>
    </Paper>
  )
}

function CountList({ title, rows }: { title: string; rows: Array<{ label: string; count: number; onClick?: () => void }> }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" fw={650} tt="uppercase" style={{ letterSpacing: "0.04em" }}>{title}</Text>
      <Stack gap={5} mt={6}>
        {rows.length ? rows.map((row) => (
          <UnstyledButton key={row.label} onClick={row.onClick} disabled={!row.onClick} style={{ width: "100%" }}>
            <Group justify="space-between" wrap="nowrap">
              <Code style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</Code>
              <Badge size="xs" variant="light">{row.count}</Badge>
            </Group>
          </UnstyledButton>
        )) : <Text size="xs" c="dimmed">No rows yet.</Text>}
      </Stack>
    </Box>
  )
}

function HeatBar({ value, max }: { value: number; max: number }) {
  const width = Math.max(4, (value / max) * 100)
  return (
    <Box h={7} bg="gray.1" style={{ borderRadius: 4, overflow: "hidden" }}>
      <Box h="100%" w={`${width}%`} bg="blue.5" />
    </Box>
  )
}

function SignalBadge({ badge }: { badge: string }) {
  const color = badge === "risk" ? "red" : badge === "churn" || badge === "large" ? "yellow" : badge === "cold" ? "gray" : "blue"
  return <Badge size="xs" color={color} variant="light">{badge}</Badge>
}

function TinyActivityChart({ buckets }: { buckets: ObservabilityTreeNodeDetail["activity"] }) {
  if (!buckets.length) return null
  const converted = buckets.map((bucket) => ({
    ...bucket,
    toolCalls: 0,
    errors: 0,
    p50Ms: null,
    p95Ms: null,
  }))
  return (
    <Box>
      <Text size="xs" c="dimmed" fw={650} mb={4} tt="uppercase" style={{ letterSpacing: "0.04em" }}>Reads/Writes/Search trend</Text>
      <StackedBars
        buckets={converted}
        series={[
          { key: "reads", label: "Reads", color: "var(--mantine-color-blue-5)" },
          { key: "writes", label: "Writes", color: "var(--mantine-color-teal-5)" },
          { key: "searches", label: "Search", color: "var(--mantine-color-grape-5)" },
          { key: "smartReads", label: "Smart", color: "var(--mantine-color-orange-5)" },
        ]}
      />
    </Box>
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
        <UnstyledButton key={file.normalizedPath ?? file.physicalPath} onClick={() => onOpen(file.normalizedPath ?? file.physicalPath)} style={{ width: "100%" }}>
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
            {!compact && <Table.Th>Trace</Table.Th>}
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
              {!compact && <Table.Td><Code>{event.traceId ?? event.toolCallId ?? ""}</Code></Table.Td>}
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

function displayMemoryPath(path: string) {
  return path === "*" ? "search activity" : path
}

function isConcreteMemoryPath(path: string) {
  return path.startsWith("shared/") || /^users\/[^/]+\//.test(path)
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
