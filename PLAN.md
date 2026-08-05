# Plan: Router-synchronized per-model input/output limits

## Goal

Make AdRouterCLI vendor the exact committed Router catalog, expose the approved context/input/output
tuple for every hosted model, and use the selected model's limits for request construction and
preflight compaction without weakening custom-endpoint compatibility, streaming safety, or release
discipline.

## Context

- This plan supersedes the prior combined catalog/product-guide/beta.18 plan. Its completed
  implementation and release-preparation history remain in Git history; the current task is the
  explicitly approved limits follow-up.
- The repository is the canonical Node.js 22.19+ npm monorepo. It vendors Router's schema-v1
  artifact at `packages/ai/catalog/adrouter-model-catalog.v1.json` and deterministically generates
  `packages/ai/src/providers/adrouter.models.ts`.
- Catalog validation currently requires all eight models to share `131,072 / 126,976 / 4,096`.
  Generation takes the first descriptor's tuple and publishes one `ADROUTER_HOSTED_LIMITS` object,
  while `adrouter-config.ts` re-exports shared scalar constants.
- Generated `Model.contextWindow` and `Model.maxTokens` already come from each descriptor, so exact
  catalog values can flow through offline listing and generic compaction after the validator and
  generated public interface become model-specific.
- Hosted request construction currently uses one proactive input threshold of 114,688 and clamps
  every explicit `maxTokens` value to one shared 4,096 ceiling. When no explicit output is supplied,
  it intentionally omits `max_output_tokens`, allowing Router's conservative default to apply.
- Agent-session overflow recovery already permits one compact-and-retry only when no response event
  has been consumed. For AdRouter, ad/text/thinking/tool/settlement/done events count as consumed;
  a partially consumed paid stream is never replayed.
- The user supplied and approved these exact tuples. They must be validated by model ID rather than
  derived from a common formula:

| Model | Context | Max input | Max output |
| --- | ---: | ---: | ---: |
| `deepseek-v4-flash` | 1,048,576 | 917,504 | 65,536 |
| `deepseek-v4-pro` | 1,048,576 | 851,968 | 131,072 |
| `mimo-v2.5` | 1,048,576 | 917,504 | 65,536 |
| `mimo-v2.5-pro` | 1,048,576 | 851,968 | 131,072 |
| `agnes-2.0-flash` | 524,288 | 458,752 | 65,536 |
| `agnes-2.5-flash` | 524,288 | 458,752 | 65,536 |
| `agnes-2.5-pro` | 1,048,576 | 851,968 | 131,072 |
| `agnes-2.5-pro-alpha` | 1,048,576 | 786,432 | 196,608 |

- For a canonical model on an official hosted origin, local proactive input checking must use
  `min(max_input_tokens, context_window - 16,384)` for that selected model.
- For a custom/loopback endpoint or noncanonical model, continue using the supplied `Model`
  metadata and the established custom auth/URL path; do not impose the official hosted tuple map.
- The checkout is on the beta.18 release branch and its package manifests name beta.18. Tagging,
  candidate publication, channel movement, and GitHub release work remain blocked until the new
  Router artifact is committed, vendored, and all source/package gates are rerun. This plan does
  not authorize any release mutation.

## Research Summary

- `packages/ai/scripts/adrouter-catalog.ts` owns exact catalog validation and generated source. It
  currently hard-codes the common tuple and emits the misleading scalar
  `ADROUTER_HOSTED_LIMITS` contract.
- `packages/ai/src/adrouter-config.ts` derives shared context/input/output/preflight constants, and
  `packages/ai/src/api/adrouter.ts` performs hosted input preflight, explicit-output clamping,
  request serialization, response-event counting, and structured error propagation.
- `packages/coding-agent/src/core/agent-session.ts` and the compaction helpers already use the
  selected `Model.contextWindow`; the default reserve is 16,384 tokens and the one-retry safety
  rule is covered by compaction regressions.
- Offline listing and the default model registry consume generated `Model.contextWindow` and
  `Model.maxTokens`, so they should not need an independent handwritten limit table.
