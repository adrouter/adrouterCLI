# Active plan: Pi 0.85.1 and bundled-extension upgrade — 17 September 2026

## Goal

Upgrade the adapted Pi core and reviewed bundled extensions while preserving AdRouterCLI behavior,
interfaces, trust boundaries, hosted authentication, sponsor isolation, and rollback compatibility.

| Component | Current reviewed version | Target |
| --- | ---: | ---: |
| Pi core | 0.84.1 adaptations over 0.81.0 lineage | 0.85.1 |
| pi-subagents | 0.45.2 | 0.68.0 |
| pi-cache-optimizer | 2.8.2 | 2.8.10 |
| pi-web-access | 0.13.0 | 0.29.0 |

Keep BTW and the integrated TUI overlay, adapting them only for compatibility. Change other
dependencies only when required by this upgrade.

## Status

`in_progress`

## Phase 1: Preserve and verify rollback

- [ ] Preserve main source SHA `0a54bad573ca5926de45a6f4ce79888086468d2f` separately from the
  published rollback source.
- [ ] Archive `0.81.0-beta.27` source, npm tarball, checksums, SBOM, provenance, bundled-source
  inventory, and authentication acceptance under
  `~/.local/share/adroutercli/rollback/0.81.0-beta.27/` without credentials or personal state.
- [ ] Verify npm integrity and GitHub checksums; document archived-tarball reinstall and
  `npm install --global --ignore-scripts @adrouter/cli@0.81.0-beta.27` fallback.
- [ ] Establish pre-edit checks and synthetic upgrade/downgrade fixtures without personal state.

## Phase 2: Freeze and verify upstream inputs

- [ ] Freeze exact versions, commits, source URLs, archive hashes, npm integrities, licenses, and
  dependency changes in `upstreams.lock.json`.
- [ ] Validate GitHub source archives against source SHA-256 and npm tarballs independently against
  npm integrity plus tarball SHA-256; add mismatch tests for both.
- [ ] Commit intake metadata before running clean-tree `upstream:stage`.
- [ ] Extend the adopt/adapt/defer/reject ledger for every intervening release. Treat only
  source-derived changes as adopted.

## Phase 3: Reversible implementation phases

- [ ] Pi core: port applicable streaming, tool-call, session, compaction, extension-lifecycle,
  filesystem, and terminal correctness fixes into all four packages. Preserve installation proof,
  fresh request proofs, trust/approvals, sponsor isolation, generated models, Kimi continuation,
  presence gates, incomplete-stream handling, SDK/RPC snapshots/exports, formats, settings, and
  environment behavior. Retain `GoogleThinkingLevel` compatibility where needed. Ensure cleanup
  runs once and terminating turns cannot start another request. Exclude remote/server products,
  new tools, telemetry, self-update, new catalogs, and automatic paid retries.
- [ ] Cache optimizer: retain byte-neutral stats-only defaults, normalized usage, DeepSeek-only
  opt-in canonicalization, private settings, and kill switch. Exclude configuration repair and
  added persistent statistics.
- [ ] Subagents: port applicable lifecycle, cancellation, retained-result, and startup fixes while
  preserving `adrouter` child execution, isolated state/environment, depth one, at most three
  children, and at most one mutation-capable child. Exclude missions, schedules, remote execution,
  arbitrary workflows, and nested delegation.
- [ ] Web access: preserve existing tools, commands, browserless auto-summary, configuration paths,
  and cookie opt-in. Port extraction, caching, cancellation, and routing fixes without new
  providers, credential resolvers, or tools; proxy handling must not alter hosted AdRouter requests.

## Phase 4: Packaging and compatibility metadata

- [ ] Update versioned bundle directories, build entrypoints, imports, and fixtures together.
- [ ] Derive the web bundle location from the canonical upstream lock.
- [ ] Pin required dependency changes exactly and regenerate lockfile, CLI shrinkwrap,
  bundled-source records, runtime contracts, and notices through repository tooling.
- [ ] Keep all AdRouter packages in lockstep and separate from Pi versions. Retain Node
  `>=22.19.0` unless adopted code proves a higher floor is required.
- [ ] Preserve persisted formats so the rollback remains usable.

## Phase 5: Verification, release, and deployment

- [ ] Run focused tests after each component, followed by `npm run upstream:check`,
  `npm run build`, `npm run check`, `npm run test:isolated`,
  `node scripts/ci-package-smoke.mjs`, and an isolated-prefix `npm run install:local`.
- [ ] Verify hosted auth lifecycle, doctor redaction, trust/approvals, presence and sponsor
  isolation; streaming/truncation/cancellation/compaction/session/Kimi/SDK/RPC compatibility;
  subagent limits and cleanup; cache byte neutrality; web configuration/browserless/proxy/package
  behavior; and terminal/platform coverage.
- [ ] Rehearse beta.27 -> upgraded build -> beta.27 against synthetic fixtures and document results.
- [ ] Record unavailable physical-platform or live-auth acceptance explicitly.
- [ ] From a clean exact commit, publish an unused immutable successor through the protected
  candidate workflow using the same tag as workflow input and dispatch ref; verify package bytes,
  provenance, anonymous install, GitHub release, and required acceptance.
- [ ] Re-query public state, then promote the verified candidate through the protected finalization
  workflow and independently verify final aliases, candidate absence, deprecation, integrity, and
  public non-draft prerelease state.

## Boundaries

No general dependency refresh, new product feature, Desktop/Router change, remote-secret change, or
unrelated channel movement. Candidate publication and final promotion remain distinct protected
operations, both explicitly authorized by the 17 September 2026 request to deploy directly.

---

# Active iteration: 0.81.0-beta.27 — 13 September 2026

Operator approved Kimi CLI/Desktop qualification, early OpenCode ad delivery with a permanent three-row footer, hosted Router update and immutable successor candidate publication. Kimi stays excluded from OpenCode. Preserve preceding UI/output/presence work and all historical receipts below. beta/latest stay unchanged. Needed Kimi test tokens are authorized; preserve account caps and private-data boundaries. Implementation and qualification are in progress; publication is not yet claimed. Candidate beta.26 was consumed by a tag-validation failure before artifact creation; immutable fix-forward continues as beta.27.

# Candidate publication authorization — 12 September 2026

