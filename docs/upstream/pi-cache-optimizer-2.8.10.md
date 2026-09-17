# pi-cache-optimizer 2.8.10 disposition

AdRouterCLI reviewed every upstream release after its 2.8.2 baseline while retaining only the
existing stats surface and opt-in DeepSeek stable-prefix behavior.

| Release | Disposition |
| --- | --- |
| 2.8.3 | Review and retain only applicable statistics correctness fixes. |
| 2.8.4 | Review and retain only applicable statistics correctness fixes. |
| 2.8.5 | Exclude provider/model mutation and raw cache-control expansion. |
| 2.8.6 | Exclude provider/model mutation and raw cache-control expansion. |
| 2.8.7 | Exclude provider/model mutation and raw cache-control expansion. |
| 2.8.8 | Retain compatible normalized-usage corrections only. |
| 2.8.9 | Retain compatible stable-prefix corrections only. |
| 2.8.10 | Reconstruct the reviewed narrow subset against the locked source and npm artifacts. |

Persistence, repair, provider mutation, and new cache-control authority are intentionally absent.
