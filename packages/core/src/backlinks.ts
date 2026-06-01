import type { Db } from "./db"
import type { ToolContext } from "./paths"
import { virtualToPhysical } from "./paths"

// --- Link extraction ---

export function extractWikiLinks(content: string): string[] {
  const links = new Set<string>()
  const regex = /\[\[([^\]\n]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    const path = match[1]?.trim()
    if (path) links.add(path)
  }
  return [...links]
}

// Translate a WikiLink target (virtual path) to a physical path.
// Returns null for unrecognized or invalid namespaces.
function resolveLink(link: string, ctx: ToolContext): string | null {
  try {
    return virtualToPhysical(link, ctx)
  } catch {
    return null
  }
}

// --- DB operations ---

/**
 * Syncs mx_backlink rows for sourcePath after a write or patch.
 * Deletes stale rows, inserts new ones, and recomputes importance_score
 * on all affected target files.
 */
export async function syncBacklinks(
  db: Db,
  sourcePath: string,
  content: string,
  ctx: ToolContext,
): Promise<void> {
  // 1. Extract and resolve new targets (exclude self-links)
  const virtualLinks = extractWikiLinks(content)
  const newTargets = new Set(
    virtualLinks
      .map((link) => resolveLink(link, ctx))
      .filter((p): p is string => p !== null && p !== sourcePath),
  )

  // 2. Capture old targets before deletion
  const { rows: oldRows } = await db.query<{ target_path: string }>(
    "SELECT target_path FROM mx_backlink WHERE source_path = $1",
    [sourcePath],
  )
  const oldTargets = new Set(oldRows.map((r) => r.target_path))

  // 3. Delete all existing backlinks for this source
  await db.query("DELETE FROM mx_backlink WHERE source_path = $1", [sourcePath])

  // 4. Insert new backlinks in a single batch
  if (newTargets.size > 0) {
    const values = [...newTargets]
    const placeholders = values.map((_, i) => `($1, $${i + 2})`).join(", ")
    await db.query(
      `INSERT INTO mx_backlink (source_path, target_path) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      [sourcePath, ...values],
    )
  }

  // 5. Recompute importance_score for all affected targets
  const affected = [...new Set([...oldTargets, ...newTargets])]
  if (affected.length > 0) {
    await db.query(
      `UPDATE mx_file
       SET importance_score = (
         SELECT COUNT(*)::REAL FROM mx_backlink WHERE target_path = mx_file.physical_path
       )
       WHERE physical_path = ANY($1::TEXT[])`,
      [affected],
    )
  }
}

/** Returns the physical paths of all files that link TO targetPath. */
export async function getInboundLinks(db: Db, targetPath: string): Promise<string[]> {
  const { rows } = await db.query<{ source_path: string }>(
    "SELECT source_path FROM mx_backlink WHERE target_path = $1",
    [targetPath],
  )
  return rows.map((r) => r.source_path)
}

/** Batch reverse lookup — returns source+target pairs for multiple targets. */
export async function getInboundLinksForPaths(
  db: Db,
  targetPaths: string[],
): Promise<Array<{ sourcePath: string; targetPath: string }>> {
  if (targetPaths.length === 0) return []
  const { rows } = await db.query<{ source_path: string; target_path: string }>(
    "SELECT source_path, target_path FROM mx_backlink WHERE target_path = ANY($1::TEXT[])",
    [targetPaths],
  )
  return rows.map((r) => ({ sourcePath: r.source_path, targetPath: r.target_path }))
}