The operator explicitly authorized successor candidate publication with Kimi disabled in CLI/Desktop and excluded from OpenCode. Include GLM, both Qwen models, presence gating where applicable and preserved UI/output fixes. Exact-artifact live acceptance continues on candidates; beta/latest finalization remains separately authorized. This supersedes the earlier requirement to finish Kimi qualification before these candidate publications.

## Active combined candidate instruction — 12 September 2026

The operator-authorized combined plan supersedes conflicting sequencing and migration guidance below. `adrouter` is the active GitHub organization; `adrouter-co` is backup only. Explicit release targets are `adrouter/adrouterCLI`, `adrouter/adrouterAgent`, and `adrouter/adrouter-opencode`; local remote names do not establish authority. Never enable backup release workflows.

Successor candidates must preserve existing models, Desktop appearance/timeline/approvals/streaming, output settings, limits, truncation and authentication, and include GLM-5.3, Kimi K3 (WebUI/CLI/Desktop; excluded from OpenCode), both Qwen 3.8 models, and CLI/Desktop 60-second presence gating together. Presence includes first-response waiting, fresh task/prompt-bound acknowledgement, runtime execution boundaries, cancellation, approval timer suspension, RPC/IPC and noninteractive attention-required handling. Existing streams settle without replay. Kimi tools remain gated until real continuation qualification; reasoning remains memory-only. OpenCode excludes Kimi.

### Status
`in_progress`

- [ ] Reconcile dirty files and immutable baseline candidates before scoped commits.
- [ ] Complete combined implementation and deterministic presence acceptance.
- [ ] Run owning full checks and authenticated model/surface and packaged UI acceptance.
- [ ] Recheck spending/liabilities before bounded paid tests; preserve completed owner-cap and Kimi browser-vision receipts.
- [ ] Update landing lists truthfully; deploy any changed API before matching WebUI from clean exact commits with rollback/Pages preservation plan.
- [ ] Publish unused immutable successor candidates through active protected workflows, using the same tag as input and dispatch ref; verify integrity, native checksums, provenance and installation.
- [ ] Deliver exact macOS/Windows candidates for operator acceptance. Promotion requires separate authorization.

### Validation Results
Local presence implementation, Router/WebUI checks, CLI checks and focused runtime/provider/RPC tests, Desktop full checks and real 60-second packaged macOS acceptance, OpenCode checks, and landing catalog checks passed. Full live Kimi/cross-surface acceptance and immutable successor publication remain incomplete. No release channels or hosted deployments changed. See implementation receipt (workspace-only reference: `../../docs/combined-candidate-implementation-2026-09-12.md`) for exact counts, baseline identities and blockers.

# Plan: Queued CLI models and presence prompt

## Goal

After WebUI acceptance, regenerate catalog and add runtime blocking presence prompt with fresh Enter every minute of thinking/reading.

## Context

Approved 2026-09-11. First milestone is the live owner-only WebUI. This scope is queued until WebUI acceptance.
Baseline label: **before new models, still there. adrouterAgent UI fixes + new output limit**.
Recovery commits and original dirty-state metadata are in `../../docs/baseline-before-new-models-20260911.json`. Published candidates and deployed artifacts are distinct from these source checkpoints.

## Research Summary

Official references: https://docs.z.ai/llms.txt, https://platform.kimi.ai/docs/llms.txt, https://www.alibabacloud.com/help/en/model-studio/models. Verify exact regional prices/limits and account access before enabling selected IDs: glm-5.3, kimi-k3, qwen3.8-max, qwen3.8-flash. No replacement IDs. Context7 is not needed for the existing adapter approach.

## Constraints

- Add to existing behavior; preserve all unfinished work below, Desktop UI fixes and output limits.
- Provider keys remain backend-only: ZAI_API_KEY, MOONSHOT_API_KEY, QWEN_API_KEY.
- Keep catalog schema 2 and existing thinking vocabulary compatible with current clients.
- Kimi continuation is memory-only; hold Kimi if compliant continuation is infeasible.
- Preserve owner-only access, account spending limits and other existing account caps. New accounts default to 16384; owner at least 16384.
- Live acceptance costs at most US$1 aggregate, including earlier tests, retries and unresolved liabilities. Permanently raise only owner daily/monthly caps to at least US$5, preserving higher values; this does not raise the test ceiling.
- Sponsor metadata never enters model/tool context. No automatic replay after partial output.
- No new dependencies or unrelated redesign. All deploy inputs must be clean and committed.

## Out of Scope

Public-channel promotion, replacement of existing candidate features, unrelated UI redesign and destructive database resets.

## Reversibility

Existing tags remain immutable. Checkpoints preserve source without changing working trees. Deploy API before Pages from exact commits; record immutable rollback artifacts. Database/account rollback requires deliberate review.

---

## Step A: Preserve and prepare

### Status

`done`

### Tasks

- [x] Preserve original source in recovery checkpoint commits.
- [x] Retain existing plan contents without replacement.

### Acceptance Criteria

- [x] Existing tags and working source are preserved.

### Validation Results

- Repository status and checkpoint creation: passed; no working-tree reset.

---

## Step B: Implement scoped additions

### Status

`todo`

### Tasks

- [ ] After WebUI acceptance, regenerate catalog and add runtime blocking presence prompt with fresh Enter every minute of thinking/reading.
- [ ] Record official provider capabilities, admission ceilings and pricing evidence before enablement.
- [ ] Keep live deployment held until keys and preflight evidence are available.

### Relevant Files

- Source, tests, configuration and release inputs owned by `adrouter_release/adrouterCLI`.

### Expected Changes

- Modify only scoped source, tests and documented configuration; regenerate catalog outputs using owning generators.

### Do Not Modify

- Existing immutable tags, private credentials, unrelated working changes, generated artifacts by hand.

### Acceptance Criteria

- [ ] Scoped behavior works and existing behavior remains covered.
- [ ] For CLI/Agent: after 60 seconds thinking/reading, fresh Enter clears the gate; current stream continues but interactions and new tool/model/delegation rounds wait. Repeat each minute. Headless CLI reports attention-required. Enter never grants another approval.
- [ ] Provider vision is distinguished from client attachment support.

### Validation Results

- Implementation and hosted acceptance: not run.

---

## Step C: Final verification and cleanup

