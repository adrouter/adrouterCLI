/**
 * TypeBox schemas for subagent tool parameters
 */

import { Type } from "typebox";
import { SUBAGENT_ACTIONS } from "../shared/types.ts";

function keepTopLevelParameterDescriptions<T>(schema: T): T {
	return pruneNestedDescriptions(schema, []) as T;
}

function pruneNestedDescriptions(value: unknown, path: string[]): unknown {
	if (!value || typeof value !== "object") return value;

	const result = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor) continue;
		if (key === "description" && !isTopLevelParameterDescription(path)) continue;
		if ("value" in descriptor) {
			const nextPath = typeof key === "string" ? [...path, key] : path;
			descriptor.value = pruneNestedDescriptions(descriptor.value, nextPath);
		}
		Object.defineProperty(result, key, descriptor);
	}
	return result;
}

function isTopLevelParameterDescription(path: string[]): boolean {
	return path.length === 2 && path[0] === "properties";
}

const SkillOverride = Type.Unsafe({
	anyOf: [
		{ type: "array", items: { type: "string" } },
		{ type: "boolean" },
		{ type: "string" },
	],
	description: "Skill name(s) to inject (comma-separated), array of strings, or boolean (false disables, true uses default)",
});

const OutputOverride = Type.Unsafe({
	anyOf: [
		{ type: "string" },
		{ type: "boolean" },
	],
	description: "Output filename/path (string), or false to disable file output",
});

const OutputModeOverride = Type.String({
	enum: ["inline", "file-only"],
	description: "Return saved output inline (default) or only a concise file reference. file-only requires output to be a path.",
});

const ReadsOverride = Type.Unsafe({
	anyOf: [
		{ type: "array", items: { type: "string" } },
		{ type: "boolean" },
	],
	description: "Files to read before running (array of filenames), or false to disable",
});

const JsonSchemaObject = Type.Unsafe({
	type: "object",
	additionalProperties: true,
	description: "JSON Schema object for strict structured output. Non-object roots are rejected.",
});

const AcceptanceOverride = Type.Unsafe({
	anyOf: [
		{ type: "string", enum: ["auto", "none", "attested", "checked", "verified", "reviewed"] },
		{ const: false },
	],
	description: "Optional named acceptance level. Executable verification commands are not accepted through the public tool schema.",
});

const TaskItem = Type.Object({
	agent: Type.String(),
	task: Type.String(),
	cwd: Type.Optional(Type.String()),
	count: Type.Optional(Type.Integer({ minimum: 1, maximum: 3, description: "Repeat this parallel task up to three times with the same settings." })),
	output: Type.Optional(OutputOverride),
	outputMode: Type.Optional(OutputModeOverride),
	reads: Type.Optional(ReadsOverride),
	progress: Type.Optional(Type.Boolean({ description: "Enable progress.md tracking for this task" })),
	model: Type.Optional(Type.String({ description: "Override model for this task (e.g. 'google/gemini-3-pro')" })),
	skill: Type.Optional(SkillOverride),
	acceptance: Type.Optional(AcceptanceOverride),
});

// Parallel task item (within a parallel step)
const ParallelTaskSchema = Type.Object({
	agent: Type.String(),
	task: Type.Optional(Type.String({ description: "Task template with {task}, {previous}, {chain_dir} variables. Defaults to {previous}." })),
	phase: Type.Optional(Type.String({ description: "Optional phase/group label for status and graph rendering." })),
	label: Type.Optional(Type.String({ description: "Optional user-facing label for this parallel task." })),
	as: Type.Optional(Type.String({ description: "Optional safe identifier used as {outputs.name} in later chain steps." })),
	outputSchema: Type.Optional(JsonSchemaObject),
	cwd: Type.Optional(Type.String()),
	count: Type.Optional(Type.Integer({ minimum: 1, maximum: 3, description: "Repeat this parallel task up to three times with the same settings." })),
	output: Type.Optional(OutputOverride),
	outputMode: Type.Optional(OutputModeOverride),
	reads: Type.Optional(ReadsOverride),
	progress: Type.Optional(Type.Boolean({ description: "Enable progress.md tracking in {chain_dir}" })),
	skill: Type.Optional(SkillOverride),
	model: Type.Optional(Type.String({ description: "Override model for this task" })),
	acceptance: Type.Optional(AcceptanceOverride),
});

