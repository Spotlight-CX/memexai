export const rawToolDefinitions = [
  {
    name: "memory_list",
    description: `List memory files visible to the current user.

Returns a flat list of virtual paths. Use \`prefix\` to scope to a namespace — \`user/\` for private files, \`shared/\` for globally readable files.

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`prefix\` | string | no | Virtual path prefix, e.g. \`user/\` or \`shared/\` |

### Example input

\`\`\`json
{ "prefix": "user/" }
\`\`\`

### Example output

\`\`\`json
{
  "files": [
    { "path": "user/profile.md", "size": 342, "updatedAt": "2025-01-15T10:23:00Z" },
    { "path": "user/notes.md",   "size": 128, "updatedAt": "2025-01-10T08:00:00Z" }
  ]
}
\`\`\``,
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
    description: `Read a single memory file by its virtual path.

Agents can read both \`user/**\` (private to the current user) and \`shared/**\` (global, read-only). Returns the raw file content as a string.

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`path\` | string | **yes** | Virtual file path, e.g. \`user/profile.md\` |

### Example input

\`\`\`json
{ "path": "user/profile.md" }
\`\`\`

### Example output

\`\`\`json
{
  "path": "user/profile.md",
  "content": "# Profile\\n- Prefers 2BHK apartments\\n- Budget: ₹80L–₹1Cr"
}
\`\`\``,
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
    description: `Create or fully overwrite a \`user/**\` memory file.

The entire file is replaced with \`content\`. Use \`memory_patch\` when you only need to change part of an existing file. Pass a \`reason\` to annotate the write — stored in revision history for auditability.

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`path\` | string | **yes** | Writable virtual file path under \`user/**\` |
| \`content\` | string | **yes** | Complete replacement content |
| \`reason\` | string | no | Stored in revision history |

### Example input

\`\`\`json
{
  "path": "user/profile.md",
  "content": "# Profile\\n- Prefers 2BHK\\n- Budget: ₹80L",
  "reason": "Initial profile setup"
}
\`\`\`

### Example output

\`\`\`json
{ "ok": true, "path": "user/profile.md", "bytes": 48 }
\`\`\``,
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
    description: `Patch a \`user/**\` memory file without rewriting it entirely.

Two operations available:
- **\`append_lines\`** — append lines to the end of the file, or insert them under a specific markdown heading when \`after_heading\` is provided
- **\`replace_lines\`** — find an exact text match and replace it

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`path\` | string | **yes** | Writable virtual file path |
| \`operation\` | enum | **yes** | \`append_lines\` or \`replace_lines\` |
| \`after_heading\` | string | no | For \`append_lines\`: exact markdown heading to insert under; omit to append at EOF |
| \`lines\` | string[] | no | For \`append_lines\`: lines to insert |
| \`match\` | string | no | For \`replace_lines\`: exact text to find |
| \`replacement\` | string \| string[] | no | For \`replace_lines\`: replacement content |
| \`reason\` | string | no | Stored in revision history |

### Example input

\`\`\`json
{
  "path": "user/notes.md",
  "operation": "append_lines",
  "lines": ["- Likes rooftop gardens"],
  "reason": "New preference noted"
}
\`\`\`

### Example output

\`\`\`json
{ "ok": true, "linesChanged": 1 }
\`\`\``,
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
    name: "memory_smart_read",
    description: `Read all (or the most relevant) memory files within a character budget, returned as a single merged context block ready to inject into a system prompt.

Optionally pass a \`query\` to rank files by keyword relevance so the most useful content fits within \`maxChars\`.
When a query is provided, deterministic linked recall is enabled by default: directly matched files are included first, then visible one-hop \`[[user/...]]\` or \`[[shared/...]]\` links are added if budget remains.

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`maxChars\` | number | no | Maximum characters to return. Default: 24 000 |
| \`query\` | string | no | Keyword query to rank files by relevance |
| \`includeRelated\` | boolean | no | Include directly linked memory files. Defaults to true when query is set |
| \`relatedDepth\` | number | no | Link expansion depth, 0-2. Default: 1 |

### Example input

\`\`\`json
{ "maxChars": 4000, "query": "apartment preferences" }
\`\`\`

### Example output

\`\`\`json
{
  "content": "<memory>\\n<file path=\\"user/profile.md\\">\\n# Profile\\n- Prefers 2BHK\\n</file>\\n</memory>",
  "truncated": false,
  "filesRead": 2
}
\`\`\``,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxChars: { type: "number", description: "Maximum characters to return. Default: 24000." },
        query: { type: "string", description: "Optional query to rank files by keyword relevance." },
        includeRelated: { type: "boolean", description: "Include visible files linked with [[user/...]] or [[shared/...]]. Defaults to true when query is provided." },
        relatedDepth: { type: "number", description: "Maximum link expansion depth. 0 disables linked retrieval. Default: 1, max: 2." },
      },
    },
  },
] as const

export const agenticToolDefinitions = [
  {
    name: "memory_memorize",
    description: `Feed raw text (conversation snippets, notes, observations) and let MemexAI autonomously decide what to remember and where to store it.

MemexAI reads existing memory files, identifies durable facts, and writes or patches them — all with full audit trails. Use \`dryRun: true\` to preview planned writes without committing.

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`text\` | string | **yes** | Raw text containing facts to remember |
| \`maxWrites\` | number | no | Max write/patch operations. Default: 5 |
| \`dryRun\` | boolean | no | Plan writes without committing |

### Example input

\`\`\`json
{
  "text": "User mentioned they prefer 2BHK, budget around ₹80L, and want a sea view.",
  "maxWrites": 3
}
\`\`\`

### Example output

\`\`\`json
{
  "writes": [
    { "path": "user/profile.md", "operation": "patch", "reason": "Added apartment preferences" }
  ],
  "dryRun": false
}
\`\`\``,
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
    name: "memory_search",
    description: `Search memory for a question using BM25 full-text search.

When an LLM is configured, agentic resolution reads the top BM25 candidates and synthesizes a grounded answer. Without an LLM, returns raw matching file excerpts.

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| \`query\` | string | **yes** | Question or topic to search for |
| \`maxChars\` | number | no | Max characters to return. Default: 8 000 |
| \`limit\` | number | no | Max BM25 candidates. Default: 10 |
| \`maxReads\` | number | no | Max files the agentic resolver may inspect. Default: 5 |
| \`prefix\` | string | no | Optional virtual path prefix, e.g. \`user/\` |

### Example input

\`\`\`json
{
  "query": "What is the user's budget?",
  "maxChars": 2000
}
\`\`\`

### Example output

\`\`\`json
{
  "answer": "The user's budget is ₹80L–₹1Cr based on their profile notes.",
  "sources": ["user/profile.md"]
}
\`\`\``,
    inputSchema: {
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string", description: "Question or topic to search memory for." },
        maxChars: { type: "number", description: "Maximum characters to return. Default: 8000." },
        limit: { type: "number", description: "Maximum BM25 candidates. Default: 10." },
        maxReads: { type: "number", description: "Maximum files the agentic resolver may inspect. Default: 5." },
        prefix: { type: "string", description: "Optional virtual path prefix, e.g. user/ or shared/." },
      },
    },
  },
] as const

export const toolDefinitions = [
  ...agenticToolDefinitions,
  ...rawToolDefinitions,
] as const

export type ToolName = (typeof toolDefinitions)[number]["name"]
export type ToolDefinition = (typeof toolDefinitions)[number]