### Status

`todo`

### Tasks

- [ ] Run relevant checks and review final diff for unintended changes.
- [ ] Remove temporary debugging changes and update developer configuration documentation.
- [ ] Record test results, remaining blockers and exact source/deployment receipts.

### Commands

```sh
npm run check
```

### Acceptance Criteria

- [ ] Relevant tests pass; unavailable database/native/live checks are explicitly recorded.
- [ ] API/WebUI release uses clean exact commits and validated artifacts, with no unintended Pages auto-deploy.

### Validation Results

- Checks: not run for these additions.

## Follow-up Work

Client candidates and landing updates follow successful WebUI acceptance. Physical Desktop acceptance remains separate from automated checks.

## Decision Log

| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-09-11 | WebUI first; preserve existing plans and candidates | Explicit user instruction | Later surfaces remain queued |
| 2026-09-11 | Backend-only direct international PAYG keys | Approved provider choice | No browser secrets |

---

## Preserved earlier plan and unfinished work

# Plan: Pi and external-extension upgrade workflow

## Goal

Create a reproducible upstream-intake workflow, synchronize AdRouterCLI with Pi 0.84.1, restore a
conservative AdRouter cache optimizer, upgrade the bundled subagent runtime through a strict safe
subset, port the accepted behavior to the desktop Agent, finalize the preceding security release,
and publish the implementation as the next immutable npm candidate.

## Context

- AdRouterCLI is a four-package npm monorepo forked from Pi and releases its packages in lockstep.
- The baseline CLI vendored pi-subagents 0.30.0, pi-web-access 0.13.0, and BTW; the earlier cache
  optimizer was retired with provider registration and executable `models.json` configuration.
- The desktop Agent consumes exact upstream Pi dependencies directly and intentionally does not run
  arbitrary executable Pi extensions.
- This wave freezes Pi 0.84.1, pi-cache-optimizer 2.8.2, and pi-subagents 0.45.2. A newer release
  discovered during implementation is recorded for the next wave rather than silently expanding
  scope.
- The user selected controlled Pi core sync, stats-first cache optimization with prompt rewrite
  opt-in, and a bounded subagent subset.

## Research Summary

- Pi 0.84.1 introduces TypeBox 1.3.7, request-transform and provider-header changes, delta-only
  message updates, new session/repository APIs, and optional telemetry/client/protocol features.
- pi-cache-optimizer 2.8.2 mixes useful prompt-prefix/statistics logic with provider mutation,
  `models.json` surgery, and raw provider cache controls that are incompatible with hosted
  `/v1/agent/turn`.
- pi-subagents 0.45.2 adds workflow scripts, missions, schedules, intercom, worktrees, watchdogs,
  profiles, and nested delegation. Only structured run/parallel/lifecycle behavior is in scope.
- Router already returns authoritative cache-read/cache-write settlement data and does not expose a
  client cache-hint field. This wave therefore leaves the hosted Router request schema unchanged.

## Constraints

- Preserve hosted installation auth, DPoP proofs, exact Router endpoints, generated model catalog,
  workspace trust, approvals, redaction, bounded streaming, and local session ownership.
- Sponsor and settlement data must remain outside prompts, assistant text, tools, commands, edits,
  child-agent context, and compaction.
- Preserve existing public behavior unless this plan explicitly narrows the bundled extension
  surface; keep compatibility adapters for existing chain commands.
- Keep changes reviewable and reversible; use exact versions, checked-in lockfiles, and no runtime
  downloads.
- Do not add upstream credential export, provider registration, executable `models.json`, self
  update, telemetry egress, or remote client/server product surfaces.
- Keep CLI and Agent histories, lockfiles, toolchains, tags, and release channels independent.
- The user explicitly authorized finalizing the preceding CLI and Agent security releases, then
  publishing the follow-on CLI and Agent candidates. No other tag, channel, hosted service, database,
  traffic, signing, or deployment mutation is authorized.

## Out of Scope

- Updating pi-web-access, BTW, unrelated TUI overlays, Router cache-hint APIs, or OpenCode.
- Enabling subagent missions, schedules, Gist sharing, external intercom, managed worktrees,
  watchdog automation, provider profiles, nested delegation, or arbitrary workflow JavaScript.
- Redesigning unrelated desktop UI or replacing the Agent's native sandbox/approval architecture.
- Finalizing the follow-on Pi/cache/subagent candidate, stable publication, or any hosted-service
  deployment.

## Reversibility

- Land upstream governance, Pi core, cache, subagents, and Agent work as separable phases.
- Preserve compatibility adapters and keep cache prompt rewriting opt-in.
- Provide independent local kill switches for cache optimization and subagents.
- Reconstruct vendored bundles from exact upstream sources plus reviewed local patches.
- Fix forward under a higher immutable prerelease if a published artifact later regresses.

---

## Step A: Reproducible upstream intake and provenance

### Status

`done`

### Objective

Make exact upstream discovery, verification, staging, provenance, and bundle contracts repeatable.

### Tasks

- [x] Add one canonical upstream lock covering Pi core and bundled third-party sources.
- [x] Add offline validation, live advisory audit, and clean-tree exact staging commands.
- [x] Generate or validate runtime bundle contracts and packaged provenance from the lock.
- [x] Remove scattered hard-coded bundle versions where the central manifest can drive them.

### Relevant Files

- `upstreams.lock.json`
- `scripts/`
- `docs/bundled-sources.json`
- `packages/coding-agent/src/core/bundled-features.ts`

### Expected Changes

- create: canonical lock, schema/check/audit/stage scripts, focused tests, workflow documentation
- modify: package scripts, bundle contracts, provenance and release-readiness checks
- delete: no bundled source in this step

### Do Not Modify

- hosted auth/model/Router contracts
- generated model catalogs
- npm/GitHub release state

### Commands

```bash
npm run upstream:check
npm run upstream:audit
npm run check
```

### Acceptance Criteria

- [x] Locked sources include exact version, commit, source, integrity/hash, license, local patches,
      and feature disposition.
- [x] Offline checks fail on provenance drift or unexpected packaged bundle contents.
- [x] Live audit reports newer releases without changing files or failing ordinary CI for age alone.
- [x] No runtime path downloads executable extension source.

### Validation Results

