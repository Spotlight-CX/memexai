import { Box, Button, Code, Group, Text, UnstyledButton } from "@mantine/core"
import { useState } from "react"

type Lang = "js" | "python"

function buildSnippet(lang: Lang, toolName: string, args: unknown, userId: string): string {
  const url = `${window.location.origin}/v1/tools/${toolName}/execute`
  const argsJson = JSON.stringify(args, null, 2)
  const userIdJson = JSON.stringify(userId)

  if (lang === "js") {
    return `const res = await fetch('${url}', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    context: { userId: ${userIdJson} },
    arguments: ${argsJson.replace(/\n/g, "\n    ")},
  }),
});
const data = await res.json();`
  }

  return `import requests

data = requests.post(
    '${url}',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'context': {'userId': ${userIdJson}},
        'arguments': ${argsJson.replace(/\n/g, "\n        ")},
    },
).json()`
}

export function CopyCodeButton({
  toolName,
  args,
  userId,
}: {
  toolName: string
  args: unknown
  userId: string
}) {
  const [opened, setOpened] = useState(false)
  const [copied, setCopied] = useState<Lang | null>(null)

  function handleCopy(lang: Lang) {
    const snippet = snippets[lang]
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(lang)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const snippets = {
    js: buildSnippet("js", toolName, args, userId),
    python: buildSnippet("python", toolName, args, userId),
  }

  return (
    <Box mt="sm">
      <UnstyledButton
        onClick={() => setOpened((value) => !value)}
        style={{ width: "100%", borderTop: "1px solid var(--mantine-color-gray-2)", paddingTop: 8 }}
      >
        <Group gap="xs" justify="space-between">
          <Text size="xs" c="dimmed" fw={600}>Code snippets</Text>
          <Text size="xs" c="dimmed">{opened ? "Hide" : "Show"} JS and Python</Text>
        </Group>
      </UnstyledButton>

      {opened && (
        <Box mt="xs">
          {([
            ["js", "JavaScript"],
            ["python", "Python"],
          ] as const).map(([lang, label]) => (
            <Box key={lang} mb="sm" style={{ position: "relative" }}>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed" fw={600}>{label}</Text>
                <Button size="xs" variant="subtle" onClick={() => handleCopy(lang)}>
                  {copied === lang ? "Copied" : "Copy"}
                </Button>
              </Group>
              <Code block style={{ fontSize: 11, whiteSpace: "pre", overflowX: "auto" }}>
                {snippets[lang]}
              </Code>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
