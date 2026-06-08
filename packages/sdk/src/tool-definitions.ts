import type { ToolDefinition } from "./types"

export const rawToolDefinitions = [
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
        path: { type: "string", description: "Writable virtual path under user/**" },
        content: { type: "string", description: "Complete file content" },
        reason: { type: "string", description: "Optional reason stored in revision history" },
      },
    },
  },
  {
    name: "memory_patch",
    description: "Patch a writable user/** memory file by appending lines at EOF or under a heading, or by replacing an exact text match.",
    inputSchema: {
      type: "object",
      required: ["path", "operation"],
      additionalProperties: false,
      properties: {
        path: { type: "string" },
        operation: { type: "string", enum: ["append_lines", "replace_lines"] },
        after_heading: { type: "string", description: "For append_lines: exact markdown heading; omit to append at EOF" },
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
  {
    name: "memory_find",
    description: "Search memory for relevant files by keyword or semantic query. Returns ranked file metadata and snippets. For a formatted context block ready to inject into a prompt, use memory_context instead.",
    inputSchema: {
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Question or topic to search memory for." },
        maxChars: { type: "number", description: "Maximum characters to return. Default: 8000." },
        limit: { type: "number", description: "Maximum search candidates. Default: 10." },
        prefix: { type: "string", description: "Optional virtual path prefix, e.g. user/ or shared/." },
      },
    },
  },
] satisfies ToolDefinition[]

export const agenticToolDefinitions = [
  {
    name: "memory_remember",
    description: "Remember durable facts from raw text. MemexAI chooses the right memory files and records auditable writes.",
    inputSchema: {
      type: "object",
      required: ["text"],
      additionalProperties: false,
      properties: {
        text: { type: "string", description: "Raw conversation text or fact to remember." },
        maxWrites: { type: "number", description: "Maximum write/patch operations. Default: 5." },
        dryRun: { type: "boolean", description: "Plan writes without committing them." },
      },
    },
  },
  {
    name: "memory_context",
    description: "Read all or the most relevant memory files in one merged context block under a character budget. Query mode uses hybrid ranking when service hybrid search is configured.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxChars: { type: "number", description: "Maximum characters to return. Default: 24000." },
        query: { type: "string", description: "Optional query to rank files by relevance. Uses hybrid ranking in service hybrid mode." },
        includeRelated: { type: "boolean", description: "Include visible linked memory files. Defaults to true when query is provided." },
        relatedDepth: { type: "number", description: "Maximum link expansion depth. 0 disables linked retrieval. Default: 1, max: 2." },
      },
    },
  },
] satisfies ToolDefinition[]

export const memorySubagentToolDefinitions = agenticToolDefinitions

export const memoryToolDefinitions = [
  ...agenticToolDefinitions,
  ...rawToolDefinitions,
] satisfies ToolDefinition[]

export type MemoryToolName = (typeof memoryToolDefinitions)[number]["name"]