- `npm run upstream:check`: passed (6 component records, 4 runtime extensions, 3 tests)
- `npm run upstream:audit`: passed; Pi 0.84.1, pi-subagents 0.45.2, and
  pi-cache-optimizer 2.8.2 remain current; pi-web-access 0.21.0 is recorded for a later wave
- `npm run check`: passed

### Findings / Notes

- Runtime bundle inventory and bundled-source notices are generated deterministically from the lock.
- The staging command requires an exact frozen target and a clean tree, verifies SHA-256 and npm
  integrity before extraction, and never modifies repository files.

---

## Step B: Controlled Pi 0.84.1 core synchronization

### Status

`done`

### Objective

Port the reviewed Pi 0.84.1 core into the existing four AdRouter packages without weakening product
or security boundaries.

### Tasks

- [x] Record an adopt/adapt/defer/reject ledger for upstream changes from the 0.81 baseline.
- [x] Port reviewed core changes and align host schemas on TypeBox 1.3.7.
- [x] Adapt nullable headers, agent settlement, event-bus lifecycle, tool termination, and TUI/path
      behavior without replacing AdRouter's existing streaming/session contracts.
- [x] Preserve current AdRouter RPC/JSON, auth, model, sponsor, approval, and session contracts.
- [x] Reject or disable upstream provider credentials, telemetry egress, self-update, and remote
      client/server surfaces.

### Relevant Files

- `packages/ai/`
- `packages/agent/`
- `packages/tui/`
- `packages/coding-agent/`

### Expected Changes

- modify: the four package sources, manifests, lockfile, focused tests, upstream provenance
- create: compatibility/adaptation ledger and any internal no-egress adapters required by the port
- delete: obsolete internals only after equivalent behavior is covered

### Do Not Modify

- generated `adrouter.models.ts` by hand
- hosted installation proof, official routes, or sponsor isolation
- package version/channel metadata for publication

### Commands

```bash
npm run typecheck
npm run check
```

### Acceptance Criteria

- [x] Pi 0.84.1 source identity and every intentional AdRouter divergence are documented.
- [x] Four package manifests and the lockfile remain internally consistent.
- [x] Existing JSON/RPC clients, auth flows, catalogs, compaction, tools, and TUI tests pass.
- [x] No new credential, provider-registration, self-update, or telemetry network authority exists.

### Validation Results

- `npx tsgo --noEmit`: passed
- `npm run check`: passed

### Findings / Notes

- Keep optional upstream client/protocol/fullscreen products deferred unless a reviewed core import
  cannot compile without an internal, non-public adapter.

---

## Step C: Conservative cache optimizer

### Status

`done`

### Objective

Restore truthful cache diagnostics and an explicitly enabled DeepSeek prompt-prefix optimizer while
leaving hosted Router request framing unchanged.

### Tasks

- [x] Derive a narrow AdRouter extension from pi-cache-optimizer 2.8.2 with exact provenance.
- [x] Implement `off`, `stats-only`, and `prompt-rewrite` modes with stats-only as the default.
- [x] Remove provider registration, `models.json`, compat/fix mutation, and raw hosted cache fields.
- [x] Restrict prompt rewrite to known stable instruction blocks and exclude skills compression.
- [x] Add truthful normalized-usage stats, secret-free doctor output, state permissions, and a kill
      switch.

### Relevant Files

- `packages/coding-agent/bundled/`
- `packages/coding-agent/src/core/`
- `packages/coding-agent/test/`

### Expected Changes

- create: adapted cache extension, license/provenance, focused unit/integration tests
- modify: bundle manifest/contracts, packaged inventory, documentation
- delete: no current provider or model configuration

### Do Not Modify

- hosted `/v1/agent/turn` body or proof calculation
- sponsor display/settlement separation
- official model catalog

### Commands

```bash
npm run upstream:check
npm run check
```

### Acceptance Criteria

- [x] Stats-only mode is request-byte neutral and reports only authoritative normalized usage.
- [x] Prompt rewrite is opt-in, DeepSeek-only, content-preserving, and sponsor-free.
- [x] No command reads or writes `models.json` or registers a provider.
- [x] Missing cache telemetry is shown as unavailable rather than fabricated.

### Validation Results

- `npm run upstream:check`: passed (6 component records, 4 runtime extensions)
- focused cache tests: passed (7 tests; package suite 38 tests)
- `npm run check`: passed

### Findings / Notes

- Live cache-effectiveness canaries are manual candidate acceptance, not production automation.

---

## Step D: Safe pi-subagents 0.45.2 subset

### Status

`done`

### Objective

Adopt the current subagent lifecycle internals while exposing only bounded structured execution and
management compatible with AdRouter trust and approval policy.

### Tasks

- [x] Reconstruct the source-derived bundle against pi-subagents 0.45.2 plus reviewed AdRouter patches.
- [x] Keep structured single, parallel, and compatibility chain execution; do not expose arbitrary
      workflow JavaScript.
- [x] Allow only list/get/models/children/status/resume/stop/interrupt/doctor management actions.
- [x] Enforce three children, depth one, read-only parallel profiles, and a single mutating child.
- [x] Redirect executable/state paths to AdRouter and remove/deactivate every deferred subsystem.

### Relevant Files

- `packages/coding-agent/bundled/pi-subagents-*`
- `packages/coding-agent/src/core/bundled-features.ts`
- `packages/coding-agent/test/bundled-*`

### Expected Changes

- create: exact 0.45.2-derived bundle, patch/provenance record, policy wrapper and tests
- modify: command/tool contracts, packaged inventory, docs and readiness checks
- delete: old 0.30.0 bundle after reconstructed replacement passes

### Do Not Modify

- personal `~/.pi` or project `.pi` state
- hosted auth material, provider catalog, or sponsor context
- worktrees, schedules, missions, Gist, intercom, watchdog, nested delegation, or provider profiles

### Commands

```bash
npm run upstream:check
npm run check
npm run install:local
```

### Acceptance Criteria

- [x] Deferred fields/actions are absent from the public schema and rejected before execution.
- [x] Child launch, status, resume, stop, cancellation, cleanup, trust, and approval tests pass.
- [x] Children launch `adrouter`, use only `.adrouter` state, and never receive copied credentials
      or sponsor data.
- [x] The installed package contains only the exact declared bundle source and licenses.

