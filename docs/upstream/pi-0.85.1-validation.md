# Pi 0.85.1 upgrade validation

The 0.81.0-beta.28 release source adapts Pi core 0.85.1 and the reviewed extension targets while
preserving AdRouterCLI's public and hosted boundaries.

## Completed gates

- Exact source and npm artifacts were independently verified for Pi 0.85.1,
  pi-subagents 0.68.0, pi-cache-optimizer 2.8.10, and pi-web-access 0.29.0.
- Focused component tests passed, including lifecycle cleanup, byte-neutral cache behavior,
  decoded-body limits, external fetched-content caching, cancellation, and scoped proxy state.
- The full build, repository check, isolated test suite, release-readiness check, package smoke,
  production-faithful local install, and publication dry run passed.
- The isolated test suite completed with 538 AI tests, the TUI node test suite, 191 agent tests,
  and 1,543 CLI tests passing, with expected environment-dependent skips.
- Package smoke verified the staged command, doctor classification, bundled contracts, reload/new
  lifecycle, clean dependency tree, and profile round trip.
- A clean-prefix rehearsal installed 0.81.0-beta.27, upgraded the same synthetic state to
  0.81.0-beta.28, and restored 0.81.0-beta.27 successfully.

## Release hold points

The protected tag workflow must stage and attest the exact committed tarball. Candidate publication
must then precede operator-controlled authentication acceptance on two distinct cohorts. Final
promotion remains prohibited until that redacted acceptance asset exists and all six protected
anonymous installed-runtime jobs pass.
