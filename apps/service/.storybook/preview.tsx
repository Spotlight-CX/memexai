import "@mantine/core/styles.css"
import "@mantine/code-highlight/styles.css"
import "@mantine/dates/styles.css"
import { MantineProvider } from "@mantine/core"
import type { Preview } from "@storybook/react-vite"
import React from "react"
import { MemoryRouter } from "react-router-dom"

const preview: Preview = {
  decorators: [
    (Story) => (
      <MantineProvider>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </MantineProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
}

export default preview