### Validation Results

- focused subagent/loader/state/spawn tests: passed (34 tests; safe-subset file 7 tests)
- `npm run upstream:check`: passed (6 component records, 4 runtime extensions)
- `npm run check`: passed
- `npm run install:local`: passed; verified packaged `@adrouter/cli@0.81.0-beta.21` installed

### Findings / Notes

- Existing `/chain` and `/run-chain` remain bounded compatibility adapters during this wave.

---

## Step E: Desktop Agent follow-on

### Status

`done`

### Objective

Upgrade the independent Agent to the accepted Pi version and port cache/delegation behavior through
its native Router, utility-process, approval, and task abstractions.

### Tasks

- [x] Preserve and reconcile the Agent's existing beta.17/node-gyp working changes.
- [x] Upgrade exact Pi dependencies to 0.84.1 and update lock/override/physical-resolution policy.
- [x] Port cache modes natively without loading the CLI extension or changing Router framing.
- [x] Extend existing depth-one delegation with native status, follow-up/resume, and cancellation.
- [x] Keep declarative bundles Markdown-only and prove optional upstream packages have no authority.

### Relevant Files

- `../adrouterAgent/package.json`
- `../adrouterAgent/src/runtime/`
- `../adrouterAgent/src/main/`
- `../adrouterAgent/tests/`

### Expected Changes

- modify: exact dependencies/lock, dependency policy, runtime/provider/session/delegation code, tests
- create: native cache fixtures/settings and bounded delegation lifecycle coverage if missing
- delete: no user-owned beta.17 work or executable-extension boundary

### Do Not Modify

- `../adrouterAgent/PLAN.md` active release/security plan
- safeStorage identity, sandbox/approval boundary, normal one-task capacity, or Router wire contract
- unrelated renderer/release/channel behavior

### Commands

```bash
npm run check
npm run verify:release-readiness
npm run test:e2e
```

### Acceptance Criteria

- [x] Existing beta.17/node-gyp changes remain intact and attributable.
- [x] Pi dependencies resolve exactly to 0.84.1 with reviewed security overrides.
- [x] Cache modes and delegation limits match the accepted CLI policy without executable plugins.
- [x] Source, integration, launcher, and packaged security tests pass under Node.js 25.9.0.

### Validation Results

- `npm run check`: passed under Node.js 25.9.0 (162 unit tests, 13 integration tests, 47
  launcher/release tests, plus source/public/workflow checks)
- `npm run verify:release-readiness`: passed, including the exact launcher tarball allowlist
- `npm run test:e2e`: passed (2 packaged Electron tests)
- `npm run audit:build`: passed; the only high-severity nodes are the repository's reviewed,
  dev-only Forge advisory chain
- source parity: passed for 76 reviewed product files

### Findings / Notes

- The existing exact node-gyp 12.3.0 pin and associated provenance remained intact; the native broker
  rebuilt under Node.js 25.9.0 during the full gate.
- Pi auth/model authority remains app-owned through a network-disabled `ModelRuntime`; optional Pi
  client/protocol packages remain transitive-only and are not imported by the Agent session.

---

## Step F: Final verification and cleanup

### Status

`done`

### Objective

Prove the complete local CLI and Agent implementation, review all diffs, and leave publication as a
separately authorized action.

### Tasks

- [x] Run full CLI checks, production-faithful local install, and packaged inventory verification.
- [x] Run full Agent checks, release-readiness, packaged E2E, and relevant native distribution
      verification.
- [x] Review both repository diffs for unrelated changes, stale comments, temporary artifacts, and
      provenance drift.
- [x] Update developer documentation and record skipped manual/live/cross-platform acceptance.
- [x] Record residual risks and next-wave upstream releases without moving any public channel.

### Relevant Files

- `README.md`, `RELEASE.md`, `SECURITY.md`, upstream/bundle documentation
- `../adrouterAgent/README.md`, `../adrouterAgent/RELEASE.md`, `../adrouterAgent/SOURCE_PROVENANCE.md`

### Expected Changes

- modify: documentation and this plan with actual validation results
- create/delete: only intentional source artifacts already listed in prior steps

### Do Not Modify

- npm/GitHub tags, dist-tags, releases, protected environments, or hosted configuration
- ignored credentials or `.protected/`

### Commands

```bash
npm run check
npm run install:local
git diff --check
git status --short --branch
```

### Acceptance Criteria

- [x] Both repositories pass their full authorized local gates.
- [x] Installed/package artifacts match source, manifests, locks, provenance, and licenses.
- [x] Default cache and subagent behavior is bounded, reversible, and secret/sponsor-safe.
- [x] No unintended files or publication/deployment changes remain.

### Validation Results

- CLI `npm run check`: passed
- CLI `npm run install:local`: passed; installed verified packaged
  `@adrouter/cli@0.81.0-beta.21`
- CLI `npm run upstream:audit`: passed; frozen Pi/cache/subagent targets remain current
- Agent `npm run check`: passed under Node.js 25.9.0
- Agent `npm run verify:release-readiness`: passed
- Agent `npm run audit:build`: passed under the bounded dev-only advisory policy
- Agent packaged E2E/native verification: passed (2 Electron tests; native broker rebuilt with
  node-gyp 12.3.0 under Node.js 25.9.0)
- `git diff --check`: passed in both repositories

### Findings / Notes

- Physical Windows and live hosted cache canaries remain manual acceptance unless separately
  authorized and available.

---

## Step G: Publish the Pi follow-on candidate

### Status

`complete`

### Objective

Apply the completed upstream work to the exact beta.22 security source and publish it as immutable
beta.23 under npm `candidate` without moving public `beta` or `latest`.

### Tasks

- [x] Preserve the upstream implementation as an independent commit.
- [x] Reapply it to exact protected beta.22 source and prepare unused beta.23 release metadata.
- [x] Pass clean Node.js 22.19 release gates, protected six-platform CI, tagged draft verification,
      and exact npm candidate publication.
- [x] Stop after candidate publication; do not move npm `beta` or `latest` without a separately
      verified live Windows run and explicit authorization.

### Relevant Files

- `package.json`, workspace manifests, lockfile, shrinkwrap, and `release-manifest.json`
- `.github/workflows/`, changelogs, upstream provenance, and release documentation

