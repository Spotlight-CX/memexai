# Enterprise Readiness: Tenancy, Scoping, and Auditability

## Status: Proposed

## Problem

MemexAI currently assumes a simple B2B or consumer SaaS model where memory is strictly partitioned by `user_id` (`users/{userId}/...`) and global read-only rules (`shared/...`). The `actor` doing the reading or writing is logged as a simple string (e.g., `"assistant"`).

For enterprise adoption, this model is insufficient:
1. **Hierarchical Tenancy:** Work happens in organizations, teams, and projects. Tying memory strictly to a `user_id` makes collaborative "team memory" impossible without dumping it into the global `shared/` bucket.
2. **Agent-Scoped Memory:** Autonomous background agents need their own memory partitions (e.g., `agents/research-agent-123/`) that aren't tied to a human user.
3. **Auditability & Impersonation:** A string `"assistant"` fails compliance audits. Enterprises need to know the *Executor* (the specific agent instance, model, or API key) and the *Authorizer* (the human user acting On Behalf Of - OBO).
4. **Approval Flows:** In strict environments, agents shouldn't blindly write to canonical team memory; they should propose writes that a human or an evaluator agent approves.

## Current Workarounds & UX

While native support is built, operators and coding agents can use the following workarounds to get things moving:

### 1. Emulating Scopes via the `shared/` Namespace
Instead of relying on `users/alice`, memory can be scoped using deep paths in the `shared/` folder:
`shared/orgs/acme/teams/marketing/projects/q4-launch/`

**Admin UI & CLI UX:**
- **CLI:** Coding agents and operators can easily filter this using the existing CLI: `memex-admin files list --prefix shared/orgs/acme/teams/marketing/`
- **Admin UI:** The UI can naturally render a tree-view or breadcrumb navigation based on these slash-delimited paths.

**The Catch (Missing Approvals & RBAC):** 
By default, `shared/` is read-only for agents. To allow agents to write here, the system must be deployed with `sharedWriteMode = "rw"`. However, this makes *all* `shared/` paths writable by *all* agents. We miss out on granular RBAC (e.g., "Agent A can only write to Team X's folder") and there is no native approval flow.

### 2. Emulating Agent-Scoped Memory via Dummy Users
Since the system expects a `user_id`, you can provision "dummy users" for background agents. 
- e.g., `user_id = "agent_research_123"`
This gives the agent a private `user/` workspace that maps to `users/agent_research_123/` under the hood.

## Proposed Future Enhancements

To natively solve these enterprise problems, the roadmap should include:

| Feature | Description |
|---|---|
| **Generic Scope URIs** | Replace `user_id` as the primary partition with a generic `scope_uri` or `tenant_id` (e.g., `urn:memex:tenant:org_123:team_456`). |
| **Rich Actor Objects** | Expand the `actor` field in `mx_access_log` and `ToolContext` to be a JSON/structured object containing `executor_id`, `executor_type`, and `authorizer_id` (for OBO workflows). |
| **Granular RBAC** | Allow operators to define read/write policies per path prefix, rather than a global `sharedWriteMode`. |
| **Memory PRs (Approval Flow)** | Introduce a "Draft" or "Proposed" state for revisions on highly sensitive paths, requiring human or evaluator approval before becoming canonical. |
| **SIEM Integration** | Native export mechanisms for `mx_access_log` to SIEMs (Datadog, Splunk) and automated data-retention pruning policies. |
