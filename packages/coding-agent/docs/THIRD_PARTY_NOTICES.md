# Third-party notices

AdRouterCLI distributes source copies of the following optional extensions in
`bundled/`. They are enabled for normal AdRouterCLI startup unless
`ADROUTER_BUNDLED_FEATURES=off` is set.

| Component | Version | Source | License |
| --- | --- | --- | --- |
| pi-subagents | 0.68.0 (reviewed AdRouter subset) | https://github.com/nicobailon/pi-subagents/tree/f3ccf47dc236b6c0fcc0d897cec4a9e6da3e916d | MIT |
| pi-cache-optimizer | 2.8.10 (reviewed AdRouter subset) | https://github.com/jiangge/pi-cache-optimizer/tree/dc9be50b89957a37f8e80ef42378e3841ba8665a | MIT |
| pi-web-access | 0.29.0 (reviewed AdRouter subset) | https://github.com/nicobailon/pi-web-access/tree/192ac1875e3b8f88c78953dbc314949ec9fcaa27 | MIT |
| BTW | `23017e9` | project-owner source: `~/antigravity/pi-stuff/btw` | Project-owner source; distribution authorized |
| pi-opencode-tui-patch | 0.1.6 (`e687e69b`) | project-owner source: `~/antigravity/pi-stuff/pi-opencode-tui-patch` | Project-owner source; distribution authorized |

`pi-subagents@0.68.0` is pinned with source and npm archive hashes plus npm integrity
`sha512-sfUKoSIegyCwnD0Y9dDE2sPm/kDmx3P85CQqRpuShv77iSWJXeEc3mDQUK1rZNbhHPnIdQSeFcK+G66hczQSgg==`.
AdRouter retains its reviewed bounded execution engine and ports only the declared safe lifecycle
subset. The public schema and runtime policy remove upstream automation and authority-expanding
surfaces; exact adaptations are listed in the bundle's `ADROUTER_PATCHES.md`.

`pi-cache-optimizer@2.8.10` is pinned with source and npm archive hashes plus npm integrity
`sha512-u+Da+NDQROJuP0T1KTGLkrFRaPF0pcUCuI6KA5G2gGO/a3Z+IfoNxDF9+EmVAQ1vcu/kuQCBzvqb5QekhwAAzg==`.
Only truthful normalized-usage statistics and an opt-in, DeepSeek-only stable-prefix rewrite are
retained; provider/model mutation and raw cache controls are omitted.

`pi-web-access@0.29.0` is pinned with source and npm archive hashes plus npm integrity
`sha512-1l4sAWYkFhiBynJf/mXuxmCHxjhiAyWJ4rfQVFu8UPa0JQhCS9oXAmNXcL0Q1SfrO00plmb6L4IkypJ3n1Q4Kg==`.
AdRouter ports bounded decoded-body reads, cancellation propagation, private external fetched-content
caching, expiry pruning, and request-scoped HTTP(S) proxy routing. New providers, tools, commands,
credential resolvers, and source-check authority remain excluded. Runtime dependencies are compiled
into `bundled/pi-web-access-0.29.0/dist/index.js`, while host extension API imports remain external.

## Project-owner sources

BTW commit `23017e9d` and pi-opencode-tui-patch commit `e687e69b` were created
by the AdRouterCLI project owner. The project owner authorized their inclusion,
modification, and redistribution in AdRouterCLI npm and standalone packages.
The patch source is integrated into AdRouterCLI rather than loaded at runtime.
Authorization details are recorded in `BUNDLED_SOURCES.json`.

The original package manifests and any distributed license files remain in the
corresponding bundle directory. Local changes are recorded in
`docs/bundled-sources.json`.
