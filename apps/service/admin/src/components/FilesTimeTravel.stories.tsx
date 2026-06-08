import type { Meta, StoryObj } from "@storybook/react-vite"
import React from "react"
import { FilesTimeTravelPreview } from "./FilesTimeTravelPreview"
import type { TimeTravelFile } from "./FilesTimeTravelPreview"

const selectedPath = "users/user_123/preferences.md"
const asOfLocal = "2026-06-02 12:17:00"

const currentFiles: TimeTravelFile[] = [
  file({
    path: "shared/index.md",
    content: [
      "# Shared memory",
      "",
      "- Product defaults live in shared/AGENTS.md.",
      "- Admin review is required for global memories.",
    ],
    revisionId: "rev_shared_007",
    actor: "admin",
    reason: "manual update",
    createdAt: "2026-06-03T06:12:00.000Z",
  }),
  file({
    path: "shared/AGENTS.md",
    content: [
      "# Agent guidance",
      "",
      "- Prefer concise answers.",
      "- Keep memory writes explicit and reviewable.",
    ],
    revisionId: "rev_agents_004",
    actor: "admin",
    reason: "policy refresh",
    createdAt: "2026-06-01T14:30:00.000Z",
  }),
  file({
    path: "users/user_123/index.md",
    content: [
      "# user_123",
      "",
      "- Bangalore real-estate lead.",
      "- Most recent session was a pricing clarification.",
    ],
    revisionId: "rev_index_021",
    actor: "assistant",
    reason: "memory_patch",
    createdAt: "2026-06-03T04:36:00.000Z",
  }),
  file({
    path: selectedPath,
    content: [
      "- Prefers 3BHK apartments",
      "- Budget around Rs 1.2Cr",
      "- Avoids aggressive upsells",
      "- Likes greenery and lower-density neighborhoods",
    ],
    revisionId: "rev_pref_042",
    actor: "support-agent",
    reason: "admin correction",
    createdAt: "2026-06-03T04:11:00.000Z",
  }),
  file({
    path: "users/user_123/profile.md",
    content: [
      "# Profile",
      "",
      "- Works with a two-week buying window.",
      "- Wants school proximity before commute optimization.",
    ],
    revisionId: "rev_profile_013",
    actor: "assistant",
    reason: "memory_remember",
    createdAt: "2026-06-02T05:52:00.000Z",
  }),
  file({
    path: "users/user_123/support-case.md",
    content: [
      "# Support case",
      "",
      "- Asked for refund policy on June 3.",
      "- Escalated to human support.",
    ],
    revisionId: "rev_case_001",
    actor: "support-agent",
    reason: "manual note",
    createdAt: "2026-06-03T07:20:00.000Z",
  }),
  file({
    path: "users/user_456/project.md",
    content: [
      "# Project",
      "",
      "- Building a local travel itinerary.",
      "- Prefers compact recommendations with links.",
    ],
    revisionId: "rev_project_018",
    actor: "assistant",
    reason: "memory_write",
    createdAt: "2026-06-03T02:07:00.000Z",
  }),
]

const historicalFiles: TimeTravelFile[] = [
  file({
    path: "shared/index.md",
    content: [
      "# Shared memory",
      "",
      "- Product defaults live in shared/AGENTS.md.",
      "- Admin review is required for global memories.",
    ],
    revisionId: "rev_shared_006",
    actor: "admin",
    reason: "manual update",
    createdAt: "2026-06-02T06:01:00.000Z",
  }),
  file({
    path: "shared/AGENTS.md",
    content: [
      "# Agent guidance",
      "",
      "- Prefer concise answers.",
      "- Keep memory writes explicit and reviewable.",
    ],
    revisionId: "rev_agents_004",
    actor: "admin",
    reason: "policy refresh",
    createdAt: "2026-06-01T14:30:00.000Z",
  }),
  file({
    path: "users/user_123/index.md",
    content: [
      "# user_123",
      "",
      "- Bangalore real-estate lead.",
      "- Most recent session was preference collection.",
    ],
    revisionId: "rev_index_019",
    actor: "assistant",
    reason: "memory_patch",
    createdAt: "2026-06-02T05:58:00.000Z",
  }),
  file({
    path: selectedPath,
    content: [
      "- Prefers 2BHK apartments",
      "- Budget around Rs 1.2Cr",
      "- Avoids aggressive upsells",
      "- Likes greenery and lower-density neighborhoods",
    ],
    revisionId: "rev_pref_039",
    actor: "assistant",
    reason: "memory_remember",
    createdAt: "2026-06-02T06:03:00.000Z",
  }),
  file({
    path: "users/user_123/profile.md",
    content: [
      "# Profile",
      "",
      "- Works with a two-week buying window.",
      "- Has not ranked school proximity yet.",
    ],
    revisionId: "rev_profile_012",
    actor: "assistant",
    reason: "memory_remember",
    createdAt: "2026-06-02T05:52:00.000Z",
  }),
  file({
    path: "users/user_456/project.md",
    content: [
      "# Project",
      "",
      "- Building a local travel itinerary.",
      "- Early notes only; no owner assigned.",
    ],
    revisionId: "rev_project_014",
    actor: "one-off-agent",
    reason: "memory_write",
    createdAt: "2026-06-01T18:44:00.000Z",
  }),
  file({
    path: "users/user_789/old-budget.md",
    content: [
      "# Budget",
      "",
      "- Historical note that was later deleted from current files.",
      "- Useful for validating no-current-file diff state.",
    ],
    revisionId: "rev_budget_002",
    actor: "assistant",
    reason: "memory_write",
    createdAt: "2026-05-30T11:16:00.000Z",
  }),
]

const meta: Meta<typeof FilesTimeTravelPreview> = {
  title: "Admin/Files Time Travel",
  component: FilesTimeTravelPreview,
  args: {
    currentFiles,
    historicalFiles,
    initialAsOfLocal: asOfLocal,
    initialPath: selectedPath,
  },
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof FilesTimeTravelPreview>

export const InteractiveFilesTab: Story = {}

export const TimeTravelMode: Story = {
  args: {
    initialMode: "time-travel",
  },
}

export const HistoricalTreeState: Story = {
  args: {
    initialMode: "time-travel",
    initialPath: "users/user_456/project.md",
  },
}

export const MatchedRevisionSidebar: Story = {
  args: {
    initialMode: "time-travel",
    initialPath: selectedPath,
  },
}

export const DiffFromCurrent: Story = {
  args: {
    initialMode: "time-travel",
    initialPanel: "diff",
    initialPath: selectedPath,
  },
}

export const DeletedCurrentFile: Story = {
  args: {
    initialMode: "time-travel",
    initialPanel: "diff",
    initialPath: "users/user_789/old-budget.md",
  },
}

function file({
  path,
  content,
  revisionId,
  actor,
  reason,
  createdAt,
}: {
  path: string
  content: string[]
  revisionId: string
  actor: string
  reason: string
  createdAt: string
}): TimeTravelFile {
  return {
    physicalPath: path,
    content: content.join("\n"),
    createdAt,
    updatedAt: createdAt,
    matchedRevision: {
      id: revisionId,
      operation: reason.startsWith("memory_") ? "tool" : "admin",
      actor,
      reason,
      createdAt,
    },
  }
}
