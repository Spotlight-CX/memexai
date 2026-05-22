import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAdminData } from "../hooks"
import type { AdminUser } from "../types"
import { QuickTestView } from "./QuickTestView"
import { RawToolsView } from "./RawToolsView"
import type { ToolDef } from "./tool-utils"
import { loadPrefs, savePrefs } from "./tool-utils"

type ToolPlaygroundProps = {
  apiKey: string
  secret: string
  onApiKeyInvalid: () => void
}

export function ToolPlayground({ apiKey, secret, onApiKeyInvalid }: ToolPlaygroundProps) {
  const [searchParams] = useSearchParams()
  const [tools, setTools] = useState<ToolDef[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>(() => loadPrefs().userId ?? "")
  const { data: usersData } = useAdminData<{ users: AdminUser[] }>(secret ? "/v1/admin/users" : null, secret)
  const userOptions = (usersData?.users ?? []).map((u) => u.userId)
  const view = searchParams.get("view")

  useEffect(() => {
    if (!apiKey) {
      setTools([])
      setToolsError(null)
      return
    }

    let cancelled = false
    fetch("/v1/tools", { headers: { Authorization: `Bearer ${apiKey}` } })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          onApiKeyInvalid()
          return []
        }
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
        return body.tools as ToolDef[]
      })
      .then((nextTools) => {
        if (!cancelled) {
          setTools(nextTools)
          setToolsError(null)
        }
      })
      .catch((error) => {
        if (!cancelled) setToolsError(error instanceof Error ? error.message : "Failed to load tools")
      })

    return () => { cancelled = true }
  }, [apiKey, onApiKeyInvalid])

  function handleUserIdChange(nextUserId: string) {
    setUserId(nextUserId)
    savePrefs({ ...loadPrefs(), userId: nextUserId })
  }

  if (view === "raw") {
    return (
      <RawToolsView
        apiKey={apiKey}
        tools={tools}
        toolsError={toolsError}
        userId={userId}
        userOptions={userOptions}
        onUserIdChange={handleUserIdChange}
      />
    )
  }

  return (
    <QuickTestView
      apiKey={apiKey}
      userId={userId}
      userOptions={userOptions}
      onUserIdChange={handleUserIdChange}
    />
  )
}
