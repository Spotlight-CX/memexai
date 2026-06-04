import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Code,
  Collapse,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tree,
  filterTreeData,
  getTreeExpandedState,
  useTree,
} from "@mantine/core"
import { DateTimePicker } from "@mantine/dates"
import React, { useEffect, useMemo, useState } from "react"
import { FileTreeItem } from "./FileTree"
import type { AdminFile } from "../types"
import { deriveTree } from "../utils"

export type TimeTravelRevisionMeta = {
  id: string
  operation: string
  actor: string | null
  reason: string | null
  createdAt: string
}

export type TimeTravelFile = {
  physicalPath: string
  content: string
  createdAt: string
  updatedAt: string
  matchedRevision: TimeTravelRevisionMeta | null
}

export type FilesTimeTravelPreviewProps = {
  currentFiles: TimeTravelFile[]
  historicalFiles: TimeTravelFile[]
  initialAsOfLocal?: string
  initialMode?: "current" | "time-travel"
  initialPanel?: "document" | "diff"
  initialPath?: string
}

type ViewMode = "current" | "time-travel"
type CenterPanel = "document" | "diff"

export function FilesTimeTravelPreview({
  currentFiles,
  historicalFiles,
  initialAsOfLocal = "2026-06-02 12:17:00",
  initialMode = "current",
  initialPanel = "document",
  initialPath,
}: FilesTimeTravelPreviewProps) {
  const [mode, setMode] = useState<ViewMode>(initialMode)
  const [asOfLocal, setAsOfLocal] = useState(initialAsOfLocal)
  const [selectedPath, setSelectedPath] = useState(initialPath ?? currentFiles[0]?.physicalPath ?? historicalFiles[0]?.physicalPath ?? "")
  const [search, setSearch] = useState("")
  const [panel, setPanel] = useState<CenterPanel>(initialPanel)

  const isTimeTravel = mode === "time-travel"
  const visibleFiles = isTimeTravel ? historicalFiles : currentFiles
  const selectedFile = visibleFiles.find((file) => file.physicalPath === selectedPath) ?? visibleFiles[0] ?? null
  const currentFile = selectedFile ? currentFiles.find((file) => file.physicalPath === selectedFile.physicalPath) ?? null : null
  const historicalFile = selectedFile ? historicalFiles.find((file) => file.physicalPath === selectedFile.physicalPath) ?? null : null

  useEffect(() => {
    if (!selectedFile && visibleFiles[0]) {
      setSelectedPath(visibleFiles[0].physicalPath)
    }
  }, [selectedFile, visibleFiles])

  const handleSetCurrent = () => {
    setMode("current")
    setPanel("document")
  }

  const handleSetTimeTravel = (value: string) => {
    setAsOfLocal(value)
    setMode("time-travel")
    setPanel("document")
  }

  const handleClear = () => {
    setMode("current")
    setPanel("document")
  }

  const handleOpenLatest = () => {
    if (selectedFile) setSelectedPath(selectedFile.physicalPath)
    setMode("current")
    setPanel("document")
  }

  const handleShowDiff = () => {
    setMode("time-travel")
    setPanel("diff")
  }

  const hasCurrent = Boolean(currentFile)
  const changedSinceTimestamp = Boolean(historicalFile && currentFile && historicalFile.content !== currentFile.content)

  return (
    <Box h="100vh" bg="gray.0" style={{ display: "flex", flexDirection: "column" }}>
      <TimeTravelToolbar
        mode={mode}
        panel={panel}
        asOfLocal={asOfLocal}
        onSetCurrent={handleSetCurrent}
        onSetAsOf={handleSetTimeTravel}
        onClear={handleClear}
        onShowDocument={() => setPanel("document")}
        onShowDiff={handleShowDiff}
      />
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "264px minmax(520px, 1fr) 316px",
          minHeight: 0,
          flex: 1,
          borderTop: "1px solid var(--mantine-color-gray-2)",
        }}
      >
        <TimeTravelExplorer
          files={visibleFiles}
          mode={mode}
          search={search}
          selectedPath={selectedFile?.physicalPath ?? ""}
          onSearchChange={setSearch}
          onSelectPath={(path) => {
            setSelectedPath(path)
            setPanel("document")
          }}
        />
        {panel === "diff" && historicalFile ? (
          <TimeTravelDiffPanel historicalFile={historicalFile} currentFile={currentFile} />
        ) : (
          <TimeTravelDocumentPanel file={selectedFile} mode={mode} asOfLocal={asOfLocal} />
        )}
        {mode === "time-travel" && historicalFile ? (
          <MatchedRevisionSidebar
            historicalFile={historicalFile}
            currentFile={currentFile}
            asOfLocal={asOfLocal}
            changedSinceTimestamp={changedSinceTimestamp}
            hasCurrent={hasCurrent}
            onOpenLatest={handleOpenLatest}
            onShowDiff={handleShowDiff}
          />
        ) : (
          <CurrentFileSidebar file={selectedFile} />
        )}
      </Box>
    </Box>
  )
}

