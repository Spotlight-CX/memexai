/// <reference types="node" />
/**
 * E2E test scenario — edit this file to change what is tested.
 * No runner logic lives here.
 */

// ── types ──────────────────────────────────────────────────────────────────

export type SimpleRecall = {
  label: string
  query: string
  /** Pass if any one of these appears in the recalled context. */
  mustContainAny: string[]
  /** These virtual paths must appear in filesRead (read/write symmetry). */
  mustReadFrom?: string[]
}

export type ComplexRecall = {
  label: string
  query: string
  /** Pass if ≥ CONFIG.recallPassThreshold fraction of these appear. */
  mustContain: string[]
  /** Minimum number of files the agent must read. */
  minFilesRead?: number
}

export type RecallCase = SimpleRecall | ComplexRecall

export type WriteAssertion = {
  path: string
  description: string
  /** All of these must appear in the content written to path. */
  mustContain: string[]
}

// ── config ─────────────────────────────────────────────────────────────────

export const CONFIG = {
  serviceUrl:          process.env.MEMEX_SERVICE_URL ?? "http://localhost:18080",
  apiKey:              process.env.MEMEX_API_KEY     ?? "dev-api-key",
  adminSecret:         process.env.MEMEX_ADMIN_SECRET ?? "dev-admin-secret",
  geminiKey:           process.env.GEMINI_API_KEY,
  judgeModel:          "gemini-2.5-flash",
  writePassThreshold:  0.75,  // ≥75% of expected file writes must be correct
  recallPassThreshold: 0.80,  // ≥80% of recall keywords must appear
}

// ── scenario ───────────────────────────────────────────────────────────────

export const SCENARIO = {

  // Shared guidance written to shared/ before memory_remember runs.
  // Tells the write agent which file to use for each type of fact.
  // The test then verifies the agent followed this guidance.
  sharedGuidance: {
    path: "shared/user-memory.md",
    content: `\
## Memory File Structure

When storing user memory, use these specific files:

| File                  | What goes here |
|-----------------------|----------------|
| user/preferences.md   | Apartment type (2BHK/3BHK), preferred locations, floor requirements, amenities |
| user/family.md        | Family members, relationships, children, pets |
| user/health.md        | Health conditions, allergies, physical constraints |
| user/visits.md        | Property visits: name, date, observations, asking price, verdict |
| user/index.md         | Index of all active user files (always maintain) |
| user/log.md           | Chronological write log with dates (always maintain) |

Create the file if it does not exist. Patch it if it does.
Never dump all facts into a single file.
`,
  },

  // Semantically rich seed — multi-topic, cross-file.
  seed: `\
My name is Arjun. I'm looking for a 2BHK apartment in Indiranagar or Koramangala.
My total budget is 1.2 crore. I prefer floors 4 and above.

Family: wife Meera who is allergic to dust (needs good ventilation), kids Aarav (age 9)
and Priya (age 6) who attend school near Indiranagar. We have a golden retriever named Max —
the apartment must allow pets.

I visited Prestige Tranquility last week. Liked the layout and natural light but the asking
price was 1.45 crore, which is above budget.`,

  // Write routing assertions — did memory_remember route facts to the right files?
  // user/index.md is included to verify the catalog is always kept up to date.
  expectedWrites: [
    {
      path: "user/preferences.md",
      description: "apartment type, location, budget, floor",
      mustContain: ["2BHK", "Indiranagar", "1.2"],
    },
    {
      path: "user/family.md",
      description: "family members and pets",
      mustContain: ["Meera", "Max"],
    },
    {
      path: "user/health.md",
      description: "health constraints",
      mustContain: ["dust"],
    },
    {
      path: "user/visits.md",
      description: "property visit notes",
      mustContain: ["Prestige"],
    },
    {
      path: "user/index.md",
      description: "catalog updated with all new files",
      mustContain: ["user/preferences.md"],
    },
  ] satisfies WriteAssertion[],

  // Recall cases — what memory_context must return for each query.
  recalls: [
    {
      label: "Simple — single-fact budget recall",
      query: "what is my apartment budget?",
      mustContainAny: ["1.2", "crore"],
      mustReadFrom: ["user/preferences.md"],  // read/write symmetry check
    },
    {
      label: "Complex — multi-topic full profile",
      query: "apartment requirements, family members, health constraints, visited properties, budget",
      mustContain: [
        "2BHK",          // apartment type
        "Indiranagar",   // preferred location
        "Koramangala",   // preferred location
        "1.2",           // budget figure
        "floor",         // floor preference
        "Meera",         // family member
        "dust",          // health constraint
        "ventilation",   // health constraint
        "Aarav",         // child
        "Priya",         // child
        "school",        // child constraint
        "Max",           // pet name
        "pet",           // pet constraint
        "Prestige",      // visited property name
        "1.45",          // visited property price (over budget)
      ],
      minFilesRead: 3,  // must cross topic boundaries
    },
  ] satisfies RecallCase[],

  // LLM judge rubric — evaluated holistically across all recalls in one Gemini call.
  judgeRubric: [
    "budget (1.2 crore) appears clearly in the simple recall",
    "complex recall covers: location (Indiranagar/Koramangala)",
    "complex recall covers: floor preference (4th floor or above)",
    "complex recall covers: family members (Meera, Aarav, Priya)",
    "complex recall covers: health constraint (dust allergy, ventilation)",
    "complex recall covers: pet (dog Max, pet-friendly requirement)",
    "complex recall covers: visited property (Prestige Tranquility, 1.45 crore, over budget)",
  ],
}