- Catalog, docs, installed-runtime, package-policy, and release-readiness scripts already provide
  deterministic offline gates. No new dependency or catalog schema version is required.
- External documentation research is unnecessary: the committed Router artifact produced by the
  companion Router plan and the approved tuple table are authoritative. No third-party API or
  framework behavior is changing.

## Constraints

- Sync only from a clean, committed Router artifact produced by `router/PLAN.md`; record the exact
  Router commit SHA and catalog digest during implementation.
- Keep schema version 1, catalog digest computation, exact model IDs/order, providers, classes,
  names, descriptions, thinking modes/defaults, and zero-price metadata unchanged.
- Validate each tuple explicitly by model ID. Do not calculate one model's values from its class,
  another model, or `context - output`.
- Generate a model-keyed public limits interface. Remove the unreleased shared scalar contract
  instead of preserving an API that falsely implies every hosted model has the same limits.
- Keep `Model.contextWindow` equal to the selected descriptor's `context_window` and
  `Model.maxTokens` equal to its `max_output_tokens`.
- Keep the preflight reserve at 16,384 and use
  `min(max_input_tokens, context_window - 16,384)` only for canonical models on official hosted
  origins.
- Clamp an explicitly requested hosted output to the selected canonical model's maximum. Continue
  omitting `max_output_tokens` when the caller supplies no explicit value so Router's 4,096 default
  remains authoritative.
- On custom/loopback endpoints, use the supplied model's `contextWindow` and `maxTokens`; preserve
  existing custom bearer-key behavior and do not require a canonical hosted descriptor.
- Preserve one compact-and-retry only before any response event. Never replay after an ad, text,
  thinking, tool call, settlement, done, or other content-bearing event is consumed.
- Preserve installation auth, request proof, endpoint selection, structured error branching,
  NDJSON bounds, tool safety, workspace trust, approvals, sponsor isolation, and ads-off behavior.
- Keep the implementation minimal, reviewable, deterministic, offline-capable, and dependency-free.
- Do not change package versions, lockfiles, workflows, release manifests, tags, npm state, GitHub
  releases, or channels as part of this limits implementation.
- Do not add helper branding, hidden metadata, or unrelated administrative sections.

## Out of Scope

- Publishing or staging beta.18, creating/pushing a tag, moving npm dist-tags, editing a GitHub
  release, dispatching protected workflows, or approving protected environments.
- Deploying Router, applying its migration, or changing hosted traffic/configuration.
- Changing official installation auth, custom bearer auth, `/v1/agent/turn`, `/v1/profile`, proof
  fixtures, or URL security policy.
- Changing model IDs, reasoning modes, descriptions, access policy, pricing, default model choice,
  or provider routing.
- Redesigning the terminal UI, sponsor panel, commands, tool approval flows, or unrelated docs.
- Changing generic compaction policy for non-AdRouter providers.
- Updating Desktop Agent or held OpenCode source.
- Adding online model discovery to the CLI; the committed Router artifact remains the offline
  source of truth for this release line.

## Reversibility

- Keep the vendored Router artifact, generated provider module, runtime consumption, and docs/tests
  in reviewable phases aligned with the steps below.
- Regenerate rather than hand-edit `adrouter.models.ts`; reverting the vendored artifact and
  generator commit restores prior generated bytes deterministically.
- Replace the shared scalar exports in one explicit public-interface migration backed by compile
  and package-boundary tests. Do not leave two competing sources of hosted limits.
- Preserve the custom endpoint path and generic model metadata behavior, allowing the official
  per-model branch to be reverted without changing custom configuration storage.
- Preserve the current response-event counter and retry guard until model-specific preflight tests
  prove the replacement path.
- Do not perform a release mutation, so an implementation rollback remains a normal source revert.
- If beta.18 becomes immutable before this work is released, fix forward with a new unused beta;
  never move or overwrite the existing version/tag.

---

## Step A: Vendor and generate the exact Router tuples

### Status

`complete`

### Objective

Synchronize from the committed Router artifact and make catalog validation, generation, and public
metadata model-specific and deterministic.

### Tasks

