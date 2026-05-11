import { Box, Text } from "@mantine/core"
import type { RenderTreeNodePayload } from "@mantine/core"
import { useState } from "react"
import { ChevronIcon, FileDocIcon, FolderIcon } from "../icons"

export function FileTreeItem({
  payload,
  isFile,
  filePaths,
  onSelectPath,
}: {
  payload: RenderTreeNodePayload
  isFile: boolean
  filePaths: Set<string>
  onSelectPath: (path: string) => void
}) {
  const { node, expanded, hasChildren, selected, tree, level } = payload
  const [hovered, setHovered] = useState(false)

  const handleClick = () => {
    if (isFile) {
      onSelectPath(node.value)
    } else {
      if (hasChildren) tree.toggleExpanded(node.value)
      const indexPath = `${node.value}/index.md`
      if (filePaths.has(indexPath)) onSelectPath(indexPath)
    }
  }

  return (
    <Box
      style={{
        height: 22,
        display: "flex",
        alignItems: "center",
        borderRadius: 3,
        paddingRight: 6,
        cursor: "pointer",
        background:
          selected && isFile
            ? "var(--mantine-color-blue-1)"
            : hovered
              ? "var(--mantine-color-gray-1)"
              : "transparent",
        userSelect: "none",
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Indent guide lines */}
      {Array.from({ length: level }, (_, i) => (
        <Box
          key={i}
          style={{
            width: 16,
            height: "100%",
            flexShrink: 0,
            borderLeft: "1px solid var(--mantine-color-gray-2)",
            marginLeft: i === 0 ? 6 : 0,
          }}
        />
      ))}

      {/* Left gap at root level */}
      {level === 0 && <Box style={{ width: 6, flexShrink: 0 }} />}

      {/* Chevron slot */}
      <Box
        style={{
          width: 14,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {hasChildren ? <ChevronIcon expanded={expanded} /> : null}
      </Box>

      {/* Icon */}
      <Box
        style={{
          width: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginLeft: 3,
          marginRight: 5,
        }}
      >
        {isFile ? <FileDocIcon /> : <FolderIcon open={expanded} />}
      </Box>

      {/* Label */}
      <Text
        size="sm"
        fw={selected && isFile ? 600 : 400}
        c={isFile ? "gray.8" : "gray.7"}
        ff={isFile ? "monospace" : undefined}
        style={{
          fontSize: 12,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
        title={node.value}
      >
        {String(node.label)}
      </Text>
    </Box>
  )
}
