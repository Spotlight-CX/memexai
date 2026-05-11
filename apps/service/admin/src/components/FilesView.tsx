import {
  ActionIcon,
  Anchor,
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
  Textarea,
  TextInput,
  Tree,
  UnstyledButton,
  filterTreeData,
  getTreeExpandedState,
  useTree,
} from "@mantine/core"
import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useAdminData } from "../hooks"
import { FileTreeItem } from "./FileTree"
import { PencilIcon } from "../icons"
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
  const [isEditing, setIsEditing] = useState(false)
  const [draftContent, setDraftContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const { data, error } = useAdminData<{ files: AdminFile[] }>("/v1/admin/files", secret)
  const { data: selected } = useAdminData<{ file: AdminFile }>(
    selectedPath ? `/v1/admin/files/${encodeURIComponent(selectedPath)}` : null,
    secret,
    refreshKey,
  )
  const { data: revisions, error: revisionsError } = useAdminData<{ revisions: AdminRevision[] }>(
    selectedPath ? `/v1/admin/revisions?physicalPath=${encodeURIComponent(selectedPath)}` : null,
    secret,
    refreshKey,
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
    setIsEditing(false)
    setSaveError(null)
    onSelectPath(path)
    tree.select(path)
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
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
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
                    : <Badge variant="dot" color="green" size="xs" style={{ flexShrink: 0 }}>latest</Badge>
                  }
                  {!selectedRevision && !isEditing && (
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