function TimeTravelToolbar({
  mode,
  panel,
  asOfLocal,
  onSetCurrent,
  onSetAsOf,
  onClear,
  onShowDocument,
  onShowDiff,
}: {
  mode: ViewMode
  panel: CenterPanel
  asOfLocal: string
  onSetCurrent: () => void
  onSetAsOf: (value: string) => void
  onClear: () => void
  onShowDocument: () => void
  onShowDiff: () => void
}) {
  const isTimeTravel = mode === "time-travel"

  return (
    <Paper radius={0} px="md" py="sm" bg="white">
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <Title order={2} size="h4">Files</Title>
          <Badge variant={isTimeTravel ? "light" : "dot"} color={isTimeTravel ? "yellow" : "green"}>
            {isTimeTravel ? "As of timestamp" : "Current"}
          </Badge>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" variant={isTimeTravel ? "light" : "filled"} color="gray" onClick={onSetCurrent}>
            Current
          </Button>
          <DateTimePicker
            aria-label="As of timestamp"
            size="xs"
            value={isTimeTravel ? asOfLocal : null}
            placeholder="Select timestamp"
            valueFormat="YYYY-MM-DD HH:mm:ss"
            defaultTimeValue="12:17:00"
            w={250}
            onChange={(value) => {
              if (value) onSetAsOf(value)
            }}
          />
          <Button size="xs" variant="light" color="gray" disabled={!isTimeTravel} onClick={onClear}>
            Clear
          </Button>
          <Button
            size="xs"
            variant="light"
            color="gray"
            disabled={!isTimeTravel}
            onClick={() => navigator.clipboard?.writeText(`?asOf=${toUtcIso(asOfLocal)}`).catch(() => {})}
          >
            Copy link
          </Button>
          <Divider orientation="vertical" />
          <Button size="xs" variant={panel === "document" ? "filled" : "light"} color="blue" onClick={onShowDocument}>
            Document
          </Button>
          <Button size="xs" variant={panel === "diff" ? "filled" : "light"} color="blue" disabled={!isTimeTravel} onClick={onShowDiff}>
            Diff current
          </Button>
        </Group>
      </Group>
    </Paper>
  )
}

function TimeTravelExplorer({
  files,
  mode,
  search,
  selectedPath,
  onSearchChange,
  onSelectPath,
}: {
  files: TimeTravelFile[]
  mode: ViewMode
  search: string
  selectedPath: string
  onSearchChange: (value: string) => void
  onSelectPath: (path: string) => void
}) {
  const tree = useTree()
  const summaries = useMemo<AdminFile[]>(() => files.map(toAdminFile), [files])
  const fileTree = useMemo(() => deriveTree(summaries), [summaries])
  const filePaths = useMemo(() => new Set(files.map((file) => file.physicalPath)), [files])
  const filteredTree = useMemo(() => filterTreeData(fileTree, search.trim()), [fileTree, search])
  const isTimeTravel = mode === "time-travel"

  useEffect(() => {
    if (selectedPath) tree.select(selectedPath)
  }, [selectedPath])

  useEffect(() => {
    tree.setExpandedState(getTreeExpandedState(filteredTree, "*"))
  }, [filteredTree])

  return (
    <Stack gap={0} h="100%" bg="white" style={{ minHeight: 0, borderRight: "1px solid var(--mantine-color-gray-2)" }}>
      <Box px={12} pt={12} pb={8}>
        <Group justify="space-between" mb={6}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">Explorer</Text>
          {isTimeTravel ? <Badge size="xs" color="yellow" variant="light">historical tree</Badge> : null}
        </Group>
        <TextInput
          size="xs"
          placeholder="Search files..."
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
        {isTimeTravel ? (
          <Text size="xs" c="dimmed" mt={6}>Files created after the selected time are hidden.</Text>
        ) : null}
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
                filePaths={filePaths}
                onSelectPath={onSelectPath}
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
  )
}

