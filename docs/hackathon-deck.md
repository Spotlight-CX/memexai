---
marp: true
theme: default
paginate: true
---

# MemexAI

Persistent memory for AI agents

Hackathon demo

---

# The Problem

AI agents forget.

Every app rebuilds memory from scratch:

- User preferences disappear
- Context is trapped in chat history
- Teams cannot inspect what the agent remembers
- Debugging memory changes is painful

---

# Why It Matters

Good agents need stable context.

But memory has to be:

- Durable
- Searchable
- Auditable
- Easy to plug into existing agents

---

# The Gap

Most demos store memory as loose text.

That works until you need to answer:

- What changed?
- Who wrote it?
- Which tool call touched it?
- Can an admin inspect it?

---

# The Solution

MemexAI is a memory service for agents.

It gives agents a simple API for persistent memory, plus an admin UI for humans.

---

# What It Includes

- REST API
- TypeScript SDK
- Framework adapters
- Postgres-backed persistence
- Revision history
- Access logs
- Admin dashboard

---

# How It Works

Agents read and write files by path.

Examples:

- `shared/index.md`
- `users/user_123/profile.md`
- `users/user_123/preferences/commute.md`

---

# Admin Dashboard

The admin UI makes memory inspectable.

- File tree
- Document-style content viewer
- Revision history
- Users
- Access logs

---

# How It Is Different

Tools like Mem0 focus on a broad memory layer:

- Managed platform
- Open-source stack
- Many framework integrations
- Self-improving memory workflows

MemexAI is intentionally simpler:

- File-based memory paths
- Human-readable content
- Revisions by default
- Access logs by default
- Admin-first inspection

---

# Demo Flow

1. Start Docker
2. Seed demo memory
3. Open admin dashboard
4. Browse files
5. Click revisions
6. Show audit logs

---

# Developer Experience

Run locally:

```bash
bun install --registry=https://registry.npmmirror.com
docker compose up -d --build
bun run seed:admin
```

Open:

```text
http://localhost:8080/admin
```

---

# Agent Integration

Smoke test:

```bash
MEMEX_URL=http://localhost:8080 \
MEMEX_API_KEY=dev-agent-key \
bun run demo:agent -- --smoke
```

---

# Why This Wins

MemexAI turns memory into infrastructure.

Not hidden prompt state.

Not scattered app code.

A service agents can use and humans can trust.

---

# What We Built

A working memory platform:

- API server
- Database schema
- SDK
- Demo agent
- Docker setup
- Admin dashboard

---

# Next

- Semantic search
- Memory permissions
- Hosted dashboard
- More framework adapters
- Better revision diffing

---

# MemexAI

Give agents a memory.

Give humans control.