- [x] Complete and commit the companion Router plan first; require a clean Router worktree and
      capture `git rev-parse HEAD` plus the artifact's `catalog_digest` before copying bytes.
- [x] Sync `packages/ai/catalog/adrouter-model-catalog.v1.json` byte-for-byte from that exact Router
      artifact using the existing sync script; do not hand-edit the vendored JSON.
- [x] Replace shared tuple validation in `adrouter-catalog.ts` with an exact ID-to-tuple table for
      all eight approved rows, retaining strict keys, order, schema, digest, provider/class, and
      thinking validation.
- [x] Add invalid fixtures for swapped tuples, a tuple copied to the wrong ID, changed context,
      changed input/output, non-integers, non-positive values, and values whose input/output exceed
      context.
- [x] Generate `ADROUTER_HOSTED_LIMITS_BY_MODEL`, keyed by canonical model ID, with
      `contextWindowTokens`, `maxInputTokens`, and `maxOutputTokens` for each row.
- [x] Extend `ADROUTER_CATALOG_METADATA` so each model's metadata carries all three limit values
      needed by runtime/docs checks, without duplicating a handwritten table outside the validator.
- [x] Remove `ADROUTER_HOSTED_LIMITS` and the shared scalar limit exports from generated/public
      source; update `packages/ai/src/index.ts` to expose only the model-keyed contract.
- [x] Continue generating each `ADROUTER_MODELS` entry with descriptor-specific
      `contextWindow`/`maxTokens` and leave all non-AdRouter generated catalogs untouched.
- [x] Run generation twice and verify the second run produces no diff.
- [x] Record the Router SHA and resulting catalog digest in this step's findings.

### Relevant Files

- `packages/ai/catalog/adrouter-model-catalog.v1.json`
- `scripts/sync-adrouter-catalog.mjs`
- `scripts/adrouter-catalog.test.mjs`
- `packages/ai/scripts/adrouter-catalog.ts`
- `packages/ai/scripts/generate-models.ts`
- `packages/ai/src/providers/adrouter.models.ts`
- `packages/ai/src/index.ts`
- `packages/ai/test/adrouter.test.ts`
- `PLAN.md`

### Expected Changes

- modify: `packages/ai/catalog/adrouter-model-catalog.v1.json`
- modify: `scripts/adrouter-catalog.test.mjs`
- modify: `packages/ai/scripts/adrouter-catalog.ts`
- modify as required for deterministic rendering: `packages/ai/scripts/generate-models.ts`
- regenerate: `packages/ai/src/providers/adrouter.models.ts`
- modify: `packages/ai/src/index.ts`
- modify: focused catalog/public-export tests

### Do Not Modify

- The vendored JSON by hand
- Non-AdRouter provider catalogs or `models.generated.ts`
- Catalog schema version, digest algorithm, IDs/order, provider/class, thinking, or descriptions
- Dependencies, package versions, lockfiles, release metadata, or workflows

### Commands

```bash
git -C ../../router status --short --branch
git -C ../../router rev-parse HEAD
npm run catalog:sync -- --source ../../router/backend/catalog/model-catalog.v1.json
npm run catalog:generate
npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json
npm test --workspace @adrouter/ai -- test/adrouter.test.ts
```

### Acceptance Criteria

- [x] The vendored file is byte-for-byte equal to the clean committed Router artifact.
- [x] The exact Router SHA and catalog digest are recorded and match the vendored/generated source.
- [x] Validation accepts exactly the eight approved tuples and rejects tuple/ID drift even when a
      fixture recomputes a valid digest.
- [x] Generated model entries expose the exact context/output values and metadata exposes the exact
      context/input/output values for each ID.
- [x] The public generated limit contract is model-keyed; no shared scalar hosted-limit export
      remains.
- [x] Catalog generation is deterministic, offline, and scoped to AdRouter files.
- [x] Focused catalog, generation, and AI export tests pass.
- [x] No dependency, version, release, workflow, or unrelated generated-file change occurs.

### Validation Results

- Router clean-status/SHA checks: passed at
  `d6b32a25e3d20bde5b7b82cb02ac116a1d9ce4e5`