// Flattened so chain steps do not need an object-shape anyOf/oneOf union.
const ChainItem = Type.Object({
	agent: Type.Optional(Type.String({ description: "Sequential step agent name" })),
	task: Type.Optional(Type.String({
		description: "Task template with variables: {task}=original request, {previous}=prior step's text response, {chain_dir}=shared folder, {outputs.name}=prior named output. Required for first step, defaults to '{previous}' for subsequent steps."
	})),
	phase: Type.Optional(Type.String({ description: "Optional phase/group label for status and graph rendering." })),
	label: Type.Optional(Type.String({ description: "Optional user-facing label for this chain step." })),
	as: Type.Optional(Type.String({ description: "Optional safe identifier used as {outputs.name} in later chain steps." })),
	outputSchema: Type.Optional(JsonSchemaObject),
	cwd: Type.Optional(Type.String()),
	output: Type.Optional(OutputOverride),
	outputMode: Type.Optional(OutputModeOverride),
	reads: Type.Optional(ReadsOverride),
	progress: Type.Optional(Type.Boolean({ description: "Enable progress.md tracking in {chain_dir}" })),
	skill: Type.Optional(SkillOverride),
	model: Type.Optional(Type.String({ description: "Override model for this step" })),
	acceptance: Type.Optional(AcceptanceOverride),
	parallel: Type.Optional(Type.Array(ParallelTaskSchema, {
		minItems: 1,
		maxItems: 3,
		description: "One to three statically declared tasks to run in parallel",
	})),
	concurrency: Type.Optional(Type.Number({ minimum: 1, maximum: 3, description: "Max concurrent tasks (hard cap: 3)" })),
	failFast: Type.Optional(Type.Boolean({ description: "Stop on first failure (default: false)" })),
}, {
	description: "Chain step: use {agent, task?, ...} for sequential or {parallel: [...]} for bounded static concurrent execution.",
	additionalProperties: false,
});

const ControlOverrides = Type.Object({
	enabled: Type.Optional(Type.Boolean({ description: "Enable/disable subagent control attention tracking for this run" })),
	needsAttentionAfterMs: Type.Optional(Type.Integer({ minimum: 1, description: "No-observed-activity window before a run needs attention" })),
	activeNoticeAfterMs: Type.Optional(Type.Integer({ minimum: 1, description: "Active-long-running notice threshold by elapsed ms (default: 240000)" })),
	activeNoticeAfterTurns: Type.Optional(Type.Integer({ minimum: 1, description: "Optional active-long-running notice threshold by assistant turns (disabled by default)" })),
	activeNoticeAfterTokens: Type.Optional(Type.Integer({ minimum: 1, description: "Optional active-long-running notice threshold by total tokens (disabled by default)" })),
	failedToolAttemptsBeforeAttention: Type.Optional(Type.Integer({ minimum: 1, description: "Consecutive mutating-tool failures before escalating to needs_attention (default: 3)" })),
	notifyOn: Type.Optional(Type.Array(Type.String({ enum: ["active_long_running", "needs_attention"] }), {
		description: "Control event types that should notify the parent/orchestrator. Defaults to active_long_running and needs_attention.",
	})),
	notifyChannels: Type.Optional(Type.Array(Type.String({ enum: ["event", "async"] }), {
		description: "Local notification channels to use when available. External intercom is disabled.",
	})),
});