function TimeTravelDocumentPanel({ file, mode, asOfLocal }: { file: TimeTravelFile | null; mode: ViewMode; asOfLocal: string }) {
  if (!file) {
    return (
      <Box pt={120} ta="center">
        <Text size="xl" fw={500} c="gray.7">Select a file</Text>
      </Box>
    )
  }

  const isTimeTravel = mode === "time-travel"

  return (
    <ScrollArea h="100%">
      <Box px={{ base: "xl", xl: 56 }} py={36}>
        <Stack gap="md" maw={860} mx="auto">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Code style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{file.physicalPath}</Code>
            {isTimeTravel ? <Badge color="yellow" variant="light">historical</Badge> : <Badge color="green" variant="dot">latest</Badge>}
          </Group>
          {isTimeTravel ? (
            <Paper withBorder p="sm" radius="sm" bg="yellow.0">
              <Text size="sm" c="yellow.9">
                Viewing the latest revision before {formatLocalInput(asOfLocal)}. Current-only files are hidden from the tree.
              </Text>
            </Paper>
          ) : null}
          <Paper withBorder radius="sm" p="lg" bg="white">
            <Stack gap={6}>
              {file.content.split("\n").map((line, index) => (
                <Text key={`${line}-${index}`} ff="monospace" size="sm">{line || " "}</Text>
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </ScrollArea>
  )
}

function MatchedRevisionSidebar({
  historicalFile,
  currentFile,
  asOfLocal,
  changedSinceTimestamp,
  hasCurrent,
  onOpenLatest,
  onShowDiff,
}: {
  historicalFile: TimeTravelFile
  currentFile: TimeTravelFile | null
  asOfLocal: string
  changedSinceTimestamp: boolean
  hasCurrent: boolean
  onOpenLatest: () => void
  onShowDiff: () => void
}) {
  const [nearbyOpen, setNearbyOpen] = useState(false)
  const revision = historicalFile.matchedRevision

  return (
    <Stack gap={0} h="100%" bg="white" style={{ borderLeft: "1px solid var(--mantine-color-gray-2)" }}>
      <Box px={12} py={10}>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Time travel</Text>
        <Text size="xs" c="dimmed" mt={2} truncate>{historicalFile.physicalPath}</Text>
      </Box>
      <Divider />
      <ScrollArea h="100%">
        <Stack gap="sm" p="sm">
          <Paper withBorder radius="sm" p="sm" bg="yellow.0">
            <Text size="xs" fw={700} c="yellow.9" tt="uppercase">Matched revision</Text>
            <Stack gap={6} mt="xs">
              <InfoRow label="Selected time" value={formatLocalInput(asOfLocal)} />
              <InfoRow label="Revision time" value={formatDisplayDate(revision?.createdAt)} />
              <InfoRow label="Revision" value={revision?.id ?? "n/a"} />
              <InfoRow label="Actor" value={revision?.actor ?? "unknown"} />
              <InfoRow label="Reason" value={revision?.reason ?? "none"} />
            </Stack>
          </Paper>
          <Paper withBorder radius="sm" p="sm">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">Current status</Text>
            <Text size="sm" mt={6}>
              {!hasCurrent ? "No current file." : changedSinceTimestamp ? "Changed since selected timestamp." : "Unchanged since selected timestamp."}
            </Text>
            {currentFile?.matchedRevision ? (
              <Text size="xs" c="dimmed" mt={4}>
                Latest write by {currentFile.matchedRevision.actor ?? "unknown"} at {formatDisplayDate(currentFile.matchedRevision.createdAt)}.
              </Text>
            ) : null}
          </Paper>
          <Group gap="xs">
            <Button size="xs" variant="light" color="gray" disabled={!hasCurrent} onClick={onOpenLatest}>Open latest</Button>
            <Button size="xs" variant="filled" color="blue" onClick={onShowDiff}>Show diff</Button>
          </Group>
          <Paper withBorder radius="sm" p="sm" bg="gray.0">
            <Group justify="space-between" gap="xs">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase">Nearby revisions</Text>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setNearbyOpen((value) => !value)} aria-label="Toggle nearby revisions">
                {nearbyOpen ? "-" : "+"}
              </ActionIcon>
            </Group>
            <Collapse in={nearbyOpen}>
              <Stack gap={6} mt="xs">
                <RevisionChip label="Before" value="rev_prev999" />
                <RevisionChip label="Matched" value={revision?.id ?? "n/a"} active />
                <RevisionChip label="After" value="rev_next456" />
              </Stack>
            </Collapse>
            {!nearbyOpen ? (
              <Text size="xs" c="dimmed" mt={6}>
                Hidden by default so the timestamp remains the primary mental model.
              </Text>
            ) : null}
          </Paper>
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

function CurrentFileSidebar({ file }: { file: TimeTravelFile | null }) {
  return (
    <Stack gap={0} h="100%" bg="white" style={{ borderLeft: "1px solid var(--mantine-color-gray-2)" }}>
      <Box px={12} py={10}>
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">File Observability</Text>
        <Text size="xs" c="dimmed" mt={2} truncate>{file?.physicalPath ?? "No file selected"}</Text>
      </Box>
      <Divider />
      <Tabs defaultValue="activity" keepMounted={false} style={{ minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
        <Tabs.List grow>
          <Tabs.Tab value="activity">Activity</Tabs.Tab>
          <Tabs.Tab value="users">Users</Tabs.Tab>
          <Tabs.Tab value="revisions">Revisions</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="activity" style={{ minHeight: 0, flex: 1 }}>
          <Stack gap="sm" p="sm">
            <MiniMetric label="Reads" value="42" />
            <MiniMetric label="Writes" value="6" />
            <MiniMetric label="Last access" value="2h ago" />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="users" style={{ minHeight: 0, flex: 1 }}>
          <Stack gap="sm" p="sm">
            <MiniMetric label="Top user" value="user_123" />
            <MiniMetric label="Unique users" value="1" />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="revisions" style={{ minHeight: 0, flex: 1 }}>
          <Stack gap="sm" p="sm">
            <MiniMetric label="Latest revision" value={file?.matchedRevision?.id ?? "n/a"} />
            <MiniMetric label="Actor" value={file?.matchedRevision?.actor ?? "unknown"} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

function TimeTravelDiffPanel({ historicalFile, currentFile }: { historicalFile: TimeTravelFile; currentFile: TimeTravelFile | null }) {
  const historicalLines = historicalFile.content.split("\n")
  const currentLines = currentFile?.content.split("\n") ?? ["No current file"]
  const changedLines = new Set<number>()
  const max = Math.max(historicalLines.length, currentLines.length)
  for (let index = 0; index < max; index += 1) {
    if ((historicalLines[index] ?? "") !== (currentLines[index] ?? "")) changedLines.add(index)
  }

  return (
    <ScrollArea h="100%">
      <Box px={{ base: "xl", xl: 40 }} py={32}>
        <Stack gap="md">
          <Group justify="space-between">
            <Box>
              <Title order={2} size="h4">Diff from current</Title>
              <Text size="sm" c="dimmed">Compare the matched historical revision with the current file.</Text>
            </Box>
            <Badge color={changedLines.size ? "yellow" : "green"} variant="light">
              {changedLines.size ? "changed" : "unchanged"}
            </Badge>
          </Group>
          <Box style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <DiffColumn title="As of timestamp" path={historicalFile.physicalPath} lines={historicalLines} changedLines={changedLines} tone="old" />
            <DiffColumn title="Current" path={historicalFile.physicalPath} lines={currentLines} changedLines={changedLines} tone="current" />
          </Box>
        </Stack>
      </Box>
    </ScrollArea>
  )
}

function DiffColumn({
  title,
  path,
  lines,
  changedLines,
  tone,
}: {
  title: string
  path: string
  lines: string[]
  changedLines: Set<number>
  tone: "old" | "current"
}) {
  return (
    <Paper withBorder radius="sm" bg="white" style={{ overflow: "hidden" }}>
      <Box px="md" py="sm" bg="gray.0" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Text size="sm" fw={700}>{title}</Text>
        <Code>{path}</Code>
      </Box>
      <Stack gap={0} p="md">
        {lines.map((line, index) => {
          const changed = changedLines.has(index)
          return (
            <Text
              key={`${line}-${index}`}
              ff="monospace"
              size="sm"
              px="xs"
              py={4}
              bg={changed ? (tone === "current" ? "green.0" : "red.0") : undefined}
              c={changed ? (tone === "current" ? "green.9" : "red.9") : undefined}
            >
              {line || " "}
            </Text>
          )
        })}
      </Stack>
    </Paper>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder radius="sm" p="sm">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm" fw={650}>{value}</Text>
    </Paper>
  )
}

function RevisionChip({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return (
    <Group justify="space-between" gap="xs" p={6} style={{ borderRadius: 4, background: active ? "var(--mantine-color-yellow-1)" : "white" }}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Code>{value}</Code>
    </Group>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xs" fw={600} style={{ whiteSpace: "nowrap" }}>{value}</Text>
    </Group>
  )
}

function toAdminFile(file: TimeTravelFile): AdminFile {
  return {
    id: file.matchedRevision?.id ?? file.physicalPath,
    physicalPath: file.physicalPath,
    size: file.content.length,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  }
}

function formatLocalInput(value: string) {
  if (!value) return "No timestamp"
  return new Date(normalizeLocalDateTime(value)).toLocaleString()
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "n/a"
  return new Date(value).toLocaleString()
}

function toUtcIso(value: string) {
  return new Date(normalizeLocalDateTime(value)).toISOString()
}

function normalizeLocalDateTime(value: string) {
  return value.includes("T") ? value : value.replace(" ", "T")
}
