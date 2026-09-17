# pi-subagents 0.68.0 adaptation ledger

AdRouterCLI reviewed upstream `pi-subagents` through 0.68.0 at commit
`f3ccf47dc236b6c0fcc0d897cec4a9e6da3e916d`. Both the source archive and npm tarball are frozen in
`upstreams.lock.json`. The public AdRouter bundle remains a bounded safe subset, not the upstream
product wholesale.

## Release-by-release disposition

| Release | Disposition |
| --- | --- |
| 0.46.0 | Reviewed; retained compatible single/parallel/chain lifecycle fixes only. |
| 0.47.0 | Reviewed; retained bounded status and interruption compatibility only. |
| 0.47.1 | Reviewed; patch fixes accepted where already covered by the bounded engine. |
| 0.48.0 | Reviewed; product-surface additions excluded. |
| 0.49.0 | Reviewed; result and resume correctness retained where applicable. |
| 0.50.0 | Reviewed; lifecycle fixes retained, new orchestration surface excluded. |
| 0.51.0 | Adapted storage/reload resilience; external jobs and broad workflow control excluded. |
| 0.52.0 | Adapted durable async result handling; inspection and external-provider surfaces excluded. |
| 0.52.1 | Reviewed; external-job/provider additions excluded. |
| 0.53.0 | Adapted keyed result continuity; council and runtime-agent registration excluded. |
| 0.54.0 | Adapted tool-result/resume correctness; broader model and package-agent products excluded. |
| 0.55.0 | Adapted per-child stop semantics within the existing bounded controls; external jobs excluded. |
| 0.56.0 | Reviewed; fast mode and extension-authority expansion excluded. |
| 0.57.0 | Adapted resume/recovery correctness; external CLIs and workflow scripts excluded. |
| 0.58.0 | Adapted recovered-result reliability; MCP and external-run expansion excluded. |
| 0.59.0 | Adapted retained-resume correctness; host commands and workflow scripting excluded. |
| 0.60.0 | Adapted compact bounded status; expanded orchestration guidance excluded. |
| 0.61.0 | Adapted async recovery and de-duplication within the existing surface. |
| 0.62.0 | Adapted requested-cwd correctness; schedules and expanded acceptance excluded. |
| 0.63.0 | Adapted cleanup/capacity correctness; extra discovery and managed worktrees excluded. |
| 0.64.0 | Reviewed; watchdog product surface excluded. |
| 0.65.0 | Reviewed native-session lifecycle changes; AdRouter keeps its isolated child-process boundary. |
| 0.65.1 | Adapted background completion/liveness principles; ambient provider inheritance excluded. |
| 0.66.0 | Adapted readable result preservation across storage failure; fallback-model switching excluded. |
| 0.67.0 | Adapted cancellation and completion reliability; expanded workflow/Intercom surface excluded. |
| 0.68.0 | Adopted session-scoped maintenance startup/teardown and retained-result behavior; remote machines, external CLIs, schedules, schemas, and new authority remain excluded. |

## Preserved AdRouter contract

- One named child, a static parallel group of at most three, or a compatible bounded chain.
- At most one mutation-capable child in a parallel group; read-only siblings use only the reviewed
  file-inspection tools.
- Status, interrupt, stop, resume, and doctor are the only management operations.
- Children re-enter `adrouter` at depth one with bundled/user extension discovery disabled and a
  non-secret environment allowlist.
- Result watching and cleanup timers start only with a parent session and are stopped on shutdown
  or reload. Result files remain available when indexing/delivery cannot complete.

## Deferred or rejected

Missions, schedules, profiles, watchdogs, Fleet/Herdr, remote machines, external agent CLIs,
managed worktrees, Gist sharing, provider mutation, runtime agent registration, workflow
JavaScript, executable acceptance, dynamic fanout, MCP-direct tools, nested delegation, and
ambient credential/extension inheritance are absent from the public schema and rejected by policy.
