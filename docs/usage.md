# First run and usage

Start `adrouter` in the intended project. The first-project prompt controls whether repository-owned `.adrouter/` resources can load. Trust only reviewed workspaces.

Run `/login adrouter`, sign in at the opened AdRouter website, and choose the native Done action after the website confirms sign-in. The CLI then creates a fresh installation key and opens the matching WebUI approval page; an already-open signed-in tab also shows the approval modal. Use Open or Copy if the browser does not launch, or Quit to cancel. Failed attempts remove the pending key and best-effort cancel server state, so a later `/login adrouter` starts cleanly. The device code, private key, and credentials are never displayed. Then select `deepseek-v4-flash`, `deepseek-v4-pro`, `mimo-v2.5`, `mimo-v2.5-pro`, `agnes-2.0-flash`, or `agnes-2.5-flash`. For non-interactive work after enrollment:

```sh
adrouter --provider adrouter --model deepseek-v4-flash --print "Explain this project"
```

Use `/ads` to view sponsorship status or opt out immediately. Sponsor payloads are display-only. Commands proposed by the agent remain subject to user approval.

The [generated model table](about.md#official-model-catalog) lists the exact context, maximum input,
and maximum output tuple for each hosted model. Omitting an output limit keeps Router's 4,096-token
default; selecting a model with a larger maximum does not bypass account policy.

`/logout adrouter` attempts signed remote revocation and removes the local installation even when offline; when remote confirmation is unavailable, review installations in the WebUI. `adrouter-profile` creates and selects isolated profiles. Sessions, file-protected credentials, trust decisions, extensions, and settings live under `~/.adrouter/agent`; project resources live under `.adrouter/`.

Bundled features include web access, subagents, and the BTW side panel. To diagnose startup or extension behavior, disable bundled features individually in settings or start with project resources untrusted. Re-enable them one at a time after the fault is isolated.

Working-source catalog additions: `glm-5.3`, `qwen3.8-max`, and `qwen3.8-flash`. Hosted client acceptance and successor publication are pending; Kimi K3 (`kimi-k3`) is available from candidate 0.81.0-beta.26 with memory-only tool continuation.


## Presence during long tasks

The combined candidate source asks “Are you still there?” after 60 seconds of active work, including waiting for the first response. Press a fresh Enter to continue for another minute, or cancel the task. Existing streams keep arriving and settling; the next model request, tool, command, compaction or delegation waits at its runtime boundary. Unsent text and queued work are retained. Presence acknowledgement does not approve a command. Ordinary approval waits suspend the presence timer.

RPC emits `attention_required` with `taskId` and `promptId`. Respond with `{ "type": "presence_ack", "taskId": "...", "promptId": "..." }`; a stale or repeated response fails. `abort` remains available. Noninteractive print/JSON mode reports attention required and exits nonzero at the next safe boundary, retaining completed output. Presence events are local control flow and are not model messages.
