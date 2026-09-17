# AdRouter cache optimizer adaptation

This bundle is derived from `pi-cache-optimizer` 2.8.10 at commit
`dc9be50b89957a37f8e80ef42378e3841ba8665a`. Exact source and npm archive hashes and integrity are recorded in the
repository's `upstreams.lock.json`.

The AdRouter adaptation defaults to `stats-only`. It derives session cache counters from normalized
assistant usage already returned by the Router. `/cache` reports those counters, and
`/cache-optimizer doctor` reports the local mode without printing paths, prompts, headers, message
content, or credentials.

`/cache-optimizer prompt-rewrite` is an explicit opt-in and only applies to official DeepSeek
models. It canonicalizes line endings inside the known-stable built-in prefix; project context,
skills, appended prompts, dates, and working-directory text remain byte-for-byte unchanged. Set
`ADROUTER_CACHE_OPTIMIZER=off` for a process-level kill switch.

The adaptation intentionally omits provider registration, provider/model configuration writes,
compat mutation, cache-retention environment mutation, raw hosted cache hints, prompt cache keys,
skills compression, routing globals, persistent provider statistics, repair/configuration commands,
and telemetry egress. The 2.8.3 through 2.8.10 upstream releases were reviewed; their expanded
mutation and persistence surfaces remain outside this deliberately narrow bundle.
