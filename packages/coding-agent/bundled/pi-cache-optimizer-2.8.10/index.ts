import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	getAgentDir,
	type BuildSystemPromptOptions,
	type ExtensionAPI,
	type ExtensionContext,
	type SessionEntry,
} from "@adrouter/cli";

export type CacheOptimizerMode = "off" | "stats-only" | "prompt-rewrite";

interface PersistedConfig {
	version: 1;
	mode: CacheOptimizerMode;
}

interface PersistedModeState {
	status: "absent" | "valid" | "invalid";
	mode?: CacheOptimizerMode;
	permissions: "restricted" | "not-applicable" | "unsafe" | "unknown";
}

interface ModeResolution {
	mode: CacheOptimizerMode;
	source: "default" | "environment" | "persisted" | "invalid-environment" | "invalid-persisted";
	persisted: PersistedModeState;
}

interface UsageLike {
	input?: unknown;
	cacheRead?: unknown;
	cacheWrite?: unknown;
}

interface AssistantLike {
	role?: unknown;
	usage?: UsageLike;
}

export interface CacheUsageTotals {
	requests: number;
	hitRequests: number;
	inputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	missingUsageSamples: number;
	/** True only after the provider has returned a non-zero cache counter. */
	cacheTelemetryObserved: boolean;
}

export interface StablePrefixResult {
	systemPrompt: string;
	stablePrefixBytes: number;
	changed: boolean;
}

const CONFIG_FILENAME = "adrouter-cache-optimizer.json";
const MODE_ENV = "ADROUTER_CACHE_OPTIMIZER";
const STATUS_KEY = "adrouter-cache-optimizer";
const MODES: readonly CacheOptimizerMode[] = ["off", "stats-only", "prompt-rewrite"];
const MAX_CONFIG_BYTES = 4_096;

function isMode(value: unknown): value is CacheOptimizerMode {
	return typeof value === "string" && MODES.includes(value as CacheOptimizerMode);
}

function configPath(agentDir = getAgentDir()): string {
	return join(agentDir, CONFIG_FILENAME);
}

function permissionState(path: string): PersistedModeState["permissions"] {
	if (process.platform === "win32") return "not-applicable";
	try {
		return (statSync(path).mode & 0o077) === 0 ? "restricted" : "unsafe";
	} catch {
		return "unknown";
	}
}

export function readPersistedMode(agentDir = getAgentDir()): PersistedModeState {
	const path = configPath(agentDir);
	if (!existsSync(path)) return { status: "absent", permissions: "unknown" };
	try {
		if (lstatSync(path).isSymbolicLink()) return { status: "invalid", permissions: "unsafe" };
		const permissions = permissionState(path);
		if (permissions === "unsafe" || statSync(path).size > MAX_CONFIG_BYTES) {
			return { status: "invalid", permissions };
		}
		const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<PersistedConfig>;
		if (parsed.version !== 1 || !isMode(parsed.mode)) return { status: "invalid", permissions };
		return { status: "valid", mode: parsed.mode, permissions };
	} catch {
		return { status: "invalid", permissions: permissionState(path) };
	}
}

export function writePersistedMode(mode: CacheOptimizerMode, agentDir = getAgentDir()): void {
	if (!isMode(mode)) throw new Error("Invalid cache optimizer mode");
	if (existsSync(agentDir) && lstatSync(agentDir).isSymbolicLink()) {
		throw new Error("Refusing to write cache optimizer state through a symbolic-link directory");
	}
	mkdirSync(agentDir, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") chmodSync(agentDir, 0o700);
	const path = configPath(agentDir);
	if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
		throw new Error("Refusing to replace a symbolic-link cache optimizer config");
	}
	const config: PersistedConfig = { version: 1, mode };
	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	if (process.platform !== "win32") chmodSync(path, 0o600);
}

export function resolveCacheOptimizerMode(
	envValue: string | undefined,
	persisted = readPersistedMode(),
): ModeResolution {
	if (envValue !== undefined) {
		const normalized = envValue.trim().toLowerCase();
		return isMode(normalized)
			? { mode: normalized, source: "environment", persisted }
			: { mode: "stats-only", source: "invalid-environment", persisted };
	}
	if (persisted.status === "valid" && persisted.mode) {
		return { mode: persisted.mode, source: "persisted", persisted };
	}
	if (persisted.status === "invalid") {
		return { mode: "stats-only", source: "invalid-persisted", persisted };
	}
	return { mode: "stats-only", source: "default", persisted };
}

function nonNegativeNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function assistantFromEntry(entry: SessionEntry): AssistantLike | undefined {
	if (entry.type !== "message") return undefined;
	const message = entry.message as AssistantLike;
	return message.role === "assistant" ? message : undefined;
}

export function aggregateCacheUsage(
	entries: readonly SessionEntry[],
	pendingMessage?: AssistantLike,
): CacheUsageTotals {
	const totals: CacheUsageTotals = {
		requests: 0,
		hitRequests: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		missingUsageSamples: 0,
		cacheTelemetryObserved: false,
	};
	const messages = entries.map(assistantFromEntry).filter((message): message is AssistantLike => !!message);
	if (pendingMessage?.role === "assistant") messages.push(pendingMessage);

	for (const message of messages) {
		const input = nonNegativeNumber(message.usage?.input);
		const cacheRead = nonNegativeNumber(message.usage?.cacheRead);
		const cacheWrite = nonNegativeNumber(message.usage?.cacheWrite);
		if (input === undefined || cacheRead === undefined || cacheWrite === undefined) {
			totals.missingUsageSamples++;
			continue;
		}
		totals.requests++;
		totals.inputTokens += input;
		totals.cacheReadTokens += cacheRead;
		totals.cacheWriteTokens += cacheWrite;
		if (cacheRead > 0) totals.hitRequests++;
		if (cacheRead > 0 || cacheWrite > 0) totals.cacheTelemetryObserved = true;
	}
	return totals;
}

function formatTokens(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
	return String(Math.round(value));
}

export function formatCacheUsage(totals: CacheUsageTotals): string {
	if (totals.requests === 0) {
		return totals.missingUsageSamples > 0
			? "Cache telemetry unavailable: completed responses omitted normalized usage counters."
			: "Cache telemetry unavailable: no completed model usage in this session.";
	}
	const promptTokens = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
	if (!totals.cacheTelemetryObserved) {
		return `Cache telemetry unavailable: no non-zero read/write counters observed across ${totals.requests} request${totals.requests === 1 ? "" : "s"} (${formatTokens(promptTokens)} prompt tokens).`;
	}
	const readRate = promptTokens > 0 ? (totals.cacheReadTokens / promptTokens) * 100 : 0;
	return `Cache reads ${readRate.toFixed(1)}% (${formatTokens(totals.cacheReadTokens)} read, ${formatTokens(totals.cacheWriteTokens)} written) across ${totals.hitRequests}/${totals.requests} requests.`;
}

function findStablePrefixBoundary(prompt: string, options: BuildSystemPromptOptions): number {
	const markers: string[] = ["<project_context>", "The following skills provide specialized instructions", "Current date:"];
	if (options.customPrompt) markers.push(options.customPrompt);
	if (options.appendSystemPrompt) markers.push(options.appendSystemPrompt);
	let boundary = prompt.length;
	for (const marker of markers) {
		const index = prompt.indexOf(marker);
		if (index >= 0 && index < boundary) boundary = index;
	}
	return boundary;
}

/**
 * Canonicalize line endings only inside Pi's known-stable built-in prefix. Dynamic project context,
 * skills, user append prompts, dates, and working-directory text remain byte-for-byte unchanged.
 */
export function optimizeDeepSeekPrompt(
	systemPrompt: string,
	options: BuildSystemPromptOptions,
): StablePrefixResult {
	const boundary = findStablePrefixBoundary(systemPrompt, options);
	const stablePrefix = systemPrompt.slice(0, boundary);
	const canonicalPrefix = stablePrefix.replace(/\r\n?/g, "\n");
	const optimized = canonicalPrefix + systemPrompt.slice(boundary);
	return {
		systemPrompt: optimized,
		stablePrefixBytes: Buffer.byteLength(canonicalPrefix),
		changed: optimized !== systemPrompt,
	};
}

function isOfficialDeepSeek(ctx: Pick<ExtensionContext, "model">): boolean {
	return ctx.model?.provider === "adrouter" && ctx.model.id.startsWith("deepseek-");
}

function statsForContext(ctx: Pick<ExtensionContext, "sessionManager">, pending?: AssistantLike): CacheUsageTotals {
	return aggregateCacheUsage(ctx.sessionManager.getBranch(), pending);
}

function updateStatus(ctx: ExtensionContext, resolution: ModeResolution, pending?: AssistantLike): void {
	if (resolution.mode === "off") {
		ctx.ui.setStatus(STATUS_KEY, undefined);
		return;
	}
	const totals = statsForContext(ctx, pending);
	if (!totals.cacheTelemetryObserved) {
		ctx.ui.setStatus(STATUS_KEY, "cache —");
		return;
	}
	const promptTokens = totals.inputTokens + totals.cacheReadTokens + totals.cacheWriteTokens;
	const rate = promptTokens > 0 ? (totals.cacheReadTokens / promptTokens) * 100 : 0;
	const suffix = resolution.mode === "prompt-rewrite" && isOfficialDeepSeek(ctx) ? " · prefix" : "";
	ctx.ui.setStatus(STATUS_KEY, `cache ${rate.toFixed(0)}%${suffix}`);
}