- `npm run catalog:sync -- --source ../../router/backend/catalog/model-catalog.v1.json`: passed
- `npm run catalog:generate`: passed twice with identical generated SHA-256
  `50a70cbe6f8497cb08addbd11f8a41957149466186834d9ef85dff9baaada836`
- `npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json`: passed
- focused `@adrouter/ai` catalog/provider tests: passed, 40/40 across the selected files

### Findings / Notes

- Do not begin this step from an uncommitted Router catalog. The recorded SHA/digest is the
  cross-repository provenance boundary.
- The exact committed Router and vendored catalog digest is
  `sha256:75b5c38f6f037ac2d5105b0e780bf449d00e0c851dcb749232503c3782b32b70`.

---

## Step B: Apply selected-model limits to hosted requests

### Status

`complete`

### Objective

Resolve model-specific limits for official hosted calls, preserve supplied metadata for custom
calls, and serialize explicit output limits safely.

### Tasks

- [x] Add a typed lookup/helper in `adrouter-config.ts` that returns canonical hosted limits by
      model ID without falling back to another model's tuple.
- [x] Change hosted preflight to accept the selected `Model` (or its ID plus metadata) and resolve
      its exact canonical tuple only when the normalized API URL is an official hosted origin.
- [x] Compute the official local preflight threshold as
      `min(maxInputTokens, contextWindowTokens - 16_384)` and include the selected tuple and
      threshold in finite numeric error details.
- [x] Clamp an explicit `options.maxTokens` to the selected canonical model's `maxOutputTokens` for
      official hosted requests.
- [x] Continue omitting `max_output_tokens` when `options.maxTokens` is absent; do not replace
      Router's 4,096 default with the model maximum.
- [x] For a custom/loopback URL, derive applicable context/output behavior from the supplied
      `Model.contextWindow` and `Model.maxTokens`, and preserve current custom endpoint/auth
      semantics even if the ID is unknown or resembles a canonical ID.
- [x] Fail an unknown model on an official hosted origin before network I/O with a bounded
      machine-readable error; never borrow the first model's tuple.
- [x] Keep structured Router error handling keyed on `code` and continue retaining only bounded
      finite numeric details.
- [x] Add table-driven tests for every official model, thresholds at/one-above, explicit output
      below/at/above cap, omitted output, unknown official ID, and custom model metadata.
- [x] Verify request bodies, auth headers, proof generation, ads-off control, and endpoint paths are
      otherwise byte/behavior compatible.

### Relevant Files

- `packages/ai/src/adrouter-config.ts`
- `packages/ai/src/api/adrouter.ts`
- `packages/ai/src/providers/adrouter.models.ts`
- `packages/ai/src/types.ts`
- `packages/ai/test/adrouter.test.ts`
- `packages/ai/test/adrouter-config.test.ts`
- `packages/ai/test/adrouter-auth.test.ts`
- `packages/ai/test/adrouter-installation-auth.test.ts`

### Expected Changes

- modify: `packages/ai/src/adrouter-config.ts`
- modify: `packages/ai/src/api/adrouter.ts`
- modify: hosted request/config tests
- modify only if typing requires it: `packages/ai/src/types.ts`
- no hand edit: `packages/ai/src/providers/adrouter.models.ts` (generated in Step A)

### Do Not Modify

- Official/custom URL precedence or HTTPS/loopback security rules
- Installation authorization, proof format, refresh behavior, or credential storage
- `/v1/agent/turn`, `/v1/profile`, headers, stream framing, or error `code` branching
- Ads-off behavior, sponsor metadata isolation, or tool/message transformation
- Generic non-AdRouter API implementations

### Commands

```bash
npm test --workspace @adrouter/ai -- test/adrouter.test.ts test/adrouter-config.test.ts test/adrouter-auth.test.ts test/adrouter-installation-auth.test.ts
npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json
npm run check:ts-imports
```

### Acceptance Criteria

- [x] Every official hosted request uses the selected canonical model's exact tuple.
- [x] Official preflight uses `min(max_input_tokens, context_window - 16,384)` and reports that
      model's tuple in bounded numeric details.
