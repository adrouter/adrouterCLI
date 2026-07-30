![AdRouter banner](images/logo.png)

# AdRouterCLI

AdRouterCLI is a terminal coding agent that routes model requests through
AdRouter. Version `0.81.0-beta.13` is an MIT-licensed public-source and npm
prerelease; hosted access remains invite-only. AdRouterCLI is derived from
[Mario Zechner's upstream project](UPSTREAM.md), whose MIT license and
attribution are preserved.

Sponsor content is display-only. It is rendered in the terminal and is never
added to model messages, tool payloads, commands, or edits. The agent can read
files and propose or execute commands, so accept trust prompts only for
workspaces you recognize and review command approvals.

## Install and platform support

Node.js 22.19 or newer is required. npm is the only beta distribution channel.
The six-platform CI matrix must pass before a release can continue.

| Installation | macOS arm64 | macOS x64 | Linux arm64 | Linux x64 | Windows arm64 | Windows x64 |
| --- | --- | --- | --- | --- | --- | --- |
| npm on Node.js 22.19+ | Supported | Supported | Supported | Supported | Supported | Supported |
| Signed standalone archive | Unavailable | Unavailable | Unavailable | Unavailable | Unavailable | Unavailable |

```sh
npm install --global --ignore-scripts @adrouter/cli@beta
adrouter --version
adrouter --help
```

Unsigned native keyboard helpers are omitted. macOS modifier detection is
limited to terminal input events, and Windows Shift+Tab depends on the
terminal's escape-sequence support. The JavaScript fallback remains available.
Do not download standalone archives: all six entries in
[`release-manifest.json`](release-manifest.json) are blocked until
matching-platform certification and signing are available.

Maintainers can install a production-faithful staged tarball from a checkout
with `npm run install:local`. `npm run link:dev` is reserved for development
and is never valid release or deployment evidence.

## First login, trust, and ads

1. Start `adrouter` inside the intended project.
2. Accept the trust prompt only after reviewing the project-local `.adrouter`
   resources it may load.
3. Run `/login adrouter`, explicitly choose to connect this CLI, and compare the
   displayed user code with the approval page opened at `https://app-staging.adrouter.co`.
4. Approve only the installation you recognize. The CLI stores an Ed25519 private
   key and rotating refresh credential in its mode-0600 auth file; access tokens
   remain memory-only. This storage is `file_protected`, not OS-keychain encrypted.
5. Run `/ads` to inspect sponsorship status or opt out immediately. Use `/logout
   adrouter` to attempt remote revocation and always remove local installation secrets.

The hosted beta routes six models:

```sh
adrouter --provider adrouter --model deepseek-v4-flash
adrouter --provider adrouter --model deepseek-v4-pro
adrouter --provider adrouter --model mimo-v2.5
adrouter --provider adrouter --model mimo-v2.5-pro
adrouter --provider adrouter --model agnes-2.5-flash
adrouter --provider adrouter --model agnes-2.5-pro-alpha
```

All hosted models use a 131,072-token total context contract with at most 4,096 output tokens and
126,976 input tokens. With default settings, AdRouterCLI estimates system, message, tool-schema, and
tool-result context and compacts proactively above about 114,688 tokens. If the Router still returns
the structured `input_limit_exceeded` error before any response event, the CLI compacts and retries
that logical turn once. It never replays a turn after an ad, text, thinking, tool call, settlement,
or completion event has been consumed.

## Profiles

`adrouter-profile` supports only `set`, `list`, `apply`, and `restore`.
Profiles live outside projects; applying one backs up the managed project
settings before writing `.adrouter/`.

```sh
adrouter-profile set work --provider adrouter --model deepseek-v4-flash
adrouter-profile list
adrouter-profile apply work --dry-run --no-launch
adrouter-profile apply work --no-launch
adrouter-profile restore
```

Use `--cwd <path>` with `apply` or `restore` to target another workspace.

## Configuration and local data

Global agent state is stored under `~/.adrouter/agent`, profiles under
`~/.adrouter/profiles`, and trusted project configuration under `.adrouter/`.
The main environment variables are:

- `ADROUTER_API_URL`: hosted gateway URL.
- `ADROUTER_API_KEY`: explicit bearer compatibility for loopback or non-official
  custom routers only. Official hosted origins require an approved installation.
- `ADROUTER_AD_MODE=live|mock|off`: sponsorship display mode.
- `ADROUTER_MODEL_ROUTE`: default hosted model route.
- `ADROUTER_CODING_AGENT_DIR`: explicit global state override.
- `ADROUTER_PROFILES_DIR`: explicit profile storage override.

See [configuration](docs/configuration.md) for precedence and the complete
schema. No beta release changes the command names, configuration format,
hosted API, or persisted state.

## Diagnostics and troubleshooting

The JSON doctor output reports configuration, router reachability, and redacted
installation/refresh/signing state without printing keys, tokens, codes, nonces,
proofs, or full fingerprints:

```sh
adrouter --json doctor
adrouter --offline --list-models adrouter
adrouter-profile list
```

If startup fails, confirm Node.js is at least 22.19, verify the global npm bin
directory is on `PATH`, rerun doctor, and try `--offline` to separate local
startup from gateway access. See [troubleshooting](docs/troubleshooting.md) for
terminal, authentication, trust, model, profile, and connectivity guidance.

## Updates, backup, and uninstallation

```sh
npm install --global --ignore-scripts @adrouter/cli@beta
tar -czf adrouter-state-backup.tar.gz -C "$HOME" .adrouter
npm uninstall --global @adrouter/cli
```

The backup contains installation and provider secrets; store it as sensitive
credential material. Uninstalling the package does not delete `~/.adrouter`. Remove that directory
only when you also intend to delete local sessions, profiles, credentials, and
trust decisions.

## Privacy and security

Conversation and tool context transit the hosted gateway and selected model
provider to produce a response. AdRouter does not persist prompts, model output,
or tool payloads in application logs or its usage ledger. Account, quota,
routing, sponsorship, settlement, and audit metadata may be retained as
described in the [beta privacy notice](docs/privacy.md). Send privacy questions
to `privacy@adrouter.co` only after the tester invitation confirms that the
mailbox is operational.

Report vulnerabilities through GitHub private vulnerability reporting, not a
public issue. See [SECURITY.md](SECURITY.md). Reproducible non-sensitive defects
belong in GitHub Issues; usage questions belong in GitHub Discussions. See
[SUPPORT.md](SUPPORT.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Source verification and attribution

Inspect the immutable source tag before installation:

```sh
gh api repos/adrouter/adrouterCLI/git/ref/tags/v0.81.0-beta.13
gh api repos/adrouter/adrouterCLI/tarball/v0.81.0-beta.13 > adrouterCLI-v0.81.0-beta.13.tar.gz
```

The release draft includes the single bundled npm tarball, its artifact
manifest, a CycloneDX SBOM, bundled-source inventory, third-party notices, and
checksums. The tarball and release metadata must have GitHub artifact
attestations before npm publication.

- [Upstream provenance](UPSTREAM.md)
- [MIT license](LICENSE)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Bundled-source inventory](docs/bundled-sources.json)
- [Architecture and data flow](docs/architecture.md)
- [Contributing](CONTRIBUTING.md)
- [Maintainer development](docs/development.md)
- [Release and recovery process](docs/releasing.md)
- [Incident response](docs/incidents.md)
