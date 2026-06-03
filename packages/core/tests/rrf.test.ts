import { describe, expect, test } from "vitest"
import { reciprocalRankFusion, type RankedResult } from "../src/search"

function ranked(path: string, rank: number, matchReason: RankedResult["matchReason"]): RankedResult {
  return {
    path,
    rank,
    score: 100 - rank,
    matchReason,
    bm25Rank: matchReason === "lexical" ? rank : undefined,
    vectorRank: matchReason === "semantic" ? rank : undefined,
  }
}

describe("reciprocalRankFusion", () => {
  test("orders higher-ranked agreement above lower-ranked agreement", () => {
    const results = reciprocalRankFusion(
      [ranked("user/top.md", 1, "lexical"), ranked("user/lower.md", 5, "lexical")],
      [ranked("user/top.md", 1, "semantic"), ranked("user/lower.md", 5, "semantic")],
    )

    expect(results.map((result) => result.path)).toEqual(["user/top.md", "user/lower.md"])
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  test("handles files present in only one list", () => {
    const [result] = reciprocalRankFusion([ranked("user/budget.md", 1, "lexical")], [])

    expect(result.path).toBe("user/budget.md")
    expect(result.matchReason).toBe("lexical")
    expect(result.score).toBeCloseTo(1 / 61)
  })

  test("deduplicates same path and marks hybrid matches", () => {
    const [result] = reciprocalRankFusion(
      [ranked("user/preferences.md", 2, "lexical")],
      [ranked("user/preferences.md", 3, "semantic")],
    )

    expect(result.path).toBe("user/preferences.md")
    expect(result.matchReason).toBe("hybrid")
    expect(result.bm25Rank).toBe(2)
    expect(result.vectorRank).toBe(3)
    expect(result.score).toBeCloseTo(1 / 62 + 1 / 63)
  })

  test("returns items from the non-empty list when the other list is empty", () => {
    const results = reciprocalRankFusion([], [
      ranked("user/nature.md", 1, "semantic"),
      ranked("user/parks.md", 2, "semantic"),
    ])

    expect(results.map((result) => result.path)).toEqual(["user/nature.md", "user/parks.md"])
    expect(results.map((result) => result.matchReason)).toEqual(["semantic", "semantic"])
  })

  test("breaks ties deterministically by path", () => {
    const first = reciprocalRankFusion(
      [ranked("user/b.md", 1, "lexical")],
      [ranked("user/a.md", 1, "semantic")],
    )
    const second = reciprocalRankFusion(
      [ranked("user/b.md", 1, "lexical")],
      [ranked("user/a.md", 1, "semantic")],
    )

    expect(first.map((result) => result.path)).toEqual(["user/a.md", "user/b.md"])
    expect(second.map((result) => result.path)).toEqual(["user/a.md", "user/b.md"])
  })
})