const SubagentParamsSchema = Type.Object({
	agent: Type.Optional(Type.String({ description: "Agent name (SINGLE mode) or target for the read-only get action" })),
	task: Type.Optional(Type.String({ description: "Task (SINGLE mode, optional for self-contained agents)" })),
	// Management action (when present, tool operates in management mode)
	action: Type.Optional(Type.String({
		enum: [...SUBAGENT_ACTIONS],
		description: "Management/control action. Omit for execution mode."
	})),
	id: Type.Optional(Type.String({
		description: "Run id or prefix for action='status', action='interrupt', action='stop', or action='resume'."
	})),
	runId: Type.Optional(Type.String({
		description: "Target run ID for action='interrupt', action='stop', or action='resume'. Defaults to the most recently active controllable run for interrupt. Prefer id for new calls."
	})),
	dir: Type.Optional(Type.String({
		description: "Async run directory for action='status', action='stop', or action='resume'."
	})),
	index: Type.Optional(Type.Integer({ minimum: 0, description: "Zero-based child index for actions that target a specific child." })),
	message: Type.Optional(Type.String({ description: "Follow-up message for action='resume'. Use index to choose a child from multi-child runs." })),
	// Chain identifier for management (can't reuse 'chain' — that's the execution array)
	chainName: Type.Optional(Type.String({
		description: "Chain name for the read-only get action"
	})),
	tasks: Type.Optional(Type.Array(TaskItem, {
		maxItems: 3,
		description: "PARALLEL mode: one to three [{agent, task, count?, output?, outputMode?, reads?, progress?}, ...] entries",
	})),
	concurrency: Type.Optional(Type.Integer({ minimum: 1, maximum: 3, description: "Top-level PARALLEL mode only: max concurrent tasks (hard cap: 3)." })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "CHAIN mode: sequential pipeline where each step's response becomes {previous} for the next." })),
	context: Type.Optional(Type.String({
		enum: ["fresh", "fork"],
		description: "'fresh' or 'fork' to branch from parent session. If omitted, any requested agent with defaultContext: 'fork' makes the whole invocation forked; otherwise the default is 'fresh'.",
	})),
	chainDir: Type.Optional(Type.String({ description: "Persistent directory for chain artifacts. Default: a user-scoped temp directory under <tmpdir>/ (auto-cleaned after 24h)" })),
	async: Type.Optional(Type.Boolean({ description: "Run in background (default: false, or per config)" })),
	agentScope: Type.Optional(Type.String({ description: "Agent discovery scope: 'user', 'project', or 'both' (default: 'both'; project wins on name collisions)" })),
	cwd: Type.Optional(Type.String()),
	artifacts: Type.Optional(Type.Boolean({ description: "Write debug artifacts (default: true)" })),
	includeProgress: Type.Optional(Type.Boolean({ description: "Include full progress in result (default: false)" })),
	sessionDir: Type.Optional(
		Type.String({ description: "Directory to store session logs (default: a private temporary directory)" }),
	),
	// Clarification TUI
	clarify: Type.Optional(Type.Boolean({ description: "Show TUI to preview/edit before execution. Explicit clarify: true keeps the run foreground for the clarify UI; omitted clarify can still run in the background when async: true is set." })),
	control: Type.Optional(ControlOverrides),
	// Solo agent overrides
	output: Type.Optional(Type.Unsafe({
		anyOf: [
			{ type: "string" },
			{ type: "boolean" },
		],
		description: "Output file for single agent (string), or false to disable. Relative paths resolve against cwd.",
	})),
	outputMode: Type.Optional(OutputModeOverride),
	skill: Type.Optional(SkillOverride),
	model: Type.Optional(Type.String({ description: "Override model for single agent (e.g. 'anthropic/claude-sonnet-4')" })),
	acceptance: Type.Optional(AcceptanceOverride),
});

export const SubagentParams = keepTopLevelParameterDescriptions(SubagentParamsSchema);
