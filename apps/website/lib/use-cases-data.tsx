import { type LucideIcon, BrainCircuit, GraduationCap, HeadphonesIcon, Layers, MessageSquareText, Scissors, Sparkles, TrendingUp, Users, Wrench } from 'lucide-react'

export type UseCase = {
  slug: string
  icon: LucideIcon
  tag: string
  title: string
  summary: string
  metaTitle: string
  metaDescription: string
  problem: string
  solution: string
  links: { label: string; href: string }[]
  codeExample?: string
}

export const useCases: UseCase[] = [
  {
    slug: 'multi-tenant-saas',
    icon: Users,
    tag: 'Multi-tenant SaaS',
    title: 'Per-user memory that your ops team can inspect and fix',
    summary:
      'Per-user memory scoped and isolated by design, with a correction surface your ops and support teams can actually use.',
    metaTitle: 'Multi-tenant AI memory — MemexAI',
    metaDescription:
      'How SaaS products use MemexAI for per-user memory that is scoped, auditable, and correctable by your ops team without reverse-engineering a vector index.',
    problem:
      'When an agent behaves differently for two users, you need to understand why. Most memory tools give you a retrieval API, not a correction surface.',
    solution:
      "MemexAI scopes memory per tenant with physical path isolation. Every write creates a revision. Your support or ops team can open a user's memory files, fix wrong facts, and see exactly what the agent learned and when. Memory becomes a product data surface you operate, not a black box you deploy.",
    links: [
      { label: 'Scopes and isolation', href: '/docs/concepts/scopes' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Admin console', href: '/docs/operations/admin-console' },
    ],
  },
  {
    slug: 'personal-ai-assistants',
    icon: Sparkles,
    tag: 'Personal AI assistants',
    title: 'Memory that grows with the user and stays correctable',
    summary:
      'Memory that feels earned — inspectable files the user or your team can open, correct, and trust over time.',
    metaTitle: 'Personal AI assistant memory — MemexAI',
    metaDescription:
      'How coaching apps, journaling assistants, and AI companions use MemexAI to build memory that users can see, correct, and trust — not a hidden profile they cannot change.',
    problem:
      'Personal AI apps — coaching bots, journaling assistants, AI companions — need memory that feels earned and trusted. When the AI remembers something wrong, users have no way to see what it learned or fix it. Trust erodes the moment the app says something that feels incorrect and unchangeable.',
    solution:
      'MemexAI stores everything the AI learns about a user in path-addressable files that any team member can open, inspect, and correct. Users can see exactly what the AI knows about them; your team can fix wrong facts directly. Revision history shows when each belief was written and why. Memory becomes a trust surface, not a hidden profile.',
    links: [
      { label: 'Memory tools', href: '/docs/concepts/memory-tools' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Prompt block', href: '/docs/concepts/prompt-block' },
    ],
    codeExample: `import { createMemex } from '@memexai/core'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

const memex = createMemex(DATABASE_URL)

// Inject everything the agent knows about this user
const { block } = await memex.getPromptBlock({ userId: user.id })

const { text } = await generateText({
  model: openai('gpt-4o'),
  system: \`You are a personal AI assistant.\\n\\n\${block}\`,
  messages,
  // Gives the agent memory_read, memory_write, memory_remember
  tools: memex.tools({ userId: user.id }),
})`,
  },
  {
    slug: 'customer-support-ai',
    icon: HeadphonesIcon,
    tag: 'Customer support AI',
    title: 'Memory that carries context across tickets and sessions',
    summary: 'Carry context across every ticket so users never have to repeat themselves again.',
    metaTitle: 'Customer support AI memory — MemexAI',
    metaDescription:
      'How customer support AI products use MemexAI to carry user context across sessions — and let support staff correct what the agent learned when something goes wrong.',
    problem:
      "Support agents ask users the same questions session after session. Memory that doesn't persist forces users to repeat themselves and agents to re-establish context from scratch.",
    solution:
      "MemexAI stores stable user facts — product tier, integration setup, known issues — in durable memory files. Each session inherits what the previous one learned. When a fact becomes wrong, support staff correct it directly. Memory stays in sync with the user's actual situation.",
    links: [
      { label: 'How it works', href: '/docs/concepts/how-it-works' },
      { label: 'Access logs', href: '/docs/concepts/access-logs' },
      { label: 'Docker quickstart', href: '/docs/quickstart/docker-service' },
    ],
  },
  {
    slug: 'long-horizon-agents',
    icon: BrainCircuit,
    tag: 'Long-horizon agents',
    title: 'Task state that survives across context resets',
    summary:
      'Task checkpoints and learned constraints that survive context resets so agents continue rather than restart.',
    metaTitle: 'Long-horizon agent memory — MemexAI',
    metaDescription:
      'How long-running AI agents use MemexAI to persist task state, completed sub-goals, and learned constraints across context window resets.',
    problem:
      'Complex tasks that span days or weeks lose intermediate state when context windows reset. Agents restart from scratch, repeat completed steps, and miss learned constraints.',
    solution:
      'Write task checkpoints, completed sub-goals, and learned constraints into memory files as the agent works. On resumption, the prompt block injects current task state before the first tool call. The agent continues from where it left off, with all hard-won context intact.',
    links: [
      { label: 'Cognitive architecture', href: '/docs/concepts/cognitive-architecture' },
      { label: 'Design principles', href: '/docs/concepts/design-principles' },
      { label: 'Background Dreaming', href: '/docs/operations/dreaming' },
    ],
  },
  {
    slug: 'multi-agent-pipelines',
    icon: Layers,
    tag: 'Multi-agent pipelines',
    title: 'Shared behavioral context across agents in a product',
    summary: 'One shared memory layer that all agents in your deployment read — update once, all agents reflect it.',
    metaTitle: 'Multi-agent pipeline memory — MemexAI',
    metaDescription:
      'How multi-agent products use MemexAI shared memory to coordinate behavioral policies across agents without redeploying prompts.',
    problem:
      "When multiple agents handle different parts of a product, coordination policies live in prompts. Changing policy means updating every agent's system prompt and redeploying.",
    solution:
      "MemexAI's shared memory layer provides read-only guidance all agents in your deployment receive automatically. Tool rules, escalation criteria, API limits, and coordination conventions live in one place. Change a shared file and every agent's next call reflects the update — no deployment needed.",
    links: [
      { label: 'Shared memory', href: '/docs/concepts/shared-memory' },
      { label: 'Trust model', href: '/docs/operations/trust-model' },
      { label: 'Prompt block', href: '/docs/concepts/prompt-block' },
    ],
  },
  {
    slug: 'agent-infrastructure',
    icon: Wrench,
    tag: 'Agent infrastructure teams',
    title: 'Memory you can debug without guessing what the agent learned',
    summary:
      'Access logs, revision history, and per-file inspection that separate write failures from retrieval failures.',
    metaTitle: 'Debuggable agent memory infrastructure — MemexAI',
    metaDescription:
      'How agent infrastructure teams use MemexAI audit logs and revision history to debug memory failures without reverse-engineering a vector index.',
    problem:
      "Debugging personalization failures is hard when memory is a vector index. You can't tell if the agent failed to write, failed to retrieve, or retrieved and ignored.",
    solution:
      "MemexAI's audit surface separates the failure modes. Access logs show every read and write with tool call IDs. Revisions show every version of every file. You can reconstruct exactly what the agent knew at any point in time and trace wrong behavior back to its cause.",
    links: [
      { label: 'Access logs', href: '/docs/concepts/access-logs' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Admin console', href: '/docs/operations/admin-console' },
    ],
  },
  {
    slug: 'sales-ai',
    icon: TrendingUp,
    tag: 'Sales AI',
    title: 'Your sales AI should remember the last call. And the one before.',
    summary:
      'Deal context, objection history, and stakeholder map persist across every call — and sales ops can correct stale facts before they cost a deal.',
    metaTitle: 'Sales AI memory — MemexAI',
    metaDescription:
      'How sales AI agents use MemexAI to remember prospect context, deal stage, and objection history across every call — and let sales ops correct stale facts before they cost a deal.',
    problem:
      'Sales AI agents that forget deal context between sessions repeat questions prospects already answered, re-surface resolved objections, and pitch the wrong tier. Stale memory in sales AI is a pipeline risk.',
    solution:
      'MemexAI persists deal context, stakeholder maps, and objection logs across every session. Sales ops can open any deal file, correct stale facts directly, and know the correction takes effect before the next call — without redeployment.',
    links: [
      { label: 'Memory tools', href: '/docs/concepts/memory-tools' },
      { label: 'Shared memory', href: '/docs/concepts/shared-memory' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
    ],
  },
  {
    slug: 'memory-compaction',
    icon: Scissors,
    tag: 'Memory health',
    title: 'Keep agent memory clean and accurate over time',
    summary:
      'As agents write to memory, files grow noisy and redundant. Run a scheduled compaction pass to merge duplicates, remove stale facts, and keep the prompt block tight.',
    metaTitle: 'Memory compaction — MemexAI',
    metaDescription:
      'How to run a scheduled background agent that reads all user memory, uses an LLM to compact and deduplicate, and writes back cleaner files — with full revision history.',
    problem:
      'Agent memory degrades over time. Overlapping facts from different sessions, outdated preferences that were never overwritten, partial updates that sit alongside their successors. The prompt block grows bloated; retrieval quality falls; the agent acts on stale context.',
    solution:
      'A scheduled compaction agent reads all memory files for a user, passes them through an LLM that merges duplicates and removes stale entries, and writes back a tighter version. MemexAI revision history means every compaction pass is traceable — you can see exactly what was merged and roll back if the LLM got it wrong.',
    links: [
      { label: 'Background Dreaming', href: '/docs/operations/dreaming' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Memory tools', href: '/docs/concepts/memory-tools' },
    ],
    codeExample: `import { createMemex } from '@memexai/core'
import { generateText } from 'ai'

const memex = createMemex(DATABASE_URL)

async function compactMemory(userId: string) {
  const user = memex.forUser({ userId, actor: 'compaction-agent' })

  const { files } = await user.list()
  const contents = await Promise.all(files.map(f => user.read(f.path)))

  const { text: compacted } = await generateText({
    model,
    system: \`Merge, deduplicate, and tighten these memory files.
Remove stale or redundant facts. Return one clean Markdown document.\`,
    prompt: contents.map(c => \`## \${c.path}\\n\${c.content}\`).join('\\n\\n'),
  })

  await user.write('user/profile.md', compacted, 'scheduled-compaction')
}`,
  },
  {
    slug: 'conversation-extraction',
    icon: MessageSquareText,
    tag: 'Memory bootstrap',
    title: 'Extract structured memory from conversation transcripts',
    summary:
      'Bootstrap agent memory from existing session logs. Turn months of conversation history into structured, inspectable memory files without replaying every message live.',
    metaTitle: 'Conversation extraction — MemexAI',
    metaDescription:
      'How to extract durable memory facts from conversation transcripts and write them as structured MemexAI files — post-session hooks or batch historical ingestion.',
    problem:
      'Teams adopting memory infrastructure have months of existing conversation logs. Starting from zero means a cold-start quality problem — the agent behaves like it just met every user. Replaying historical conversations through a live agent is slow and expensive.',
    solution:
      'A batch extraction pipeline reads conversation transcripts, uses an LLM to identify durable facts worth remembering, and writes them as structured memory files. MemexAI stores them with full revision history so you always know what came from extraction vs. live sessions.',
    links: [
      { label: 'Memory tools', href: '/docs/concepts/memory-tools' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Access logs', href: '/docs/concepts/access-logs' },
    ],
    codeExample: `import { createMemex } from '@memexai/core'
import { generateText } from 'ai'

const memex = createMemex(DATABASE_URL)

type Message = { role: 'user' | 'assistant'; content: string }

async function extractMemory(userId: string, transcript: Message[]) {
  const { text: facts } = await generateText({
    model,
    system: \`Extract durable facts worth remembering.
Focus on: preferences, decisions, recurring context.
Ignore: one-time requests, pleasantries, ephemeral state.
Return concise Markdown bullet points.\`,
    prompt: transcript.map(m => \`\${m.role}: \${m.content}\`).join('\\n'),
  })

  if (!facts.trim()) return

  const user = memex.forUser({ userId, actor: 'extraction-pipeline' })
  await user.write('user/extracted.md', facts, 'conversation-extraction')
}

// Run after each session closes
await extractMemory(userId, session.messages)`,
  },
  {
    slug: 'edtech-ai',
    icon: GraduationCap,
    tag: 'EdTech AI',
    title: 'An AI tutor that actually remembers how this student learns.',
    summary:
      'Learner profiles that grow with every session — correctable by teachers and parents, never locked in an opaque model.',
    metaTitle: 'EdTech AI memory — MemexAI',
    metaDescription:
      'How AI tutors and personalized learning products use MemexAI to build a learner profile that grows with the student — and stays correctable by teachers, parents, and the student themselves.',
    problem:
      'AI tutors accumulate learner context but can\'t surface or correct it. Teachers and parents can\'t verify or fix wrong beliefs about a student. Opacity erodes the trust personalized learning depends on.',
    solution:
      'MemexAI stores learner profiles as human-readable files. Teachers can open a student\'s profile, correct wrong assessments, and add context the AI couldn\'t learn from sessions. Revision history gives parents a verifiable record of what the AI knows.',
    links: [
      { label: 'Memory tools', href: '/docs/concepts/memory-tools' },
      { label: 'Revisions', href: '/docs/concepts/revisions' },
      { label: 'Admin console', href: '/docs/operations/admin-console' },
    ],
  },
]