function buildDoctorReport(
	resolution: ModeResolution,
	ctx: Pick<ExtensionContext, "model" | "sessionManager">,
	lastStablePrefixBytes: number | undefined,
): string {
	const envState =
		resolution.source === "environment"
			? `set (${resolution.mode})`
			: resolution.source === "invalid-environment"
				? "set (invalid; safe stats-only fallback)"
				: "not set";
	const modelState = ctx.model
		? isOfficialDeepSeek(ctx)
			? `${ctx.model.id} (prompt rewrite eligible)`
			: `${ctx.model.id} (stats only)`
		: "not selected";
	const prefixState = lastStablePrefixBytes === undefined ? "not analyzed this session" : `${lastStablePrefixBytes} bytes`;
	return [
		`Mode: ${resolution.mode} (${resolution.source})`,
		`Environment override: ${envState}`,
		`Persisted config: ${resolution.persisted.status}; permissions ${resolution.persisted.permissions}`,
		`Model: ${modelState}`,
		`Stable prefix: ${prefixState}`,
		formatCacheUsage(statsForContext(ctx)),
		"Provider/model mutation: disabled",
		"Hosted cache fields: disabled",
	].join("\n");
}

export default function adRouterCacheOptimizer(pi: ExtensionAPI): void {
	let resolution = resolveCacheOptimizerMode(process.env[MODE_ENV]);
	let lastStablePrefixBytes: number | undefined;
	const refreshResolution = (): ModeResolution => {
		resolution = resolveCacheOptimizerMode(process.env[MODE_ENV]);
		return resolution;
	};

	pi.on("session_start", (_event, ctx) => updateStatus(ctx, refreshResolution()));
	pi.on("message_end", (event, ctx) => {
		if (event.message.role === "assistant") updateStatus(ctx, refreshResolution(), event.message);
	});
	pi.on("session_shutdown", (_event, ctx) => ctx.ui.setStatus(STATUS_KEY, undefined));
	pi.on("before_agent_start", (event, ctx) => {
		const current = refreshResolution();
		if (current.mode !== "prompt-rewrite" || !isOfficialDeepSeek(ctx)) return;
		const optimized = optimizeDeepSeekPrompt(event.systemPrompt, event.systemPromptOptions);
		lastStablePrefixBytes = optimized.stablePrefixBytes;
		if (optimized.changed) return { systemPrompt: optimized.systemPrompt };
	});

	pi.registerCommand("cache", {
		description: "Show authoritative session cache usage",
		handler: async (_args, ctx) => {
			ctx.ui.notify(formatCacheUsage(statsForContext(ctx)), "info");
		},
	});

	pi.registerCommand("cache-optimizer", {
		description: "Inspect or set cache optimizer mode",
		getArgumentCompletions: (prefix) =>
			[...MODES, "doctor"]
				.filter((candidate) => candidate.startsWith(prefix.trim().toLowerCase()))
				.map((candidate) => ({ value: candidate, label: candidate })),
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase();
			if (!action) {
				ctx.ui.notify(`${buildDoctorReport(refreshResolution(), ctx, lastStablePrefixBytes)}\n\nUsage: /cache-optimizer off|stats-only|prompt-rewrite|doctor`, "info");
				return;
			}
			if (action === "doctor") {
				ctx.ui.notify(buildDoctorReport(refreshResolution(), ctx, lastStablePrefixBytes), "info");
				return;
			}
			if (!isMode(action)) {
				ctx.ui.notify("Usage: /cache-optimizer off|stats-only|prompt-rewrite|doctor", "error");
				return;
			}
			try {
				writePersistedMode(action);
				const current = refreshResolution();
				updateStatus(ctx, current);
				const override = current.source === "environment" ? " The environment override remains authoritative." : "";
				ctx.ui.notify(`Cache optimizer mode: ${current.mode}.${override}`, "info");
			} catch (error) {
				ctx.ui.notify(
					`Could not save cache optimizer mode: ${error instanceof Error ? error.message : String(error)}`,
					"error",
				);
			}
		},
	});
}

export const __cacheOptimizerInternals = {
	buildDoctorReport,
	findStablePrefixBoundary,
	isOfficialDeepSeek,
};
