import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useToolsQuery } from "../playground-api"
import { QuickTestView } from "./QuickTestView"
import { RawToolsView } from "./RawToolsView"
import { loadPrefs, savePrefs } from "./tool-utils"

type ToolPlaygroundProps = {
  apiKey: string
  secret: string
  onApiKeyInvalid: () => void
}

export function ToolPlayground({ apiKey, secret, onApiKeyInvalid }: ToolPlaygroundProps) {
  const [searchParams] = useSearchParams()
  const [userId, setUserId] = useState<string>(() => loadPrefs().userId ?? "")
  const toolsQuery = useToolsQuery({ apiKey, onApiKeyInvalid })
  const tools = toolsQuery.data?.tools ?? []
  const toolsError = toolsQuery.error instanceof Error ? toolsQuery.error.message : null
  const view = searchParams.get("view")

  function handleUserIdChange(nextUserId: string) {
    setUserId(nextUserId)
    savePrefs({ ...loadPrefs(), userId: nextUserId })
  }

  if (view === "raw") {
    return (
      <RawToolsView
        apiKey={apiKey}
        secret={secret}
        tools={tools}
        toolsError={toolsError}
        userId={userId}
        onUserIdChange={handleUserIdChange}
      />
    )
  }

  return (
    <QuickTestView
      apiKey={apiKey}
      secret={secret}
      userId={userId}
      onUserIdChange={handleUserIdChange}
    />
  )
}