- [x] Explicit hosted output is capped by the selected model; omitted output remains omitted.
- [x] Unknown official model IDs fail locally without inheriting an unrelated tuple.
- [x] Custom/loopback requests continue using supplied model metadata and supported bearer auth.
- [x] Request proof, headers, paths, streaming, ads-off, tools, and error semantics do not drift.
- [x] Focused AI/auth/config tests and catalog checks pass.

### Validation Results

- focused `@adrouter/ai` provider/config/auth/installation-auth tests: passed, 40/40
- `npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json`: passed
- `npm run check:ts-imports`: passed

### Findings / Notes

- The official-hosted decision must use the normalized resolved API URL, not merely the provider
  name or model ID, so custom endpoints retain their explicit compatibility boundary.
- Official calls reject an unknown routed ID locally with `unknown_model`; custom/loopback calls
  preserve validated supplied `contextWindow` and `maxTokens` values.

---

## Step C: Keep compaction model-aware and replay-safe

### Status

`complete`

### Objective

Propagate the larger generated context windows through existing compaction behavior and preserve a
single safe compact-and-retry only before any AdRouter response event is consumed.

### Tasks

- [x] Verify generic threshold/branch compaction reads the currently selected generated
      `Model.contextWindow` and does not retain a 131,072 AdRouter special case.
- [x] Keep the default compaction reserve at 16,384 and do not change non-AdRouter compaction
      settings or user overrides.
- [x] Route local official-hosted `input_limit_exceeded` errors through the existing overflow
      recovery path so one compact-and-retry is possible before a response starts.
- [x] Preserve the existing response-event counter and ensure ad, text, thinking, tool call,
      settlement, done, and any content-bearing final event prevent automatic replay.
- [x] Preserve the guard that stops after one failed compact-and-retry and emits actionable manual
      `/compact` guidance.
- [x] Add parameterized compaction tests using the 524,288 and 1,048,576 context groups and each
      distinct max-input threshold.
- [x] Test local preflight failure before events, Router limit failure before events, a failure after
      the initial ad, successful output over a threshold, and a second overflow after recovery.
- [x] Confirm compaction summaries, tools, and retained messages never contain sponsor or settlement
      metadata.
- [x] Modify generic compaction source only if the tests expose a real shared-limit assumption;
      otherwise keep this step test-only outside the AI request changes.

### Relevant Files

- `packages/coding-agent/src/core/agent-session.ts`
- `packages/coding-agent/src/core/compaction/compaction.ts`
- `packages/coding-agent/src/core/compaction/branch-summarization.ts`
- `packages/coding-agent/test/suite/agent-session-compaction.test.ts`
- `packages/coding-agent/test/agent-session-compaction.test.ts`
- `packages/coding-agent/test/agent-session-auto-compaction-queue.test.ts`
- `packages/ai/src/api/adrouter.ts`
- `packages/ai/test/adrouter.test.ts`

### Expected Changes

- modify: AdRouter-specific compaction/preflight regression tests
- modify only if tests expose a shared-limit defect: generic compaction or agent-session source
- no change expected: default 16,384 reserve or non-AdRouter behavior

### Do Not Modify

- The one-retry maximum
- The no-replay-after-response-event rule
- User compaction settings or non-AdRouter thresholds
- Session format, compaction entry format, sponsor panel state, or tool context
- Retry policy for transport/provider errors unrelated to context overflow

### Commands

```bash
npm test --workspace @adrouter/ai -- test/adrouter.test.ts
npm test --workspace @adrouter/cli -- test/suite/agent-session-compaction.test.ts test/agent-session-compaction.test.ts test/agent-session-auto-compaction-queue.test.ts
```

### Acceptance Criteria

- [x] Compaction uses the selected model's generated 524,288 or 1,048,576 context window.
- [x] Official local preflight uses every distinct selected-model maximum input correctly.
- [x] Exactly one compact-and-retry can occur when zero response events were consumed.
- [x] No automatic retry occurs after an ad or any other response/content event.
- [x] A second overflow produces bounded manual guidance instead of another replay.
- [x] Custom models and non-AdRouter providers retain their existing compaction behavior.
- [x] Sponsor/settlement metadata remains outside model, tool, and compacted context.
- [x] Focused AI and coding-agent compaction suites pass.

