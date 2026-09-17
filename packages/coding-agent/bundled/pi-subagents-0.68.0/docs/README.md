# pi-subagents 0.68.0 — AdRouter safe subset

AdRouterCLI distributes a reviewed, source-derived subset of `pi-subagents` 0.68.0. Exact
upstream identity, integrity, and the local patch policy are recorded in `upstreams.lock.json` and
`ADROUTER_PATCHES.md`.

## Supported execution

- one named agent;
- a static parallel group of at most three children;
- a bounded sequential chain, including static parallel chain steps;
- foreground or background execution;
- active-session status, interrupt, stop, and resume/revive.

Every parallel group may contain at most one mutation-capable child. Other children must explicitly
use only `read`, `grep`, `find`, and `ls`. An omitted or empty tool list is mutation-capable because
the child CLI would otherwise expose its normal tool set.

Children re-enter the current `adrouter` installation at nesting depth one. They receive only the
reviewed prompt-runtime extension, `.adrouter` state, and a small environment allowlist. Ambient
credentials, sponsor controls, provider variables, MCP tools, agent-supplied executable extensions,
and the bundled cache/web/subagent extensions are not copied into children.

## Tool surface

Execution examples:

```text
subagent({ agent: "scout", task: "Inspect the request path and report findings." })
subagent({
  tasks: [
    { agent: "reader-a", task: "Inspect auth behavior." },
    { agent: "reader-b", task: "Inspect session behavior." },
    { agent: "worker", task: "Apply the already-approved fix." }
  ],
  concurrency: 3
})
subagent({
  chain: [
    { agent: "scout", task: "Find the relevant code." },
    { agent: "worker", task: "Implement only the accepted change from {previous}." }
  ]
})
```

Read-only discovery and lifecycle actions:

```text
subagent({ action: "list" })
subagent({ action: "get", agent: "scout" })
subagent({ action: "models" })
subagent({ action: "children" })
subagent({ action: "status", id: "<run-id>" })
subagent({ action: "interrupt", id: "<run-id>" })
subagent({ action: "stop", id: "<run-id>" })
subagent({ action: "resume", id: "<run-id>", message: "Continue with this clarification." })
subagent({ action: "doctor" })
```

Compatibility commands are `/run`, `/chain`, `/run-chain`, and `/parallel`. Lifecycle commands are
`/subagents-status`, `/subagents-interrupt`, `/subagents-stop`, `/subagents-resume`, and
`/subagents-doctor`.

## Deliberately unavailable

The public schema does not expose create/update/delete management, append-step, dynamic fanout,
executable acceptance commands, worktrees, sharing, external intercom, nested delegation, missions,
schedules, profiles, watchdogs, provider mutation, or arbitrary workflow JavaScript. Defensive
runtime checks reject these fields if an internal compatibility caller bypasses schema validation.

Set `ADROUTER_SUBAGENTS=off` before startup to disable execution. The extension retains stable local
tool and command registrations for diagnostics, but it starts no child process, watcher, or state
directory while disabled.
