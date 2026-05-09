export const toolDefinitions = [
  {
    name: "memory_list",
    description: "List memory files visible to the current user. Optional prefix filters paths, e.g. user/ or shared/.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        prefix: { type: "string", description: "Optional virtual path prefix, e.g. user/ or shared/" },
      },
    },
  },
  {
    name: "memory_read",
    description: "Read a memory file by virtual path. Agents can read user/** and shared/**.",
    inputSchema: {
      type: "object",
      required: ["path"],
      additionalProperties: false,
      properties: {
        path: { type: "string", description: "Virtual file path, e.g. user/profile.md" },
      },
    },
  },
  {
    name: "memory_write",
    description: "Create or overwrite a writable user/** memory file.",
    inputSchema: {
      type: "object",
      required: ["path", "content"],
      additionalProperties: false,
      properties: {
        path: { type: "string", description: "Writable virtual file path under user/**" },
        content: { type: "string", description: "Complete file content" },
        reason: { type: "string", description: "Optional reason stored in revision history" },
      },
    },
  },
  {
    name: "memory_patch",
    description: "Patch a writable user/** memory file by appending lines under a heading or replacing an exact text match.",
    inputSchema: {
      type: "object",
      required: ["path", "operation"],
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        operation: { type: "string", enum: ["append_lines", "replace_lines"] },
        after_heading: { type: "string", description: "For append_lines: exact markdown heading" },
        lines: { type: "array", items: { type: "string" }, description: "For append_lines" },
        match: { type: "string", description: "For replace_lines: exact text to replace" },
        replacement: {
          oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
          description: "For replace_lines",
        },
        reason: { type: "string" },
      },
    },
  },
] as const

export type ToolName = (typeof toolDefinitions)[number]["name"]
