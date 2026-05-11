import { Spotlight, spotlight } from "@mantine/spotlight"
import "@mantine/spotlight/styles.css"
import type { SpotlightActions } from "@mantine/spotlight"
import { useMemo } from "react"
import type { AdminFile, Overlay } from "../types"
import { relativeTime } from "../utils"
import { FileDocIcon, SearchIcon } from "../icons"
import { ActionIcon } from "@mantine/core"

export { spotlight }

export function AdminSpotlight({
  files,
  onSelectFile,
  onOpenOverlay,
}: {
  files: AdminFile[]
  onSelectFile: (path: string) => void
  onOpenOverlay: (overlay: Overlay) => void
}) {
  const actions: SpotlightActions[] = useMemo(
    () => [
      {
        group: "Navigate",
        actions: [
          {
            id: "page:users",
            label: "Users",
            description: "View all users and their file counts",
            onClick: () => onOpenOverlay("users"),
          },
          {
            id: "page:revisions",
            label: "Revisions",
            description: "Browse global revision history across all files",
            onClick: () => onOpenOverlay("revisions"),
          },
          {
            id: "page:logs",
            label: "Access Logs",
            description: "View all read and write access events",
            onClick: () => onOpenOverlay("logs"),
          },
        ],
      },
      {
        group: "Files",
        actions: files.map((file) => ({
          id: `file:${file.physicalPath}`,
          label: file.physicalPath.split("/").pop() ?? file.physicalPath,
          description: `${file.physicalPath} · ${file.size} bytes · ${relativeTime(file.updatedAt)}`,
          keywords: file.physicalPath,
          leftSection: (
            <span style={{ display: "flex", alignItems: "center" }}>
              <FileDocIcon />
            </span>
          ),
          onClick: () => onSelectFile(file.physicalPath),
        })),
      },
    ],
    [files, onSelectFile, onOpenOverlay],
  )

  return (
    <Spotlight
      actions={actions}
      shortcut="mod+K"
      nothingFound="No files or pages match."
      highlightQuery
      limit={20}
      scrollable
      maxHeight={420}
      searchProps={{ placeholder: "Search files or navigate…" }}
    />
  )
}

export function SpotlightTrigger() {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="md"
      aria-label="Search (⌘K)"
      title="Search (⌘K)"
      onClick={() => spotlight.open()}
    >
      <SearchIcon />
    </ActionIcon>
  )
}