### Validation Results

- `npm test --workspace @adrouter/ai -- test/adrouter.test.ts`: passed
- focused `@adrouter/cli` registry/SDK/compaction tests: passed, 32 passed and five intentional
  credential-dependent skips

### Findings / Notes

- Generic compaction already consumes `Model.contextWindow`; expected production changes should be
  concentrated in generated metadata and AdRouter preflight unless tests prove otherwise.
- No generic compaction production source change was required. Existing one-retry and
  response-event guards passed with the generated 524,288 and 1,048,576 context groups.

---

## Step D: Update listings, documentation, and packaged-contract checks

### Status

`complete`

### Objective

Make user/developer-facing model information and installed-package verification derive from the
vendored exact tuples, with no stale shared-limit prose or hand-maintained table.

### Tasks

- [x] Verify `adrouter --offline --list-models adrouter` displays all eight models in canonical
      order with each generated context window and maximum output value.
- [x] Update `docs/about.md`, architecture, usage/configuration, troubleshooting, and AI package
      documentation wherever they state the old shared `131072 / 126976 / 4096` contract.
- [x] Generate or validate documentation model tables from the vendored artifact so IDs, order,
      descriptions, thinking modes, and all three limit values cannot drift silently.
- [x] Update `scripts/check-docs.mjs` to assert the exact per-model tuples and reject a stale shared
      limit claim.
- [x] Update model-registry tests to assert generated `contextWindow` and `maxTokens` for every ID
      while keeping malicious `models.json`/custom registry inputs unable to alter official models.
- [x] Update installed-runtime verification to check the model-keyed export, offline listing, and
      request construction from the built package rather than source-only imports.
- [x] Add an unreleased changelog note describing the model-specific limits and the intentional
      replacement of shared scalar limit exports; do not alter historical release entries.
- [x] Run release-readiness only as a non-publishing package validation and confirm package
      allowlists include the updated catalog/generated/docs source as expected.
- [x] Confirm no docs suggest that larger model maxima change Router's 4,096 omitted-output/account
      default or bypass account policy.

### Relevant Files

- `packages/coding-agent/src/cli/list-models.ts`
- `packages/coding-agent/src/core/model-registry.ts`
- `packages/coding-agent/test/model-registry.test.ts`
- `packages/coding-agent/test/sdk-model-registry.test.ts`
- `docs/about.md`
- `docs/architecture.md`
- `docs/usage.md`
- `docs/configuration.md`
- `docs/troubleshooting.md`
- `packages/ai/docs/README.md`
- `packages/ai/docs/CHANGELOG.md`
- `packages/coding-agent/docs/CHANGELOG.md`
- `scripts/check-docs.mjs`
- `scripts/verify-installed-runtime.mjs`
- `scripts/check-release-readiness.mjs`

### Expected Changes

- modify only if needed for generated display: offline list/model registry source
- modify: model registry/listing tests
- modify: documentation that states or tabulates hosted limits
- modify: documentation and installed-runtime validation scripts
- modify: unreleased changelog sections only

### Do Not Modify

- Historical changelog/release entries
- Product branding, terminal layout, sponsor panel, auth instructions, or unrelated docs
- Models for non-AdRouter providers
- Package versions, lockfiles, shrinkwrap versions, release manifest, workflows, tags, or channels

### Commands

```bash
npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json
npm run check:docs
npm test --workspace @adrouter/cli -- test/model-registry.test.ts test/sdk-model-registry.test.ts
npm run build
node scripts/verify-installed-runtime.mjs
npm run check:release-readiness
```

### Acceptance Criteria

- [x] Offline listing, generated registry, docs, and installed package agree with all eight exact
      tuples and the recorded catalog digest.
- [x] Documentation clearly distinguishes model maxima from Router's 4,096 omitted-output/account
      default.
- [x] No shared-limit public interface or stale `131072 / 126976 / 4096` hosted claim remains in
      current source/docs/tests.
