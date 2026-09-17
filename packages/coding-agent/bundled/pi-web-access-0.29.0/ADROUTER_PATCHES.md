# AdRouter adaptations

This bundle is derived from `pi-web-access@0.29.0` at
`192ac1875e3b8f88c78953dbc314949ec9fcaa27` and preserves AdRouterCLI's existing public surface.

- Configuration remains under `ADROUTER_CODING_AGENT_DIR`, `~/.adrouter/agent`, and trusted project
  `.adrouter` state. Browser-cookie access remains explicitly gated by
  `ADROUTER_ALLOW_BROWSER_COOKIES`.
- Decoded response bodies are streamed through hard byte limits rather than trusted solely by the
  `Content-Length` header.
- Multi-query cancellation aborts the whole operation instead of being converted into a per-query
  error.
- Full fetched page content is stored in a private, bounded, expiring external cache. Session JSON
  contains only metadata and an opaque cache reference.
- HTTP(S) proxy routing is active only inside web-access operations; unrelated host fetches remain
  direct and `NO_PROXY` is honored.
- Upstream providers, tools, commands, credential resolvers, and `source_check` capabilities added
  after the prior bundle are intentionally excluded.