### Expected Changes

- modify: next-beta release identity, changelogs, release evidence, and this plan
- create: immutable tag, protected draft release, and exact npm candidate through workflows
- delete: no source, prior artifact, tag, or public channel

### Do Not Modify

- hosted Router/WebUI contracts or state
- npm `beta`/`latest`, which remain on beta.20
- any immutable prior version, tag, or release asset

### Commands

```bash
npm ci --ignore-scripts
npm run build
npm run check
npm run test:isolated
npm run check:release-readiness
node scripts/ci-package-smoke.mjs
```

### Acceptance Criteria

- [x] Beta.22 remains the immutable security candidate baseline used by beta.23 source.
- [x] Beta.23 resolves to one exact source commit and recorded tarball integrity.
- [x] Public `beta`/`latest` remain beta.20 while beta.23 is only `candidate`.
- [ ] Hosted auth, sponsor isolation, cache modes, and bounded subagent behavior remain pending
      exact-artifact candidate acceptance.

### Validation Results

- local Node.js 22.19 `npm run check`: passed
- local Node.js 22.19 `npm run check:release-readiness`: passed
- protected six-platform matrix and CodeQL: passed; run `31607564741`
- tag staging/attestation: passed; run `31610813875`
- candidate publication: passed on resumable attempt 2; run `31611419261`
- npm `candidate=0.81.0-beta.23`; exact integrity
  `sha512-cQz2hS9nPVPM5PJQbvyDVkOA2JURNMtBjfW464nt8thzdgv6gBDczwt4x/FVgU7iufodXGzEzDwGpHBVlcs3hw==`
- full real-device installation-auth/revoke acceptance: not run

### Findings / Notes

- The first publication attempt succeeded before npm's read path exposed the package. The workflow
  resumed only after exact bytes and the `candidate` alias matched; no version or tag was replaced.
- Public `beta`/`latest` remain beta.20. Candidate finalization was not dispatched.

---

## Step H: Final verification and cleanup

### Status

`complete`

### Objective

Record exact local, candidate, public, and hosted identities and leave the release checkout clean.

### Tasks

- [x] Re-query npm and the completed GitHub workflow/tag evidence.
- [x] Record source SHA, tag, workflow runs, integrity, acceptance limits, and rollback point.
- [x] Review the release-input diff/status; candidate source was clean before the later
      session-audit-only `AGENTS.md` and `PLAN.md` updates.

### Acceptance Criteria

- [x] No unrecorded channel, hosted service, database, traffic, or release mutation occurred.
- [x] Any post-tag defect is assigned a higher immutable beta rather than replacing an artifact.

### Validation Results

- npm aliases and candidate integrity were reverified on 2026-08-13 and remain unchanged.
- Candidate-source status was clean at release handoff; the current working-tree changes are only
  the intentional governance/audit updates to `AGENTS.md` and `PLAN.md`.

---

## Follow-up Work

- Evaluate pi-web-access and BTW through the same upstream lock/audit/patch workflow.
- Consider a versioned Router cache-hint contract only after separate platform design and tests.
- Evaluate missions, schedules, managed worktrees, or richer desktop delegation as independent
  security/product changes.
- Triage any Pi or extension releases newer than this wave's frozen versions.

## Decision Log

| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-08-11 | Freeze Pi 0.84.1, cache optimizer 2.8.2, and subagents 0.45.2. | Exact inputs keep a large cross-repository upgrade reviewable and reproducible. | Newer releases enter a later wave. |
| 2026-08-11 | Keep hosted Router framing unchanged. | The current API reports authoritative cache usage but has no cache-hint contract. | Cache optimization is stats-first and prompt-prefix-only. |
| 2026-08-11 | Expose a safe subagent subset. | New upstream automation surfaces exceed current AdRouter trust and approval boundaries. | Structured, depth-one delegation ships without missions, schedules, scripts, or worktrees. |
| 2026-08-11 | Port desktop behavior natively after CLI qualification. | The Agent does not execute arbitrary Pi extensions and owns separate release inputs. | Agent uses exact Pi 0.84.1 dependencies plus native cache and task-delegation abstractions. |
| 2026-08-11 | Finalize security releases before publishing follow-on candidates. | The security-only identities must remain reviewable and accepted before the broader upstream wave. | Beta.21/beta.17 become public first; the next CLI/Agent versions stop at `candidate`. |
| 2026-08-13 | Complete beta.23 candidate publication without finalization. | Exact protected workflow and registry evidence passed, including the integrity-gated propagation retry. | Beta.23 is on `candidate`; beta.20 remains on `beta`/`latest`, with broader real-device acceptance still open. |


---

## Streaming-fix candidate beta.24 — verified 2026-09-10

### Status
`complete` (candidate only; public-channel finalization pending)

- Published only bundled `@adrouter/cli@0.81.0-beta.24` to `candidate`; beta/latest remain `0.81.0-beta.20`. GitHub release remains draft under the candidate-only workflow.
- Immutable tag `v0.81.0-beta.24`, source `9d91eb88719e36739457aa15bc342abbc3b7f4b8`, original repository `adrouter/adrouterCLI`; PR #70 merged and reviewed tree parity verified.
- Clean release input: isolated `../r/cli` checkout, detached at that source. Canonical dirty source/governance/untracked work retained; no backup pushes.
- Local Node 24.16.0 (supported >=22.19) install/build/check/readiness, focused streaming regressions, full isolated repository tests and bundled-package verifier passed. Fixed-width existing test initially wrapped an unusually long checkout path; moving only the isolated clone to the shorter path resolved it without code/test changes.
- Merged six-platform CI: https://github.com/adrouter/adrouterCLI/actions/runs/34487030075
- Staged inventory/checksum/SBOM/attestations: https://github.com/adrouter/adrouterCLI/actions/runs/34490746451
- Candidate publication: https://github.com/adrouter/adrouterCLI/actions/runs/34494613086 — attempt 3 succeeded after integrity-verified recovery. Attempt 1 failed `npm whoami` with 401; operator replaced the protected token. Attempt 2 published successfully but immediate registry verification hit propagation E404. Before resuming, candidate alias and downloaded integrity matched the staged immutable artifact; the publisher's existing-publication path skipped republishing.
- Local anonymous `node scripts/verify-registry-install.mjs` passed with exact registry tarball installation, bundled runtime/resources, both commands and isolated state. Final-channel-only six-platform registry matrix was not dispatched; merged-source six-platform package checks passed.
- npm integrity: `sha512-9KC28PJX0lPidyaCsPXYJ6bOF452Ze0mYEKEQ3LcOgEKLSmP5FwCU0VtNQ95Vx5fU8BDjV95gp5i7HwLLolT3w==`
- Published tarball SHA256: `6d8cbcb0602beb69cb8c6f401d423bf51c464e358605750facfc301798ef5d74`. Downloaded bytes independently matched the staged manifest's integrity and size. Draft verifier checked all six assets and five required attestations.
- Fixes: incomplete-stream handling and bounded cancellation cleanup. Historical one-minute Desktop stall remains unverified. No dependency upgrades, output-default increase, Router deployment or final-channel promotion.