- [x] Official catalog immutability and custom endpoint behavior remain accurately documented.
- [x] Installed-runtime checks exercise built/package exports rather than only source imports.
- [x] Documentation, registry, package, and release-readiness checks pass without publishing.
- [x] No historical release record, package version, workflow, tag, or channel changes.

### Validation Results

- `npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json`: passed
- `npm run check:docs`: passed across 98 Markdown files
- focused `@adrouter/cli` model-registry tests: passed after the required AI workspace build
- `npm run build`: passed
- `node scripts/ci-package-smoke.mjs`: passed from the staged tarball and exercised installed-runtime
  checks, exact offline listing, omitted/explicit output behavior, profiles, `/reload`, and `/new`
- `npm run check:release-readiness`: passed

### Findings / Notes

- Building can create ignored `dist/` output. It must not be hand-edited or included in the source
  diff; package verification must build it through documented scripts.
- Direct execution of `verify-installed-runtime.mjs` only defines the verifier; the documented
  package smoke invokes it against the extracted and installed staged package.

---

## Step E: Final verification and cleanup

### Status

`complete`

### Objective

Prove source, generated catalog, runtime, compaction, docs, and installed package agree with the
exact committed Router artifact, then stop with beta.18 release operations explicitly blocked.

### Tasks

- [x] Reconfirm the Router worktree is clean at the recorded SHA and its catalog bytes/digest match
      the vendored CLI artifact.
- [x] Run catalog sync/check and generation twice; confirm the final generation and sync checks are
      non-writing.
- [x] Run focused AI/model/compaction suites, then the normal `npm run check` and isolated test gate
      under Node.js 22.19+.
- [x] Build and run installed-runtime/package verification, including offline model listing and
      explicit/omitted request-output behavior.
- [x] Run release-readiness as a read-only packaging gate only; do not version, publish, tag,
      dispatch a workflow, or modify remote state.
- [x] Search current source/docs/tests for the retired shared limit exports and stale shared tuple;
      distinguish legitimate historical/non-AdRouter fixture values before changing anything.
- [x] Remove temporary debugging code, unused imports, stale comments, accidental build output,
      and unrelated generated diffs.
- [x] Review `git diff --check`, `git diff --stat`, full diff, and package allowlists for unrelated
      changes, secrets, sponsor-data leakage, release metadata drift, or custom/auth regressions.
- [x] Record all validation results, the exact Router SHA, and catalog digest in this plan.
- [x] Leave beta.18 tag/stage/publish/promote/finalize work blocked for a separately authorized
      release continuation after this source is committed and requalified.

### Relevant Files

- All files changed in Steps A-D
- `packages/ai/catalog/adrouter-model-catalog.v1.json`
- `packages/ai/src/providers/adrouter.models.ts`
- `PLAN.md`

### Expected Changes

- modify: only files required by Steps A-D and plan status/findings updates
- no change: dependencies, versions, lockfiles, shrinkwrap versions, release manifest, workflows,
  tags, public channels, or remote state

### Do Not Modify

- Ignored credentials, installation state, environment files, browser sessions, or private release
  material
- Router source from the CLI repository; synchronization is read-only from Router into the vendor
  artifact
- npm/GitHub state, tags, dist-tags, protected workflows, or release visibility
- Desktop Agent, OpenCode, historical CLI worktree, or unrelated packages/providers
- Generated `dist/`, coverage, isolated install, tarball, or provenance output by hand

### Commands

```bash
git -C ../../router status --short --branch
git -C ../../router rev-parse HEAD
npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json
npm run check
npm run test:isolated
npm run build
node scripts/verify-installed-runtime.mjs
npm run check:release-readiness
git diff --check
git diff --stat
git status --short --branch
```

### Acceptance Criteria

- [x] The clean recorded Router SHA, Router catalog, vendored catalog, generated source, runtime,
      docs, and installed package share one exact digest and eight exact tuples.
- [x] Official hosted preflight/output behavior is selected-model-specific and custom endpoint
      behavior still uses supplied model metadata.
- [x] Omitted output remains omitted; one safe compact-and-retry remains possible only before any
      response event.
