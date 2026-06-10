# Use cases page rationale

## Target persona

**Primary:** Technical builder evaluating fit — "does MemexAI actually work for my use case?" They have a specific product in mind (customer support bot, coding assistant, personal AI, SaaS with multi-tenancy) and want to see it reflected.

**Secondary:** Technical PM or founder who is pitching internally and needs a concrete example to show stakeholders.

## Page goal

Visitor finds their use case, sees a concrete description of the problem + how MemexAI addresses it, and either goes to docs or copies the setup prompt. Conversion = reduced perceived distance between their product and MemexAI.

## Section rationale

### Use case cards / index
- **Goal:** Scan-first layout. Each card = one specific use case with a problem statement, not a vague category.
- **Design choices:** Cards should name the failure mode first ("your support bot forgets the ticket it opened last week"), not lead with the solution. Makes it immediately recognizable.

### Individual use case pages
- **Goal:** Go deep on a single scenario — concrete data flow, what memory files look like, which tools the agent uses.
- **Persona context:** Developer who has already decided to evaluate. Wants enough specificity to assess implementation effort.
- **Design choices:** Should include code examples or a prompt-block snippet. Abstract descriptions don't close the gap.

### Persona coverage (current use cases)
- Customer Support AI — CX/support team buying or building
- Sales AI — GTM team or revenue-side engineers
- Multi-tenant SaaS — B2B platform builders
- Long-horizon agents — Research/autonomous agent builders  
- Multi-agent pipelines — Orchestration layer builders
- Personal AI assistants — Consumer/indie builders
- EdTech AI — Education product teams
- Memory compaction — Engineers optimizing an existing memory layer
- Agent infrastructure — Platform/infra engineers building for other teams
- Conversation extraction — Data/ML engineers pulling signal from chat
