import { HttpError } from "./errors"

export function appendLinesAfterHeading(content: string, afterHeading: string | undefined, lines: string[]) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n"
  const all = content.split(/\r?\n/)
  if (!afterHeading?.trim()) {
    const linesToAdd = lines.filter((line) => !all.includes(line))
    if (linesToAdd.length === 0) return { content, changed: false }

    if (content === "") return { content: linesToAdd.join(newline), changed: true }
    const insertionPoint = content.endsWith("\n") || content.endsWith("\r\n") ? all.length - 1 : all.length
    const next = [...all]
    next.splice(insertionPoint, 0, ...linesToAdd)
    return { content: next.join(newline), changed: true }
  }

  const heading = afterHeading.trim()
  const headingIndex = all.findIndex((line) => line.trim() === heading)
  if (headingIndex < 0) {
    throw new HttpError(400, "PATCH_HEADING_NOT_FOUND", `Heading not found: ${afterHeading}`)
  }

  const level = heading.match(/^(#+)/)?.[1].length ?? 0
  let insertAt = all.length
  for (let index = headingIndex + 1; index < all.length; index += 1) {
    const match = all[index]?.trim().match(/^(#+)\s/)
    if (match && match[1].length <= level) {
      insertAt = index
      break
    }
  }

  const section = all.slice(headingIndex + 1, insertAt)
  const linesToAdd = lines.filter((line) => !section.includes(line))
  if (linesToAdd.length === 0) return { content, changed: false }

  const insertion = [...linesToAdd]
  if (insertAt > 0 && all[insertAt - 1] !== "") insertion.unshift("")
  if (insertAt < all.length && all[insertAt] !== "") insertion.push("")

  const next = [...all]
  next.splice(insertAt, 0, ...insertion)
  return { content: next.join(newline), changed: true }
}

export function replaceExactText(content: string, match: string, replacement: string | string[]) {
  const newline = content.includes("\r\n") ? "\r\n" : "\n"
  const replacementText = Array.isArray(replacement) ? replacement.join(newline) : replacement
  let count = 0
  let index = content.indexOf(match)
  while (index >= 0) {
    count += 1
    index = content.indexOf(match, index + match.length)
  }

  if (count === 0) throw new HttpError(400, "PATCH_MATCH_NOT_FOUND", "Exact match not found")
  if (count > 1) throw new HttpError(400, "PATCH_AMBIGUOUS_MATCH", `Ambiguous match (${count} occurrences)`)
  if (match === replacementText) return { content, changed: false }

  return { content: content.replace(match, replacementText), changed: true }
}
