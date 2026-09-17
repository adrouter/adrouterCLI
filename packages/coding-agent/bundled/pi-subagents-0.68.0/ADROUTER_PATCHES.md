# AdRouter 0.68.0 safe-subset ledger

This bundle is derived from `pi-subagents` 0.68.0 at commit
`f3ccf47dc236b6c0fcc0d897cec4a9e6da3e916d`. Exact source and npm archive values are frozen in
`upstreams.lock.json`. AdRouter carries forward its previously reviewed execution engine and ports
only bounded lifecycle behavior needed by the product.

Included runtime behavior:

- structured single, static parallel, and compatible chain execution;
- foreground/background status, interrupt, resume, and stop controls;
- bounded concurrency, output truncation, session-local run identity, cleanup, and doctor output;
- result watching and cleanup timers start with the parent session and are cleared on shutdown or reload;
- `adrouter` child-process re-entry with bundled product extensions disabled in children;
- user/project agent discovery under `.adrouter` and `~/.adrouter` only.

AdRouter policy constraints:

- maximum three children and concurrency three in every parallel group;
- at most one mutation-capable child per parallel group; other profiles explicitly use only
  `read`, `grep`, `find`, and `ls`;
- ambient credentials, provider and sponsor controls, Node preload hooks, MCP tools, normal
  extension discovery, and agent-supplied executable extensions are not copied into children;
- stop requests use a private bounded file and parallel cancellation retains an interrupt handle
  for every live child.

Explicitly disabled or omitted:

- missions, schedules, workflow JavaScript, profiles, watchdog automation, Herdr integration, and
  fleet product surfaces;
- managed worktrees, Gist sharing, provider catalog mutation, native/external intercom, and nested
  delegation;
- arbitrary cache/provider hints or access to personal Pi state.
- create/update/delete management, append-step, dynamic fanout, and executable acceptance commands.
- Herdr, remote-machine agents, external CLI agents, runtime agent registration, scheduled workflows,
  output schemas, cache-tier mutation, and the expanded 0.46.0–0.68.0 product surface.

The extension is kill-switchable with `ADROUTER_SUBAGENTS=off`. The disabled runtime still
registers stable command/tool contracts so startup diagnostics remain deterministic, but every
execution or management request returns a local disabled error without starting watchers or child
processes.
