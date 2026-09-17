---
name: pi-subagents
description: Delegate bounded work to the reviewed AdRouter subagent runtime.
---

# AdRouter subagents

Use the `subagent` tool only when delegation materially improves a task. Start with
`subagent({ action: "list" })`, select only an executable agent returned by that call, and give each
child a concrete, independently completable assignment.

## Policy

- Use one child for a focused task.
- Use a static parallel group only for independent work, with at most three children.
- In a parallel group, at most one child may be mutation-capable. Every other child must have an
  explicit `read`, `grep`, `find`, and/or `ls`-only tool profile.
- Use chains when a later child truly depends on an earlier result. Keep existing `/chain` and
  `/run-chain` behavior bounded and declarative.
- Delegation depth is one. A child cannot receive or call the subagent tool.
- Treat child output as evidence to review, not as an automatic authority expansion.
- Keep sponsor and settlement data out of every child task, prompt, output instruction, and saved
  artifact.

## Lifecycle

For background work, retain the run id and use only these controls:

```text
subagent({ action: "children" })
subagent({ action: "status", id: "<run-id>" })
subagent({ action: "interrupt", id: "<run-id>" })
subagent({ action: "stop", id: "<run-id>" })
subagent({ action: "resume", id: "<run-id>", message: "Focused follow-up." })
```

`interrupt` pauses the active child turn. `stop` requests bounded cancellation without signalling an
unverified PID. `resume` follows up with a live child or revives a persisted child session when the
status report says that is available.

## Available management

The reviewed management actions are `list`, `get`, `models`, `children`, `status`, `interrupt`,
`stop`, `resume`, and `doctor`. Agent/chain create, update, and delete operations are deliberately
not tool-callable.

Do not request dynamic fanout, append-step, worktrees, Gist sharing, external intercom, missions,
schedules, profiles, watchdogs, nested delegation, executable acceptance commands, arbitrary
workflow JavaScript, MCP-direct tools, or agent-supplied executable extensions. They are outside the
AdRouter subset and are rejected before execution.

If `ADROUTER_SUBAGENTS=off`, report that delegation is disabled and complete the task directly.
