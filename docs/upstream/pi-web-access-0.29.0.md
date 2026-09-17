# pi-web-access 0.29.0 disposition

AdRouterCLI reviewed the upstream sequence from 0.13.0 through 0.29.0 against its existing public
tool, command, provider, credential, and authority contracts.

| Release | Disposition |
| --- | --- |
| 0.14.0 | Adopt cancellation propagation for non-curated multi-query searches. |
| 0.15.0 | Exclude newly introduced provider and credential surface. |
| 0.16.0 | Exclude newly introduced provider and credential surface. |
| 0.17.0 | Adopt decoded-body streaming size enforcement. |
| 0.17.1 | Retain the 0.17 size-enforcement correction. |
| 0.18.0 | Exclude public-surface expansion; retain compatible internal fixes only. |
| 0.19.0 | Exclude public-surface expansion; retain compatible internal fixes only. |
| 0.20.0 | Exclude public-surface expansion; retain compatible internal fixes only. |
| 0.21.0 | Adapt external fetched-content caching so session JSON contains no full page bodies. |
| 0.22.0 | Adopt cache symlink, permission, entry-count, and byte-limit hardening. |
| 0.23.0 | Exclude new provider/tool/credential authority. |
| 0.24.0 | Exclude new provider/tool/credential authority. |
| 0.24.1 | Retain applicable fixes without expanding the public surface. |
| 0.24.2 | Retain applicable fixes without expanding the public surface. |
| 0.25.0 | Exclude new provider/tool/credential authority. |
| 0.26.0 | Exclude new provider/tool/credential authority. |
| 0.27.0 | Exclude `source_check` and other new authority. |
| 0.28.0 | Adapt proxy routing to request-scoped HTTP(S) dispatch for web-access operations only. |
| 0.29.0 | Adopt expiry pruning for in-memory and external fetched-content caches. |

The resulting bundle still registers only `fetch_content`, `get_search_content`, and `web_search`;
the existing curator/search commands; and the previously approved provider set.