- [x] Full check, isolated tests, build, installed-runtime, and read-only release-readiness gates
      pass under the required Node.js version.
- [x] The final diff contains no dependency, version, lockfile, workflow, release, tag, channel,
      secret, private-state, or unrelated provider/UI change.
- [x] Installation auth, proof, error codes, streaming bounds, tools, approvals, sponsor isolation,
      ads-off, and no-paid-stream-replay invariants remain intact.
- [x] No release or hosted mutation occurs and beta.18 release operations remain blocked.

### Validation Results

- Router clean-status/SHA/digest verification: passed at
  `d6b32a25e3d20bde5b7b82cb02ac116a1d9ce4e5` and digest
  `sha256:75b5c38f6f037ac2d5105b0e780bf449d00e0c851dcb749232503c3782b32b70`
- `npm run catalog:check -- --source ../../router/backend/catalog/model-catalog.v1.json`: passed
- `npm run check`: passed
- `npm run test:isolated`: passed outside the socket-restricted sandbox; AI 518, agent-core 182,
  and CLI 1,493 tests passed, with documented skips
- `npm run build`: passed
- staged installed-runtime/package smoke: passed
- `npm run check:release-readiness`: passed
- `git diff --check`: passed before release metadata preparation

### Findings / Notes

- Passing these gates proves local/candidate source readiness only. It does not prove beta.18 is
  tagged, staged, published, promoted, or installed from a public channel.
- A separately authorized automation continuation re-queried remotes and found beta.18 already
  immutable on Git/npm with a draft prerelease. Release work therefore fixes forward to the next
  unused beta and reruns the gates at that exact release commit.

---

## Follow-up Work

- `blocked`: Resume beta.18 tag, GitHub draft, npm candidate, acceptance, promotion, and finalization
  only after this limits implementation is committed, the Router SHA/digest is recorded, and all
  Step E gates pass. Re-query npm/GitHub first; if beta.18 is no longer unused, fix forward with the
  next unused prerelease.
- Before any hosted acceptance, verify the corresponding Router limits/migration/config are deployed
  from their exact recorded SHA; a CLI package must not advertise unavailable hosted behavior.
- Validate Desktop Agent dynamic model discovery separately before a coordinated rollout. Keep
  OpenCode beta.5 held until its distinct compatibility work is explicitly resumed.

## Decision Log

| Date | Decision | Rationale | Impact |
| --- | --- | --- | --- |
| 2026-08-02 | Sync only from a clean committed Router artifact | Router is the canonical owner and cross-repository provenance must be reproducible | CLI records the exact Router SHA/digest and rejects source drift |
| 2026-08-02 | Treat all eight tuples as exact ID-keyed data | Context/input/output values differ by model and are user-approved | Validation, generated metadata, runtime, docs, and tests become model-specific |
| 2026-08-02 | Replace shared scalar exports with `ADROUTER_HOSTED_LIMITS_BY_MODEL` | A shared public contract would be false after this change and is still unreleased on beta.18 | Consumers must select limits by canonical model ID; no misleading compatibility alias remains |
| 2026-08-02 | Use `min(max_input_tokens, context_window - 16,384)` for official preflight | This preserves the established compaction reserve while respecting Router's independent input cap | Proactive compaction follows the selected hosted model rather than one global threshold |
| 2026-08-02 | Omit output when unspecified and clamp explicit output by selected model | Router's conservative 4,096 default must remain authoritative while explicit callers can request more | Larger outputs are opt-in and remain subject to Router account/platform enforcement |
| 2026-08-02 | Preserve supplied model metadata for custom/loopback endpoints | Custom compatibility is an explicit boundary separate from official hosted policy | Unknown/custom models do not inherit or get rejected by the official tuple map |
| 2026-08-02 | Preserve one retry only before any response event | Paid/ad-first streams cannot be replayed safely after partial consumption | Larger contexts do not weaken existing no-replay guarantees |
| 2026-08-02 | Block beta.18 release operations until requalification | New Router-derived bytes and runtime behavior invalidate prior release evidence | Tag/publication/channel work requires fresh gates and separate authorization |
