import { Badge, Box, Code, Group, Paper, Stack, Text } from "@mantine/core"

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function formatResultFlags(result: unknown) {
  if (!isObject(result)) return []
  return [
    typeof result.created === "boolean" ? { label: result.created ? "created" : "not created", color: result.created ? "green" : "gray" } : null,
    typeof result.updated === "boolean" ? { label: result.updated ? "updated" : "not updated", color: result.updated ? "blue" : "gray" } : null,
    typeof result.changed === "boolean" ? { label: result.changed ? "changed" : "unchanged", color: result.changed ? "green" : "gray" } : null,
    typeof result.noOp === "boolean" ? { label: result.noOp ? "no-op" : "applied", color: result.noOp ? "yellow" : "green" } : null,
  ].filter((flag): flag is { label: string; color: string } => Boolean(flag))
}

function MemoryWriteCard({ write, index }: { write: JsonObject; index: number }) {
  const result = write.result
  const args = isObject(write.args) ? write.args : null
  const flags = formatResultFlags(result)
  const content = asString(args?.content)
  const lines = Array.isArray(args?.lines) ? args.lines.filter((line): line is string => typeof line === "string") : []

  return (
    <Paper withBorder radius={8} p="sm" style={{ background: "var(--mantine-color-gray-0)" }}>
      <Stack gap="xs">
        <Group justify="space-between" gap="xs" align="flex-start">
          <Box style={{ minWidth: 0 }}>
            <Group gap="xs">
              <Badge variant="light" color="gray">{index + 1}</Badge>
              <Text size="sm" fw={700} style={{ fontFamily: "monospace" }}>{asString(write.tool) ?? "memory_tool"}</Text>
            </Group>
            {asString(write.path) && (
              <Text size="xs" c="dimmed" mt={2} style={{ fontFamily: "monospace" }}>{asString(write.path)}</Text>
            )}
          </Box>
          {flags.length > 0 && (
            <Group gap={4} justify="flex-end">
              {flags.map((flag) => (
                <Badge key={flag.label} size="xs" color={flag.color} variant="light">{flag.label}</Badge>
              ))}
            </Group>
          )}
        </Group>

        {asString(write.reason) && <Text size="sm">{asString(write.reason)}</Text>}
        {asString(args?.operation) && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">operation</Text>
            <Code style={{ fontSize: 11 }}>{asString(args?.operation)}</Code>
          </Group>
        )}
        {asString(args?.after_heading) && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">after</Text>
            <Code style={{ fontSize: 11 }}>{asString(args?.after_heading)}</Code>
          </Group>
        )}
        {content && (
          <Code block style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {content}
          </Code>
        )}
        {lines.length > 0 && (
          <Code block style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {lines.map((line) => `+ ${line}`).join("\n")}
          </Code>
        )}
      </Stack>
    </Paper>
  )
}

function MemoryMemorizeResponse({ body }: { body: JsonObject }) {
  const writes = Array.isArray(body.writes) ? body.writes.filter(isObject) : []

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Badge color={body.dryRun ? "yellow" : "green"} variant="light">
          {body.dryRun ? "dry run" : "committed"}
        </Badge>
        <Text size="xs" c="dimmed">{writes.length} write{writes.length === 1 ? "" : "s"}</Text>
      </Group>
      {asString(body.text) && <Text size="sm">{asString(body.text)}</Text>}
      {writes.length > 0 && (
        <Stack gap="xs">
          {writes.map((write, index) => (
            <MemoryWriteCard key={`${asString(write.tool) ?? "write"}-${asString(write.path) ?? index}`} write={write} index={index} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function SearchResponse({ body }: { body: JsonObject }) {
  const results = Array.isArray(body.results) ? body.results.filter(isObject) : []
  const answer = asString(body.answer)
  const sources = Array.isArray(body.sources) ? body.sources.filter((source): source is string => typeof source === "string" && source.trim() !== "") : []
  const truncated = typeof body.truncated === "boolean" ? body.truncated : false

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="xs" c="dimmed">{results.length} result{results.length === 1 ? "" : "s"}</Text>
        {answer && <Badge size="xs" color="blue" variant="light">answer</Badge>}
        {sources.length > 0 && <Badge size="xs" color="gray" variant="light">{sources.length} source{sources.length === 1 ? "" : "s"}</Badge>}
        {truncated && <Badge size="xs" color="yellow" variant="light">truncated</Badge>}
      </Group>

      {answer && (
        <Paper withBorder radius={8} p="sm" style={{ background: "var(--mantine-color-blue-0)" }}>
          <Stack gap="xs">
            <Text size="xs" fw={700} c="blue.8">Answer</Text>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{answer}</Text>
          </Stack>
        </Paper>
      )}

      {sources.length > 0 && (
        <Group gap={4}>
          {sources.map((source) => (
            <Badge key={source} size="xs" variant="light" color="gray" style={{ fontFamily: "monospace", textTransform: "none" }}>
              {source}
            </Badge>
          ))}
        </Group>
      )}

      {results.map((result, index) => (
        <Paper key={`${asString(result.path) ?? "result"}-${index}`} withBorder radius={8} p="sm">
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={700} style={{ fontFamily: "monospace" }}>{asString(result.path) ?? "memory"}</Text>
            {typeof result.rank === "number" && <Badge size="xs" variant="light">rank {result.rank}</Badge>}
          </Group>
          {asString(result.snippet) && (
            <Text size="sm" mt="xs" style={{ whiteSpace: "pre-wrap" }}>{asString(result.snippet)}</Text>
          )}
        </Paper>
      ))}

      {!answer && sources.length === 0 && results.length === 0 && (
        <Paper withBorder radius={8} p="sm" style={{ background: "var(--mantine-color-gray-0)" }}>
          <Text size="sm" c="dimmed">
            No matching memory files returned{truncated ? " before the response was truncated." : "."}
          </Text>
        </Paper>
      )}
    </Stack>
  )
}

export function ResponseBody({ body }: { body: unknown }) {
  if (isObject(body)) {
    if (Array.isArray(body.writes)) return <MemoryMemorizeResponse body={body} />
    if (Array.isArray(body.results)) return <SearchResponse body={body} />
  }

  return (
    <Code block style={{ fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "transparent" }}>
      {JSON.stringify(body, null, 2)}
    </Code>
  )
}
