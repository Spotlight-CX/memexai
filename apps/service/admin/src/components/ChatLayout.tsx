import { Box, Stack } from "@mantine/core"
import React from "react"

export function ChatContainer({ children, maw = 760 }: { children: React.ReactNode; maw?: number }) {
  return (
    <Stack gap="lg" maw={maw} mx="auto">
      {children}
    </Stack>
  )
}

export function ChatInputWrapper({ children, maw = 760 }: { children: React.ReactNode; maw?: number }) {
  return (
    <Box
      maw={maw}
      mx="auto"
      p="sm"
      style={{
        background: "white",
        borderRadius: 16,
        border: "1px solid var(--mantine-color-gray-3)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </Box>
  )
}
