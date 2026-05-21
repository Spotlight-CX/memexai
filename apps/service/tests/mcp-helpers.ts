type FileRow = {
  id: string
  physical_path: string
  content_text: string
  created_at: Date
  updated_at: Date
}

export function createMemoryDb(seed: FileRow[] = []) {
  const files = new Map<string, FileRow>()
  for (const file of seed) files.set(file.physical_path, { ...file })

  let nextId = 0
  const revisions: unknown[] = []
  const accessLogs: unknown[] = []

  const calls: { sql: string; values: unknown[] }[] = []
  const query = async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values })
    if (sql.includes("INSERT INTO mx_file")) {
      const [, physicalPath, content] = values as [string, string, string]
      const existing = files.get(physicalPath)
      const now = new Date("2026-05-20T10:00:00.000Z")
      if (existing) {
        existing.content_text = content
        existing.updated_at = now
        return { rows: [{ id: existing.id, created: false }] }
      }

      const row = {
        id: `file_${++nextId}`,
        physical_path: physicalPath,
        content_text: content,
        created_at: now,
        updated_at: now,
      }
      files.set(physicalPath, row)
      return { rows: [{ id: row.id, created: true }] }
    }

    if (sql.includes("UPDATE mx_file SET content_text")) {
      const [content, id] = values as [string, string]
      const file = [...files.values()].find((row) => row.id === id)
      if (file) {
        file.content_text = content
        file.updated_at = new Date("2026-05-20T10:01:00.000Z")
      }
      return { rows: [] }
    }

    if (sql.includes("INSERT INTO mx_revision")) {
      revisions.push(values)
      return { rows: [] }
    }

    if (sql.includes("INSERT INTO mx_access_log")) {
      accessLogs.push(values)
      return { rows: [] }
    }

    if (sql.includes("FROM mx_file") && sql.includes("WHERE physical_path = $1")) {
      const [physicalPath] = values as [string]
      const file = files.get(physicalPath)
      return { rows: file ? [{ ...file }] : [] }
    }

    if (sql.includes("FROM mx_file") && sql.includes("ORDER BY physical_path ASC")) {
      const rows = [...files.values()].filter((file) => {
        if (values.length === 2) {
          const [exact, prefix] = values as [string, string]
          return file.physical_path === exact || file.physical_path.startsWith(prefix.replace(/%$/, ""))
        }
        const [userPrefix] = values as [string]
        return file.physical_path === "shared" || file.physical_path.startsWith("shared/") || file.physical_path.startsWith(userPrefix.replace(/%$/, ""))
      })
      rows.sort((a, b) => a.physical_path.localeCompare(b.physical_path))
      return { rows: rows.map((row) => ({ ...row })) }
    }

    return { rows: [] }
  }

  const db = {
    query,
  }

  return { db, files, revisions, accessLogs, calls }
}
