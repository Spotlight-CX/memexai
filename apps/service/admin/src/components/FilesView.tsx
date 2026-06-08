import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tree,
  UnstyledButton,
  filterTreeData,
  getTreeExpandedState,
  useTree,
} from "@mantine/core"
import { DateTimePicker } from "@mantine/dates"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useSearchParams } from "react-router-dom"
import { useAdminData, adminQueryKey } from "../hooks"
import { FileTreeItem } from "./FileTree"
import { PencilIcon, PlusIcon } from "../icons"
import type { AdminFile, AdminRevision, AdminSearchStatus, FileObservability } from "../types"
import { deriveTree, formatDate, isCodeLike, relativeTime } from "../utils"
import { ErrorText } from "./TableViews"

export function FilesView({ secret }: { secret: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedPath = searchParams.get("path")
  const asOf = searchParams.get("asOf")
  const isTimeTravel = Boolean(asOf)
  const asOfLocal = asOf ? utcIsoToLocalPickerValue(asOf) : null
  const [search, setSearch] = useState("")
  const [selectedRevision, setSelectedRevision] = useState<AdminRevision | null>(null)
  const [sidebarTab, setSidebarTab] = useState<string | null>("activity")
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [newFilePath, setNewFilePath] = useState<string | null>(null)
  const [restoreRevision, setRestoreRevision] = useState<AdminRevision | null>(null)
  const [restoreReason, setRestoreReason] = useState("")
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [centerPanel, setCenterPanel] = useState<"document" | "diff">("document")
  const queryClient = useQueryClient()

  const filesUrl = `/v1/admin/files${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ""}`
  const selectedUrl = selectedPath
    ? `/v1/admin/files/${encodeURIComponent(selectedPath)}${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ""}`
    : null
  const currentSelectedUrl = selectedPath && isTimeTravel ? `/v1/admin/files/${encodeURIComponent(selectedPath)}` : null

  const { data, error } = useAdminData<{ files: AdminFile[] }>(filesUrl, secret)
  const { data: searchStatus } = useAdminData<AdminSearchStatus>("/v1/admin/search/status", secret)
  const { data: selected } = useAdminData<{ file: AdminFile }>(
    selectedUrl,
    secret,
  )
  const { data: currentSelected } = useAdminData<{ file: AdminFile }>(
    currentSelectedUrl,
    secret,
  )
  const { data: revisions, error: revisionsError } = useAdminData<{ revisions: AdminRevision[] }>(
    selectedPath && !isTimeTravel ? `/v1/admin/revisions?physicalPath=${encodeURIComponent(selectedPath)}` : null,
    secret,
  )
  const { data: fileObservability, error: fileObservabilityError } = useAdminData<FileObservability>(
    selectedPath && !isTimeTravel ? `/v1/admin/files/${encodeURIComponent(selectedPath)}/observability?bucket=hour` : null,
    secret,
  )

  const tree = useTree()
  const files = data?.files ?? []
  const fileTree = useMemo(() => deriveTree(files), [files])
  const filePaths = useMemo(() => new Set(files.map((f) => f.physicalPath)), [files])
  const filteredTree = useMemo(() => filterTreeData(fileTree, search.trim()), [fileTree, search])
  const visibleContent = selectedRevision?.content ?? selected?.file?.content ?? ""
  const selectedFile = selected?.file
  const currentFile = currentSelected?.file ?? (!isTimeTravel ? selectedFile : null)
  const hasCurrentFile = Boolean(currentFile)
  const changedSinceCurrent = Boolean(isTimeTravel && selectedFile && currentFile && selectedFile.content !== currentFile.content)

  useEffect(() => {
    if (isTimeTravel) {
      setSelectedRevision(null)
      setSidebarTab(null)
      setIsEditing(false)
      return
    }
    setCenterPanel("document")
    if (!sidebarTab) setSidebarTab("activity")
  }, [isTimeTravel, sidebarTab])

  useEffect(() => {
    if (selectedPath) tree.select(selectedPath)
    else tree.clearSelected()
  }, [selectedPath])

  useEffect(() => {
    if (search.trim()) {
      tree.setExpandedState(getTreeExpandedState(filteredTree, "*"))
      return
    }

    if (!selectedPath) return

    const ancestorPaths = getAncestorPaths(selectedPath)
    if (ancestorPaths.every((path) => tree.expandedState[path])) return

    tree.setExpandedState({
      ...tree.expandedState,
      ...Object.fromEntries(ancestorPaths.map((path) => [path, true])),
    })
  }, [filteredTree, search, selectedPath])

  useEffect(() => {
    if (!selectedPath || filePaths.has(selectedPath) || !files[0]) return
    setFileSearchParams(setSearchParams, { path: files[0].physicalPath, asOf })
  }, [asOf, filePaths, files, selectedPath, setSearchParams])

  const handleSelectPath = (path: string) => {
    setSelectedRevision(null)
    setIsEditing(false)
    setSaveError(null)
    setCenterPanel("document")
    setFileSearchParams(setSearchParams, { path, asOf })
    tree.select(path)
  }

  const handleSetAsOf = (value: string | null) => {
    if (!value) return
    setSelectedRevision(null)
    setIsEditing(false)
    setSaveError(null)
    setCenterPanel("document")
    setFileSearchParams(setSearchParams, {
      path: selectedPath ?? files[0]?.physicalPath ?? null,
      asOf: localPickerValueToUtcIso(value),
    })
  }

  const handleClearAsOf = () => {
    setSelectedRevision(null)
    setIsEditing(false)
    setSaveError(null)
    setCenterPanel("document")
    setFileSearchParams(setSearchParams, { path: selectedPath, asOf: null })
  }

  const handleOpenLatest = () => {
    if (!selectedPath) return
    setCenterPanel("document")
    setFileSearchParams(setSearchParams, { path: selectedPath, asOf: null })
  }

  const handleCopyPath = () => {
    if (!selectedPath) return
    navigator.clipboard.writeText(selectedPath)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleEdit = () => {
    setDraftContent(visibleContent)
    setIsEditing(true)
    setSaveError(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    if (!selectedPath) return
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(`/v1/admin/files/${encodeURIComponent(selectedPath)}`, {
        method: "PUT",
        headers: { "x-memex-admin-secret": secret, "content-type": "application/json" },
        body: JSON.stringify({ content: draftContent, reason: "admin edit" }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as any)?.error?.message ?? "Save failed")
      }
      setIsEditing(false)
      await queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/files/${encodeURIComponent(selectedPath)}`) })
      await queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/revisions?physicalPath=${encodeURIComponent(selectedPath)}`) })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreConfirm = async () => {
    if (!selectedPath || !restoreRevision) return
    setRestoring(true)
    setRestoreError(null)
    try {
      const response = await fetch(`/v1/admin/files/${encodeURIComponent(selectedPath)}`, {
        method: "PUT",
        headers: { "x-memex-admin-secret": secret, "content-type": "application/json" },
        body: JSON.stringify({
          content: restoreRevision.content,
          reason: restoreReason.trim() || `restore to revision from ${restoreRevision.createdAt}`,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as any)?.error?.message ?? "Restore failed")
      }
      setRestoreRevision(null)
      setRestoreReason("")
      await queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/files/${encodeURIComponent(selectedPath)}`) })
      await queryClient.invalidateQueries({ queryKey: adminQueryKey(`/v1/admin/revisions?physicalPath=${encodeURIComponent(selectedPath)}`) })
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed")
    } finally {
      setRestoring(false)
    }
  }

  if (error) return <ErrorText error={error} />

  const fileName = selectedPath ? selectedPath.split("/").pop() ?? selectedPath : null
  const latestRevision = selectedFile?.latestRevision ?? null
  const revisionCount = selectedFile?.revisionCount ?? 0

  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <FilesTimeTravelToolbar
        asOfLocal={asOfLocal}
        isTimeTravel={isTimeTravel}
        onSetAsOf={handleSetAsOf}
        onClearAsOf={handleClearAsOf}
      />
      {searchStatus?.mode === "bm25" ? (
        <Box px="md" py={8} bg="yellow.0" style={{ borderTop: "1px solid var(--mantine-color-yellow-2)" }}>
          <Text size="xs" c="yellow.9">
            Semantic search is not configured. BM25 keyword search is still active.
          </Text>
        </Box>
      ) : null}
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "264px minmax(520px, 1fr) 296px",
          minHeight: 0,
          flex: 1,
          overflowX: "auto",
          background: "transparent",
          borderTop: "1px solid var(--mantine-color-gray-2)",
        }}
      >
      {/* Left: file tree */}
      <Stack gap={0} h="100%" style={{ minHeight: 0, borderRight: "1px solid var(--mantine-color-gray-2)", background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(4px)" }}>
        <Box px={12} pt={12} pb={8}>
          <Group justify="space-between" align="center" mb={6}>
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
              Explorer
            </Text>
            {isTimeTravel ? (
              <Badge size="xs" variant="light" color="yellow">Historical tree</Badge>
            ) : (
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setNewFilePath("")} title="New file">
                <PlusIcon />
              </ActionIcon>
            )}
          </Group>
          <TextInput
            aria-label="Search files"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            size="xs"
            styles={{ input: { fontSize: 12 } }}
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
                  onSelectPath={handleSelectPath}
                  onNewFile={isTimeTravel ? undefined : setNewFilePath}
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
      {isTimeTravel && centerPanel === "diff" && selectedFile ? (
        <DiffFromCurrentPanel
          historicalFile={selectedFile}
          currentFile={currentFile ?? null}
          onBack={() => setCenterPanel("document")}
        />
      ) : (
      <ScrollArea h="100%">
        <Box px={{ base: "xl", xl: 56 }} py={40}>
          <Box maw={860} mx="auto">
            {selectedPath ? (
              <Stack gap="xl">
                {/* File header — compact breadcrumb */}
                <Group gap={8} align="center" wrap="nowrap">
                  <Text
                    size="xs"
                    c="dimmed"
                    ff="monospace"
                    style={{ cursor: "pointer", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    onClick={handleCopyPath}
                    title={`${selectedPath} — click to copy`}
                  >
                    {selectedPath?.split("/").map((seg, i, arr) => (
                      <span key={i}>
                        {i > 0 && <span style={{ margin: "0 3px", opacity: 0.4 }}>/</span>}
                        <span style={i === arr.length - 1 ? { color: "var(--mantine-color-gray-7)", fontWeight: 500 } : {}}>
                          {seg}
                        </span>
                      </span>
                    ))}
                    {copied && <span style={{ marginLeft: 6, color: "var(--mantine-color-teal-6)" }}>copied</span>}
                  </Text>
                  {latestRevision && (
                    <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                      {latestRevision.actor ? `${latestRevision.actor} · ` : ""}{relativeTime(latestRevision.createdAt)}
                    </Text>
                  )}
                  {selectedRevision
                    ? <Badge variant="light" color="yellow" size="xs" style={{ flexShrink: 0 }}>historical</Badge>
                    : isTimeTravel
                      ? <Badge variant="light" color="yellow" size="xs" style={{ flexShrink: 0 }}>as of</Badge>
                    : <Badge variant="dot" color="green" size="xs" style={{ flexShrink: 0 }}>latest</Badge>
                  }
                  {!selectedRevision && !isEditing && !isTimeTravel && (
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleEdit} title="Edit file">
                      <PencilIcon />
                    </ActionIcon>
                  )}
                  {isEditing && (
                    <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
                      <Button size="xs" variant="filled" color="blue" loading={saving} onClick={handleSave}>Save</Button>
                      <Button size="xs" variant="subtle" color="gray" disabled={saving} onClick={handleCancelEdit}>Cancel</Button>
                    </Group>
                  )}
                </Group>
                {saveError && <Text size="xs" c="red.6">{saveError}</Text>}

                {isTimeTravel && asOf ? (
                  <Paper withBorder p="sm" radius="sm" bg="yellow.0">
                    <Text size="sm" c="yellow.9">
                      Viewing the latest matched revision before {formatDate(asOf)}. Editing is disabled in time-travel mode.
                    </Text>
                  </Paper>
                ) : null}

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

                {isEditing && isRiskyPath(selectedPath) && (
                  <Paper p="xs" radius="sm" bg="yellow.0" withBorder style={{ borderColor: "var(--mantine-color-yellow-3)" }}>
                    <Text size="xs" c="yellow.9">
                      This file affects agent behavior across all sessions. Changes take effect immediately.
                    </Text>
                  </Paper>
                )}

                <DocumentBody
                  content={isEditing ? draftContent : visibleContent}
                  path={selectedPath}
                  isEditing={isEditing}
                  onChange={setDraftContent}
                />
              </Stack>
            ) : (
              <Box pt={120} ta="center">
                <Text size="xl" fw={500} c="gray.7">Select a file</Text>
                <Text size="sm" c="dimmed" mt={6}>
                  Choose a memory from the tree to inspect its content and revision history.
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      </ScrollArea>
      )}

      {/* New file modal */}
      {newFilePath !== null && !isTimeTravel && (
        <NewFileModal
          prefixPath={newFilePath}
          secret={secret}
          onClose={() => setNewFilePath(null)}
          onCreated={(path) => {
            setNewFilePath(null)
            queryClient.invalidateQueries({ queryKey: adminQueryKey("/v1/admin/files") })
            handleSelectPath(path)
          }}
        />
      )}

      {/* Right: observability sidebar */}
      {isTimeTravel ? (
        <MatchedRevisionSidebar
          selectedPath={selectedPath}
          selectedFile={selectedFile ?? null}
          currentFile={currentFile ?? null}
          asOf={asOf}
          hasCurrentFile={hasCurrentFile}
          changedSinceCurrent={changedSinceCurrent}
          onOpenLatest={handleOpenLatest}
          onShowDiff={() => setCenterPanel("diff")}
        />
      ) : (
        <Stack gap={0} h="100%" style={{ minHeight: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(4px)" }}>
          <Box px={12} py={10}>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.04em" }}>File Observability</Text>
            <Text size="xs" c="dimmed" mt={2} truncate>{selectedPath ?? "Select a file to inspect."}</Text>
          </Box>
          <Divider />
          <Tabs value={sidebarTab} onChange={setSidebarTab} keepMounted={false} style={{ minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
            <Tabs.List grow>
              <Tabs.Tab value="activity">Activity</Tabs.Tab>
              <Tabs.Tab value="users">Users</Tabs.Tab>
              <Tabs.Tab value="revisions">Revisions</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="activity" style={{ minHeight: 0, flex: 1 }}>
              <ScrollArea h="100%" offsetScrollbars>
                <ActivitySidebar
                  selectedPath={selectedPath}
                  selectedFile={selectedFile ?? null}
                  searchStatus={searchStatus ?? null}
                  data={fileObservability}
                  error={fileObservabilityError}
                  onOpenFile={handleSelectPath}
                />
              </ScrollArea>
            </Tabs.Panel>
            <Tabs.Panel value="users" style={{ minHeight: 0, flex: 1 }}>
              <ScrollArea h="100%" offsetScrollbars>
                <UsersSidebar selectedPath={selectedPath} data={fileObservability} error={fileObservabilityError} />
              </ScrollArea>
            </Tabs.Panel>
            <Tabs.Panel value="revisions" style={{ minHeight: 0, flex: 1 }}>
              <ScrollArea h="100%" offsetScrollbars>
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
                      onRestore={() => { setRestoreRevision(revision); setRestoreReason(""); setRestoreError(null) }}
                    />
                  ))}
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
      </Box>
      <Modal
        opened={restoreRevision !== null}
        onClose={() => { setRestoreRevision(null); setRestoreReason(""); setRestoreError(null) }}
        title="Restore revision?"
        size="sm"
        centered
      >
        {restoreRevision && (
          <Stack gap="sm">
            <Text size="sm">
              Restore <Code>{selectedPath}</Code> to the version from{" "}
              <strong>{formatDate(restoreRevision.createdAt)}</strong>
              {restoreRevision.actor ? ` (${restoreRevision.actor})` : ""}?
            </Text>
            <Text size="xs" c="dimmed">Current content will be saved as a new revision before overwriting.</Text>
            <TextInput
              label="Reason (optional)"
              placeholder={`restore to revision from ${restoreRevision.createdAt}`}
              value={restoreReason}
              onChange={(e) => setRestoreReason(e.currentTarget.value)}
            />
            {restoreError ? <Text size="xs" c="red">{restoreError}</Text> : null}
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" color="gray" onClick={() => { setRestoreRevision(null); setRestoreReason(""); setRestoreError(null) }}>Cancel</Button>
              <Button color="blue" loading={restoring} onClick={handleRestoreConfirm}>Restore this version</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Box>
  )
}

function FilesTimeTravelToolbar({
  asOfLocal,
  isTimeTravel,
  onSetAsOf,
  onClearAsOf,
}: {
  asOfLocal: string | null
  isTimeTravel: boolean
  onSetAsOf: (value: string | null) => void
  onClearAsOf: () => void
}) {
  return (
    <Paper radius={0} px="md" py="xs" bg="rgba(255, 255, 255, 0.75)" style={{ backdropFilter: "blur(6px)" }}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={650}>View</Text>
          <Badge variant={isTimeTravel ? "light" : "dot"} color={isTimeTravel ? "yellow" : "green"}>
            {isTimeTravel ? "As of timestamp" : "Current"}
          </Badge>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" variant={isTimeTravel ? "light" : "filled"} color="gray" onClick={onClearAsOf}>
            Current
          </Button>
          <DateTimePicker
            aria-label="As of timestamp"
            size="xs"
            value={asOfLocal}
            placeholder="Select timestamp"
            valueFormat="YYYY-MM-DD HH:mm:ss"
            w={250}
            onChange={onSetAsOf}
          />
          <Button size="xs" variant="light" color="gray" disabled={!isTimeTravel} onClick={onClearAsOf}>
            Clear
          </Button>
        </Group>
      </Group>
    </Paper>
  )
}

function MatchedRevisionSidebar({
  selectedPath,
  selectedFile,
  currentFile,
  asOf,
  hasCurrentFile,
  changedSinceCurrent,
  onOpenLatest,
  onShowDiff,
}: {
  selectedPath: string | null
  selectedFile: AdminFile | null
  currentFile: AdminFile | null
  asOf: string | null
  hasCurrentFile: boolean
  changedSinceCurrent: boolean
  onOpenLatest: () => void
  onShowDiff: () => void
}) {
  const revision = selectedFile?.matchedRevision ?? null

  return (
    <Stack gap={0} h="100%" style={{ minHeight: 0, borderLeft: "1px solid var(--mantine-color-gray-2)", background: "rgba(255, 255, 255, 0.4)", backdropFilter: "blur(4px)" }}>
      <Box px={12} py={10}>
        <Text size="xs" fw={600} tt="uppercase" c="dimmed" style={{ letterSpacing: "0.04em" }}>Time Travel</Text>
        <Text size="xs" c="dimmed" mt={2} truncate>{selectedPath ?? "Select a file to inspect."}</Text>
      </Box>
      <Divider />
      <ScrollArea h="100%" offsetScrollbars>
        <Stack gap="sm" p="sm">
          {!selectedPath ? <Text size="xs" c="dimmed">No file selected.</Text> : null}
          <Paper withBorder radius="sm" p="xs" bg="yellow.0">
            <Text size="xs" fw={650} c="yellow.9" tt="uppercase" style={{ letterSpacing: "0.04em" }}>Matched revision</Text>
            <Stack gap={4} mt={8}>
              <InfoRow label="Selected time" value={asOf ? formatDate(asOf) : "n/a"} />
              <InfoRow label="Revision time" value={revision?.createdAt ? formatDate(revision.createdAt) : "n/a"} />
              <InfoRow label="Revision" value={revision?.id ?? "n/a"} />
              <InfoRow label="Actor" value={revision?.actor ?? "unknown"} />
              <InfoRow label="Reason" value={revision?.reason ?? "none"} />
              <InfoRow label="Tool call" value={revision?.toolCallId ?? "n/a"} />
            </Stack>
          </Paper>
          <Paper withBorder radius="sm" p="xs">
            <Text size="xs" fw={650} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>Current status</Text>
            <Text size="sm" mt={6}>
              {!hasCurrentFile ? "No current file." : changedSinceCurrent ? "Changed since selected timestamp." : "Unchanged since selected timestamp."}
            </Text>
            {currentFile?.latestRevision ? (
              <Text size="xs" c="dimmed" mt={4}>
                Latest write {currentFile.latestRevision.actor ? `by ${currentFile.latestRevision.actor} ` : ""}at {formatDate(currentFile.latestRevision.createdAt)}.
              </Text>
            ) : null}
          </Paper>
          <Group gap="xs">
            <Button size="xs" variant="light" color="gray" disabled={!hasCurrentFile} onClick={onOpenLatest}>Open latest</Button>
            <Button size="xs" variant="filled" color="blue" onClick={onShowDiff}>Show diff</Button>
          </Group>
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

function DiffFromCurrentPanel({
  historicalFile,
  currentFile,
  onBack,
}: {
  historicalFile: AdminFile
  currentFile: AdminFile | null
  onBack: () => void
}) {
  const historicalContent = historicalFile.content ?? ""
  const currentContent = currentFile?.content ?? null
  const historicalLines = historicalContent.split("\n")
  const currentLines = currentContent?.split("\n") ?? ["No current file"]
  const changedLines = getChangedLineIndexes(historicalLines, currentLines)
  const unchanged = Boolean(currentContent !== null && changedLines.size === 0)

  return (
    <ScrollArea h="100%">
      <Box px={{ base: "xl", xl: 40 }} py={36}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" gap="md">
            <Box>
              <Text size="xl" fw={650}>Diff from current</Text>
              <Text size="sm" c="dimmed">Compare the matched historical revision with the current file.</Text>
            </Box>
            <Group gap="xs">
              {!currentFile ? (
                <Badge color="gray" variant="light">No current file</Badge>
              ) : unchanged ? (
                <Badge color="green" variant="light">Unchanged</Badge>
              ) : (
                <Badge color="yellow" variant="light">Changed</Badge>
              )}
              <Button size="xs" variant="light" color="gray" onClick={onBack}>Back to file</Button>
            </Group>
          </Group>
          {!currentFile ? (
            <Paper withBorder radius="sm" p="sm" bg="gray.0">
              <Text size="sm" c="dimmed">No current file exists for this historical path.</Text>
            </Paper>
          ) : unchanged ? (
            <Paper withBorder radius="sm" p="sm" bg="green.0">
              <Text size="sm" c="green.9">Unchanged since selected timestamp.</Text>
            </Paper>
          ) : null}
          <Box style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
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
              key={`${index}-${line}`}
              ff="monospace"
              size="sm"
              px="xs"
              py={4}
              bg={changed ? (tone === "current" ? "green.0" : "red.0") : undefined}
              c={changed ? (tone === "current" ? "green.9" : "red.9") : undefined}
              style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {line || " "}
            </Text>
          )
        })}
      </Stack>
    </Paper>
  )
}

function getChangedLineIndexes(left: string[], right: string[]) {
  const changed = new Set<number>()
  const max = Math.max(left.length, right.length)
  for (let index = 0; index < max; index += 1) {
    if ((left[index] ?? "") !== (right[index] ?? "")) changed.add(index)
  }
  return changed
}

function getAncestorPaths(path: string) {
  const parts = path.split("/")
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"))
}

function setFileSearchParams(
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  input: { path: string | null; asOf: string | null },
) {
  const params: Record<string, string> = {}
  if (input.path) params.path = input.path
  if (input.asOf) params.asOf = input.asOf
  setSearchParams(params)
}

function utcIsoToLocalPickerValue(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const pad = (part: number) => String(part).padStart(2, "0")
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function localPickerValueToUtcIso(value: string) {
  return new Date(value.includes("T") ? value : value.replace(" ", "T")).toISOString()
}

function isRiskyPath(path: string | null) {
  if (!path) return false
  return path.startsWith("shared/") || path.split("/").pop() === "index.md"
}

function ActivitySidebar({
  selectedPath,
  selectedFile,
  searchStatus,
  data,
  error,
  onOpenFile,
}: {
  selectedPath: string | null
  selectedFile: AdminFile | null
  searchStatus: AdminSearchStatus | null
  data: FileObservability | null
  error: string | null
  onOpenFile: (path: string) => void
}) {
  if (!selectedPath) return <Text size="xs" c="dimmed" p="sm">No file selected.</Text>
  if (error) return <Box p="sm"><ErrorText error={error} /></Box>
  const summary = data?.summary
  return (
    <Stack gap="sm" p="sm">
      <MiniBars buckets={data?.activity ?? []} />
      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <MiniMetric label="Reads" value={summary?.reads ?? 0} />
        <MiniMetric label="Writes" value={summary?.writes ?? 0} />
        <MiniMetric label="Searches" value={(summary?.searches ?? 0) + (summary?.smartReads ?? 0)} />
        <MiniMetric label="p95" value={formatMs(summary?.p95Ms)} />
      </Box>
      <Paper withBorder radius="sm" p="xs" bg="gray.0">
        <Stack gap={4}>
          <InfoRow label="Last access" value={summary?.lastAccessedAt ? relativeTime(summary.lastAccessedAt) : "n/a"} />
          <InfoRow label="Last write" value={summary?.lastWrittenAt ? relativeTime(summary.lastWrittenAt) : "n/a"} />
          <InfoRow label="Unique users" value={String(summary?.uniqueUsers ?? 0)} />
          <InfoRow label="Revisions" value={String(summary?.revisions ?? 0)} />
        </Stack>
      </Paper>
      {searchStatus?.mode === "hybrid" ? (
        <Paper withBorder radius="sm" p="xs">
          <Text size="xs" fw={650} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>Search index</Text>
          <Stack gap={4} mt={8}>
            <InfoRow label="Lexical" value="current" />
            <InfoRow label="Embedding" value={selectedFile?.embeddingStatus ?? "missing"} />
            <InfoRow label="Model" value={selectedFile?.embeddingModel ?? searchStatus.model ?? "n/a"} />
            <InfoRow label="Strategy" value={selectedFile?.embeddingStrategy ?? "n/a"} />
            <InfoRow label="Chunks" value={selectedFile?.embeddingChunkCount ? String(selectedFile.embeddingChunkCount) : "n/a"} />
            <InfoRow label="Embedded" value={selectedFile?.embeddingUpdatedAt ? relativeTime(selectedFile.embeddingUpdatedAt) : "n/a"} />
          </Stack>
        </Paper>
      ) : null}
      <Paper withBorder radius="sm" p="xs">
        <Text size="xs" fw={650} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>Frequently accessed nearby</Text>
        <Stack gap={6} mt={8}>
          {(data?.coHitFiles ?? []).length ? data?.coHitFiles.map((file) => (
            <UnstyledButton key={file.physicalPath} onClick={() => onOpenFile(file.physicalPath)} style={{ width: "100%" }}>
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Code style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{file.physicalPath}</Code>
                <Badge size="xs" variant="light">{file.count}</Badge>
              </Group>
            </UnstyledButton>
          )) : <Text size="xs" c="dimmed">No co-hit files yet.</Text>}
        </Stack>
      </Paper>
    </Stack>
  )
}

function UsersSidebar({ selectedPath, data, error }: {
  selectedPath: string | null
  data: FileObservability | null
  error: string | null
}) {
  if (!selectedPath) return <Text size="xs" c="dimmed" p="sm">No file selected.</Text>
  if (error) return <Box p="sm"><ErrorText error={error} /></Box>
  const isShared = selectedPath.startsWith("shared/")
  return (
    <Stack gap="sm" p="sm">
      <Text size="xs" c="dimmed">
        {isShared ? "Top users hitting this shared file." : "User-level access pattern for this memory file."}
      </Text>
      {(data?.topUsers ?? []).length ? data?.topUsers.map((user) => (
        <Paper key={user.userId ?? "unknown"} withBorder radius="sm" p="xs">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Code style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{user.userId ?? "unknown"}</Code>
            <Text size="xs" c="dimmed">{user.lastAccessedAt ? relativeTime(user.lastAccessedAt) : ""}</Text>
          </Group>
          <Group gap="xs" mt={6}>
            <Badge size="xs" variant="light" color="blue">reads {user.reads}</Badge>
            <Badge size="xs" variant="light" color="teal">writes {user.writes}</Badge>
            <Badge size="xs" variant="light" color="grape">search {user.searches}</Badge>
          </Group>
        </Paper>
      )) : <Text size="xs" c="dimmed">No users have hit this file yet.</Text>}
    </Stack>
  )
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Paper withBorder radius="sm" p="xs">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm" fw={650}>{value}</Text>
    </Paper>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="xs" fw={500} style={{ whiteSpace: "nowrap" }}>{value}</Text>
    </Group>
  )
}

function MiniBars({ buckets }: { buckets: FileObservability["activity"] }) {
  const width = 260
  const height = 88
  if (!buckets.length) {
    return (
      <Box h={height} display="flex" style={{ alignItems: "center", justifyContent: "center", border: "1px dashed var(--mantine-color-gray-3)", borderRadius: 6 }}>
        <Text size="xs" c="dimmed">No activity yet.</Text>
      </Box>
    )
  }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.reads + bucket.writes + bucket.searches + bucket.smartReads))
  const gap = 2
  const barWidth = Math.max(3, (width - gap * (buckets.length - 1)) / buckets.length)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="File activity chart">
      <line x1="0" x2={width} y1={height - 10} y2={height - 10} stroke="var(--mantine-color-gray-3)" />
      {buckets.map((bucket, index) => {
        const total = bucket.reads + bucket.writes + bucket.searches + bucket.smartReads
        const barHeight = (total / max) * (height - 18)
        return (
          <rect
            key={bucket.bucketStart}
            x={index * (barWidth + gap)}
            y={height - 10 - barHeight}
            width={barWidth}
            height={barHeight}
            rx={1}
            fill="var(--mantine-color-blue-5)"
          />
        )
      })}
    </svg>
  )
}

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a"
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value)}ms`
}

function NewFileModal({
  prefixPath,
  secret,
  onClose,
  onCreated,
}: {
  prefixPath: string
  secret: string
  onClose: () => void
  onCreated: (path: string) => void
}) {
  const [path, setPath] = useState(prefixPath)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = path.trim().replace(/^\/+/, "")
  const risky = isRiskyPath(trimmed)

  const handleCreate = async () => {
    if (!trimmed) return
    setCreating(true)
    setError(null)
    try {
      const response = await fetch(`/v1/admin/files/${encodeURIComponent(trimmed)}`, {
        method: "PUT",
        headers: { "x-memex-admin-secret": secret, "content-type": "application/json" },
        body: JSON.stringify({ content: "", reason: "admin: new file" }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as any)?.error?.message ?? "Create failed")
      }
      onCreated(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal opened onClose={onClose} title="New file" size="sm" centered>
      <Stack gap="sm">
        {risky && (
          <Paper p="xs" radius="sm" bg="yellow.0" withBorder style={{ borderColor: "var(--mantine-color-yellow-3)" }}>
            <Text size="xs" c="yellow.9">
              Files in <code>shared/</code> or named <code>index.md</code> affect agent behavior across all sessions.
            </Text>
          </Paper>
        )}
        <TextInput
          label="File path"
          description="Relative path, e.g. users/user_123/notes.md"
          value={path}
          onChange={(e) => setPath(e.currentTarget.value)}
          placeholder="path/to/file.md"
          data-autofocus
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
        />
        {error && <Text size="xs" c="red.6">{error}</Text>}
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button size="xs" loading={creating} disabled={!trimmed} onClick={handleCreate}>Create</Button>
        </Group>
      </Stack>
    </Modal>
  )
}

function RevisionRow({
  revision,
  selected,
  onClick,
  onRestore,
}: {
  revision: AdminRevision
  selected: boolean
  onClick: () => void
  onRestore: () => void
}) {
  return (
    <Box
      w="100%"
      p="sm"
      style={{
        borderRadius: 6,
        border: selected ? "1px solid var(--mantine-color-blue-3)" : "1px solid transparent",
        background: selected ? "var(--mantine-color-blue-0)" : "transparent",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <Stack gap={4}>
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" fw={700} tt="uppercase" c={selected ? "blue.8" : "gray.7"}>{revision.operation}</Text>
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="dimmed">{relativeTime(revision.createdAt)}</Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="blue"
              onClick={(e) => { e.stopPropagation(); onRestore() }}
            >
              Restore ↩
            </Button>
          </Group>
        </Group>
        {revision.reason ? (
          <Text size="xs" c="gray.7" lineClamp={2}>{revision.reason}</Text>
        ) : null}
        {revision.actor ? (
          <Badge size="xs" variant="light" color="gray" style={{ textTransform: "none" }}>{revision.actor}</Badge>
        ) : null}
      </Stack>
    </Box>
  )
}

function DocumentBody({
  content,
  path,
  isEditing,
  onChange,
}: {
  content: string
  path: string
  isEditing: boolean
  onChange: (value: string) => void
}) {
  if (isEditing) {
    return (
      <Textarea
        value={content}
        onChange={(e) => onChange(e.currentTarget.value)}
        autosize
        minRows={12}
        styles={{
          input: {
            fontFamily: "var(--mantine-font-family-monospace)",
            fontSize: 13,
            lineHeight: 1.7,
            background: "var(--mantine-color-gray-0)",
          },
        }}
      />
    )
  }

  const isMd = path.endsWith(".md")

  if (isMd) {
    return (
      <Box
        style={{
          fontSize: 15,
          lineHeight: 1.75,
          color: "var(--mantine-color-gray-9)",
        }}
      >
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <Text component="h1" fw={700} style={{ fontSize: 26, lineHeight: 1.3, marginTop: "1.5em", marginBottom: "0.5em" }}>{children}</Text>
            ),
            h2: ({ children }) => (
              <Text component="h2" fw={600} style={{ fontSize: 20, lineHeight: 1.35, marginTop: "1.4em", marginBottom: "0.4em" }}>{children}</Text>
            ),
            h3: ({ children }) => (
              <Text component="h3" fw={600} style={{ fontSize: 16, lineHeight: 1.4, marginTop: "1.2em", marginBottom: "0.3em" }}>{children}</Text>
            ),
            p: ({ children }) => (
              <Text component="p" style={{ margin: "0.6em 0", lineHeight: 1.75, fontSize: 15 }}>{children}</Text>
            ),
            ul: ({ children }) => <Box component="ul" style={{ paddingLeft: "1.5em", margin: "0.5em 0" }}>{children}</Box>,
            ol: ({ children }) => <Box component="ol" style={{ paddingLeft: "1.5em", margin: "0.5em 0" }}>{children}</Box>,
            li: ({ children }) => <Text component="li" style={{ lineHeight: 1.75, fontSize: 15, marginBottom: "0.2em" }}>{children}</Text>,
            a: ({ href, children }) => <Anchor href={href} size="sm" target="_blank" rel="noreferrer">{children}</Anchor>,
            blockquote: ({ children }) => (
              <Box
                component="blockquote"
                style={{
                  borderLeft: "3px solid var(--mantine-color-gray-3)",
                  paddingLeft: "1em",
                  margin: "1em 0",
                  color: "var(--mantine-color-gray-6)",
                }}
              >
                {children}
              </Box>
            ),
            hr: () => <Divider my="lg" />,
            pre: ({ children }) => <>{children}</>,
            code: ({ className, children }) => {
              const isBlock = /language-/.test(className ?? "") || String(children).includes("\n")
              if (isBlock) {
                return (
                  <Code
                    block
                    style={{ fontSize: 13, lineHeight: 1.6, margin: "0.75em 0", background: "var(--mantine-color-gray-0)" }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </Code>
                )
              }
              return <Code>{children}</Code>
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </Box>
    )
  }

  if (isCodeLike(content, path)) {
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