### Remaining acceptance
Exact-candidate live authentication/real-user acceptance and separately authorized beta/latest finalization remain pending. No immutable version, tag or artifact was overwritten.


---

# Plan: Effective output defaults — 11 September 2026

## Goal
Raise applicable effective defaults to 16,384 while preserving account caps and model maxima.

## Context
Verify omitted request limits delegate to Router and explicit limits/model maxima remain intact; preserve existing streaming edits.
Source work is authorized before existing candidate promotion; published versions remain immutable.

## Research Summary
Current source distinguishes request defaults from model maxima. Supabase changelog and migration documentation checked 2026-09-11: no applicable breaking change for ALTER COLUMN SET DEFAULT.

## Constraints
Preserve unrelated edits, existing account rows, explicit request limits, pricing, and provider maxima. No new dependencies or live mutations.

## Out of Scope
Candidate promotion, new provider support, live account migration, hosted deployment and successor publication.

## Reversibility
Keep edits scoped. New-account migration changes only the column default; reverting it requires a new migration, not historical edits.

## Step A: Implement and cover the default behavior

### Status
`done`

### Tasks
- [x] Implement or verify this repository's default path.
- [x] Add focused boundary and recovery coverage; preserve existing tests.
- [x] Update current documentation and generated metadata through existing tooling.

### Acceptance Criteria
- [x] Omitted limits fit permitted caps; explicit limits retain validation.
- [x] Model maxima and existing account policies remain unchanged.

### Validation Results
Local checks passed; commands, counts and unavailable database checks are recorded in implementation and rollout evidence (workspace-only reference: `../../router/docs/output-defaults-16384.md`). No hosted inference or deployment was performed.

## Step B: Final verification and cleanup

### Status
`done`

### Tasks
- [x] Run owning-project checks and review the final diff.
- [x] Record source SHAs, test results, limitations and deployment/account-policy follow-up.

### Acceptance Criteria
- [x] Checks pass or unavailable checks have documented blockers.
- [x] Local changes are clearly distinguished from published/deployed state.

### Validation Results
Local checks passed; commands, counts and unavailable database checks are recorded in implementation and rollout evidence (workspace-only reference: `../../router/docs/output-defaults-16384.md`). No hosted inference or deployment was performed.

### Findings / Notes

Source changes are complete and locally checked. Database pgTAP/lint/advisor/local-service execution remains unavailable because Docker is stopped and no PostgreSQL server is installed. The pre-existing discarded-provider-finish-reason gap prevents claiming token-truncation acceptance. OpenCode sends an explicit limit, so existing lower-cap accounts need a smaller call/provider setting or separately approved policy updates. These are rollout limitations, not evidence that the new defaults shipped.

## Follow-up Work
Separate approval for live migration/deployment and successor publication. Existing-account update must use explicit selection, aggregate impact review, audit and verification; it is not part of the default-only migration.

## Decision Log

| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-09-11 | 16,384 supersedes 8,192; fit omitted values to account/model/platform caps | Operator-approved plan | Existing lower caps continue to work without account updates |
| 2026-09-11 | Source preparation precedes candidate promotions | Operator instruction | No changes to published versions or channels |


# Plan: Truncation safety and Fly rollout — 11 September 2026

## Goal and constraints
Preserve completion reasons, block incomplete tools, retain settled usage and partial text, then deploy the exact clean Router commit to existing Fly staging. No Pages push/deploy, hosted migration/account update, client publication, or automatic paid replay. Preserve unrelated changes.

## Step A: Completion handling
### Status
`done`
- [x] Implement provider completion validation and backward-compatible terminal errors.
- [x] Verify local client recovery and usage retention.

## Step B: Final verification and cleanup
### Status
`review`
- [ ] Run owning-project checks and synthetic truncation/accounting tests.
- [ ] Review diff, update evidence, and record remaining gaps.
- [ ] Router only: clean exact-SHA deployment, preserve Pages, verify health and reconcile budget before canaries.

## Decision Log
| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-09-11 | Fix truncation before existing Fly API rollout | Explicit operator request | Database migration and client publication remain pending |

Validation and deployment preflight: Router evidence (workspace-only reference: `../../router/docs/output-defaults-16384.md`). Local suites passed. Hosted deployment is pending local database bootstrap/reset permission and remaining acceptance gates; no live requests made.


## Four-model completion — 12 September 2026

### Status

`in_progress`

The current instruction supersedes earlier five-model scope and temporary-budget holds. Preserve **before new models, still there. adrouterAgent UI fixes + new output limit** and all unfinished work above. Selected additions are GLM-5.3, Kimi K3, Qwen 3.8 Max and Qwen 3.8 Flash.

- [ ] Reconcile candidate source with preserved pending changes, including Desktop appearance/timeline/approvals and output limits.
- [ ] Audit owner-only daily/monthly caps at least US$5, preserving higher limits and all other accounts/platform limits. Enforce US$1 aggregate test exposure including earlier tests and unresolved liabilities.
- [ ] Reject GLM Flash before reservation; retain historical accounting/database compatibility. Include recovery liabilities in spending summaries without concurrency occupancy.
- [ ] Complete four-model streaming/thinking/tools/accounting/cancellation/forced-truncation acceptance. Qualify Kimi image upload/follow-up/reload before enabling vision.
- [ ] Regenerate canonical client contracts; implement memory-only Kimi tool continuation, reset/exclusion coverage, and authenticated transport acceptance on every client.
- [ ] Verify CLI/Desktop 60-second presence gating including first-response wait, fresh Enter, repeated timing, continued stream reception, blocked execution and separate permission approval; headless attention-required status.
- [ ] After functional acceptance update desktop/mobile landing lists; run owning checks, contract compatibility and packaged Desktop acceptance.
- [ ] Prepare rollback artifacts; deploy clean exact-commit API before WebUI; publish immutable successor candidates only after checks and authenticated acceptance. Keep beta/latest separate.

