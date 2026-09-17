# Pi 0.85.1 adaptation ledger

AdRouterCLI reviewed Pi `v0.85.1` at commit
`d981de1229ef899957bbe968bc8dcda02a21f477`. The source archive and npm tarball are
independently frozen and verified in `upstreams.lock.json`. This is a selective source
adaptation: AdRouter's hosted identity, Router catalog, approval model, TUI overlay, sponsor
isolation, and release policy remain authoritative.

## Release-by-release disposition

| Release | Disposition | AdRouterCLI treatment |
| --- | --- | --- |
| 0.84.2 | Adopt/adapt | Preserve partial tool results and terminal provider failures; retain AdRouter's bounded event and error contracts. |
| 0.84.3 | Adopt/adapt | Apply tool execution-context cwd, session append repair, extension-factory rollback, and provider compatibility fixes. |
| 0.84.4 | Adopt/adapt | Apply `NO_PROXY` domain, wildcard, port, and IPv6 matching and best-effort terminal dimension refresh. |
| 0.85.0 | Adopt/adapt | Apply agent turn-preparation ordering and cancellation guards; retain the existing AdRouter session, approval, and TUI surfaces. |
| 0.85.1 | Adopt/adapt | Add explicit prompt-cache and `max_output_tokens` capability gates plus the renamed Google API thinking type with a compatibility alias. |

## Adopted behavior

- `prepareNextTurn` runs only when another model turn will actually start; a terminating turn no
  longer invokes it, and parallel prepared tools observe cancellation before execution.
- Built-in read, write, edit, find, grep, list, and shell tools resolve cwd from the execution
  context while preserving their configured fallback directory.
- Valid JSONL sessions whose final entry was interrupted before its newline are repaired before a
  future append, without modifying malformed or non-session files.
- A failing extension factory no longer leaks event subscriptions or flag defaults, and its
  captured API becomes unusable.
- Proxy exclusions correctly match exact domains, subdomains, wildcard forms, IPv6 literals, and
  port-qualified entries.
- Terminal dimension refresh is best-effort in restricted containers instead of making startup
  fail when `SIGWINCH` delivery is denied.
- OpenAI Responses compatibility can opt into explicit cache controls or omit
  `max_output_tokens`; legacy defaults remain unchanged. `GoogleThinkingLevel` remains exported as
  a deprecated alias of `GoogleApiThinkingLevel`.

## Existing local equivalents

- Truncated/incomplete model streams are already rejected before persistence.
- Presence gates, workspace trust, command approval, hosted proof refresh, and sponsor-context
  exclusion are already enforced by AdRouter-specific layers and tests.
- The generated Router model catalog remains the only selectable hosted catalog.

## Deferred or rejected

- Remote client/server packages, harness-v2, product-mode replacement, deferred-tool product
  surfaces, dynamic provider discovery, and unrelated upstream UI redesigns are deferred.
- New credential import/export, telemetry authority, runtime source download, self-update, and
  provider catalogs outside the checked-in generator are rejected.
- No upstream change may weaken `/v1/agent/turn`, `/v1/profile`, installation proofs, approval
  boundaries, sponsor isolation, or logout cleanup.

## Validation contract

The focused agent, provider, session, extension, tool, and terminal regressions must pass before
the repository-wide `npm run upstream:check` and `npm run check` gates. Candidate publication and
promotion continue to require the protected release workflow and an acceptance artifact for the
exact candidate version.
