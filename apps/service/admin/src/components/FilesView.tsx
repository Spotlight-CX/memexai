import {
  Badge,
  Box,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tree,
  UnstyledButton,
  filterTreeData,
  getTreeExpandedState,
  useTree,
} from "@mantine/core"
import { useEffect, useMemo, useState } from "react"
import { useAdminData } from "../hooks"
import { FileTreeItem } from "./FileTree"
import type { AdminFile, AdminRevision } from "../types"
import { deriveTree, formatDate, isCodeLike, relativeTime } from "../utils"
import { ErrorText } from "./TableViews"

export function FilesView({
  secret,
  selectedPath,
  onSelectPath,
}: {
  secret: string
  selectedPath: string | null
  onSelectPath: (path: string) => void
}) {
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
  const filePaths = useMemo(() => new Set(files.map((f) => f.physicalPath)), [files])
  const filteredTree = useMemo(() => filterTreeData(fileTree, search.trim()), [fileTree, search])
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
                  filePaths={filePaths}
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
                        <Text
                          size="xs"
                          c="gray.6"
                          style={{
                            flex: "1 1 auto",
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 480,
                          }}
                        >
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
                <Text size="sm" c="dimmed" mt={6}>
                  Choose a memory from the tree to inspect its content and revision history.
                </Text>
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