### Validation Results

Implementation underway. No new hosted inference, account mutation, deployment or publication has occurred in this continuation. Pending checks are not passes.

### Local implementation receipt — four-model continuation

Partial implementation only; rollout remains `in_progress`. Router now omits GLM Flash from runnable catalogs and WebUI fallback. Historical types, pricing and database compatibility remain intact. Regression coverage rejects GLM Flash before a database connection/reservation. Account summaries include recovery liabilities in held spending, with concurrency unchanged; WebUI labels these outstanding reservations.

Router, CLI and Desktop catalog digest: `sha256:6c48a4b0142dbc8a19813799c146a6bb5f828ebc3240471ce94313091b805bf3`. CLI/Desktop generators retain all twelve catalog descriptors; the nine tool-capable models are selectable, while Kimi tools remain gated. CLI documentation now distinguishes the 16,384 default from maximum limits.

Validation: Router backend typecheck/full test suite/build passed; WebUI typecheck, 88 tests, 10 hosted-build checks and build passed (three wallet tests rerun after the label change). CLI full `npm run check` passed. Desktop typecheck, 174 unit tests, 13 integration tests, catalog and public checks passed; source parity regenerated through its script. Earlier stale expectations, formatting and plan-path failures were corrected. The aggregate Desktop npm check invoked Node 24 through npm's script PATH, so it is not a valid pinned-Node full-check receipt; direct unit/integration tests were rerun with the shell's Node 25.9.0. Packaged/native acceptance and launcher verification remain pending.

Candidate tags were fetched read-only: CLI beta.24 and OpenCode beta.11 exist on github-legacy, not current origin; Desktop beta.21 exists on origin. Desktop timeline/provider/bounded-response source matches beta.21; CLI retains its additional incomplete-tool rejection. Release metadata reconciliation and complete combined-baseline approval/appearance/output acceptance remain pending. No tags were changed.

No new paid inference (US$0 additional), account mutation, deployment, release commit, publication or promotion occurred. Prior spending/liabilities were not re-queried. Owner permanent US$5 caps, Kimi vision/tool continuation and persistence exclusions, presence prompts, OpenCode catalog/runtime extension, authenticated four-model acceptance, landing updates, packaged Desktop acceptance and immutable successor releases remain unfinished. No authentication/provider checks were attempted in this continuation and none are marked passed.


### Continued implementation and hosted owner receipt — 12 September 2026

Owner permanent daily/monthly limits are verified at 5,000,000 microusd with audit action `raise_owner_permanent_allowance_20260912`; other two accounts remain 500,000 daily/5,000,000 monthly, output 4,096/concurrency 1. Owner output 16,384/concurrency 1 preserved. Applied from clean Router commit `3f8614d`; no API/Pages deployment. The SQL preserves higher limits and changes only the unique owner.

Live Kimi vision provider qualification passed with finish `stop`, 132 input/46 output tokens and 1,086 microusd settled cost. Source is committed at `295942e` after adding a conservative aggregate ceiling and stdin argument handling. Initial SSH attempt found an idle VM; a readiness request woke it. The next attempt failed argument validation before inference; the corrected invocation passed. These were operational failures, not provider authentication failures. Browser upload/follow-up/reload are still pending and vision remains gated.

Conservative exposure after the test: all ledger usage 367,852 plus all recovery holds 22,369 plus the earlier uncorrelated 40,000 allocation = 430,221 microusd, below the 1,000,000 test ceiling. No active reservations; no liabilities released. New-model-specific cumulative exposure is 28,509 microusd using the prior recorded 27,423 total.

CLI/Desktop now have working-source memory-only Kimi continuation using nonserialized object-keyed state. Reasoning is excluded from emitted messages/events and injected only into outgoing context; model changes, reloads and incomplete streams discard continuation. Desktop transport regression and helper tests pass (14 tests); CLI provider/helper suite passes (38 tests). Tool capability stays gated pending live tool-round qualification and session-lifecycle acceptance.

OpenCode now generates its catalog from Router, retaining all twelve descriptors and selecting the nine tool-qualified models. It remains text/tool-only. Catalog check, typecheck, lint, 50 tests and build passed; Kimi host-lifecycle continuation remains unfinished.

Presence prompts, full authenticated cross-client matrix, browser vision acceptance, complete candidate-baseline reconciliation, packaged Desktop acceptance and successor publication remain unfinished. No candidate tags, beta/latest aliases, existing artifacts or serving API/Pages were changed. Do not publish this partial state.

## Public beta.27 promotion receipt — 14 September 2026

`@adrouter/cli@0.81.0-beta.27` is the approved public prerelease. Immutable tag `v0.81.0-beta.27` identifies source commit `f1deaf3ac85eceb5ad9912629faf2daa68ea2e96`; candidate PR #75 merged to active `adrouter/adrouterCLI` as `7e5b4215990ae9bb14cc6dad3d7807bc53924c4d`.

The exact-tag finalization workflow passed at https://github.com/adrouter/adrouterCLI/actions/runs/34795875083, including source checks, six anonymous platform-install lanes, npm finalization and GitHub prerelease publication. npm `beta` and `latest` both resolve to beta.27, `candidate` is absent, and integrity is `sha512-g4l3CzLSQkrWOTiEv/8o4/Aa8D7QsB7mYem9WRt6bAdm72wAnx391VQzcBsjQsL6q4/eQ59Y03Nl6eJ589QCmQ==`. Superseded beta.20 is deprecated with the release-required message.

The public GitHub release includes the exact npm tarball, SBOM, bundled-sources record, notices, checksum inventory, npm artifact manifest and `authentication-acceptance.json`. The recorded CLI acceptance covers macOS 15.7.9 arm64 and Windows 11 x64 with Node.js 25.9.0 and file-protected installation state.
