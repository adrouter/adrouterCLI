# Architecture and data flow

```text
local AdRouterCLI
  ├─ local session, tools, approvals, profiles, and display-only sponsor panel
  └─ conversation/tool context
          ↓ TLS
AdRouter hosted gateway
  ├─ authentication, quota, routing, usage, and settlement metadata
  └─ selected model request
          ↓
selected model provider
          ↓
model response → gateway → local CLI
```

Sponsorship selection and rendering stay outside model and tool context. The backend, WebUI, Electron agent, landing page, and infrastructure are external to this repository.

## Hosted context admission

The generated AdRouter catalog is the deterministic offline source for eight independent model
tuples. Context is 524,288 or 1,048,576 tokens, maximum input ranges from 458,752 to 917,504, and
maximum output ranges from 65,536 to 196,608. Before an official hosted request, the provider
conservatively estimates the full serialized model context, including the system prompt,
conversation, multibyte text, tool schemas, and tool results. The proactive boundary is the lower
of the selected model's maximum input and its context window minus the default 16,384-token reserve.
Omitting output still leaves Router's conservative 4,096-token request/account default authoritative.

An authoritative HTTP 413 with structured code `input_limit_exceeded` is eligible for one automatic
compact-and-retry only when it arrived before any response stream event. The synthetic assistant
error is retained in append-only session history but removed from the retry context. Any consumed
ad, text, thinking, tool-call, settlement, or done event makes the turn non-replayable. Other 413,
authentication, quota, policy, rate-limit, provider, transport, and abort failures are not treated as
context overflow. Sponsor and settlement side-channel data are never serialized into compaction
summaries.
