# AdRouterCLI repository instructions

Parent release-workspace and workspace instructions apply. This independent repository is the
canonical terminal coding agent; its public packages release in lockstep.

## Ownership and toolchain

- `packages/` — provider/runtime, agent harness, TUI, and executable packages.
- `scripts/` — model generation, package/public-boundary validation, staged install, acceptance,
  and release helpers.
- package-local and root tests — provider, auth, runtime, terminal, and release-policy coverage.
- `.github/workflows/` — CI and protected candidate/promotion workflows.

Use the repository-declared Node engine, npm lockfile, and workspace layout. Generated `dist/`,
coverage, tarballs, and isolated-install output are not source.

## Hosted identity and product

- Official hosted sign-in creates an installation, opens the CLI browser handoff, binds a
  comparison code, waits for approval, and stores private/refresh material in mode-0600
  file-protected state.
- Every hosted agent/profile request uses fresh proof and short-lived access material.
- Preserve browser Done/Quit, Open/Copy/Quit fallback, cancellation/retry cleanup, refresh
  rotation, nonce/revocation/version errors, logout cleanup, and secret-free doctor output.
- Custom/loopback bearer compatibility is separate from hosted sign-in.
- Workspace trust gates project-local config. Commands and mutations retain explicit approval.
- Sponsor data stays in the panel and controls, never model, tool, command, edit, or compacted
  context.

The Router registry and checked-in generator own catalog facts. Never hand-edit generated model
files; regenerate and verify every projection. Selectability follows current coding qualification,
not mere presence in the Router catalog.

## Validation and release

Use focused tests while iterating; the normal gate is `npm run check`.
`npm run install:local` is the production-faithful local install path; development links are not
release evidence.

Before release work read the current plan, security/release docs, manifests, workflows,
`../../docs/state.md`, and the newest receipt, then re-query npm/GitHub. Require clean exact
source, lockstep manifests and artifacts, immutable tag/version, staged package inspection,
anonymous installation, and the documented platform/auth acceptance.

Candidate publication and promotion are separately authorized. Use the same exact tag for workflow
input and dispatch ref; stop on integrity or candidate conflicts and fix forward.
