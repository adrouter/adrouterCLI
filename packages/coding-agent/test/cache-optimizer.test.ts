import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import cacheOptimizer, {
	__cacheOptimizerInternals,
	aggregateCacheUsage,
	formatCacheUsage,
	optimizeDeepSeekPrompt,
	readPersistedMode,
	resolveCacheOptimizerMode,
	writePersistedMode,
} from "../bundled/pi-cache-optimizer-2.8.10/index.ts";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "../src/index.ts";

type CapturedHandler = (event: unknown, context: ExtensionContext) => unknown;

const directories: string[] = [];
let originalAgentDir: string | undefined;
let originalMode: string | undefined;

function tempDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "adrouter-cache-optimizer-test-"));
	directories.push(directory);
	return directory;
}

function assistantEntry(input: number, cacheRead: number, cacheWrite: number): SessionEntry {
	return {
		id: crypto.randomUUID(),
		parentId: null,
		timestamp: new Date().toISOString(),
		type: "message",
		message: {
			role: "assistant",
			content: [],
			provider: "adrouter",
			model: "deepseek-v4-flash",
			api: "openai-completions",
			usage: {
				input,
				output: 1,
				cacheRead,
				cacheWrite,
				totalTokens: input + cacheRead + cacheWrite + 1,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		},
	} as SessionEntry;
}

function extensionHarness(): { handlers: Map<string, CapturedHandler[]> } {
	const handlers = new Map<string, CapturedHandler[]>();
	const api = {
		on: (event: string, handler: CapturedHandler) => {
			const registered = handlers.get(event) ?? [];
			registered.push(handler);
			handlers.set(event, registered);
		},
		registerCommand: () => {},
	} as unknown as ExtensionAPI;
	cacheOptimizer(api);
	return { handlers };
}

function extensionContext(modelId = "deepseek-v4-flash"): ExtensionContext {
	return {
		model: { provider: "adrouter", id: modelId },
		sessionManager: { getBranch: () => [] },
		ui: { setStatus: () => {}, notify: () => {} },
	} as unknown as ExtensionContext;
}

beforeEach(() => {
	originalAgentDir = process.env.ADROUTER_CODING_AGENT_DIR;
	originalMode = process.env.ADROUTER_CACHE_OPTIMIZER;
	process.env.ADROUTER_CODING_AGENT_DIR = tempDirectory();
	delete process.env.ADROUTER_CACHE_OPTIMIZER;
});

afterEach(() => {
	if (originalAgentDir === undefined) delete process.env.ADROUTER_CODING_AGENT_DIR;
	else process.env.ADROUTER_CODING_AGENT_DIR = originalAgentDir;
	if (originalMode === undefined) delete process.env.ADROUTER_CACHE_OPTIMIZER;
	else process.env.ADROUTER_CACHE_OPTIMIZER = originalMode;
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("AdRouter cache optimizer", () => {
	it("defaults safely and gives the process kill switch precedence", () => {
		const absent = { status: "absent", permissions: "unknown" } as const;
		expect(resolveCacheOptimizerMode(undefined, absent)).toMatchObject({ mode: "stats-only", source: "default" });
		expect(resolveCacheOptimizerMode("off", absent)).toMatchObject({ mode: "off", source: "environment" });
		expect(resolveCacheOptimizerMode("unexpected", absent)).toMatchObject({
			mode: "stats-only",
			source: "invalid-environment",
		});
	});

	it("persists only the selected mode with restricted permissions", () => {
		const directory = tempDirectory();
		writePersistedMode("prompt-rewrite", directory);
		expect(readPersistedMode(directory)).toMatchObject({ status: "valid", mode: "prompt-rewrite" });
		const contents = readFileSync(join(directory, "adrouter-cache-optimizer.json"), "utf8");
		expect(contents).toBe('{\n  "version": 1,\n  "mode": "prompt-rewrite"\n}\n');
		if (process.platform !== "win32") {
			expect(statSync(directory).mode & 0o077).toBe(0);
			expect(statSync(join(directory, "adrouter-cache-optimizer.json")).mode & 0o077).toBe(0);
		}
	});

	it("reports only normalized assistant usage and does not invent zero-counter telemetry", () => {
		const entries = [
			assistantEntry(400, 600, 0),
			{
				id: crypto.randomUUID(),
				parentId: null,
				timestamp: new Date().toISOString(),
				type: "custom",
				customType: "accounting-only",
				data: { privateValue: "must-not-be-read" },
			},
			assistantEntry(1_000, 0, 200),
		] as SessionEntry[];
		const totals = aggregateCacheUsage(entries);
		expect(totals).toEqual({
			requests: 2,
			hitRequests: 1,
			inputTokens: 1_400,
			cacheReadTokens: 600,
			cacheWriteTokens: 200,
			missingUsageSamples: 0,
			cacheTelemetryObserved: true,
		});
		expect(formatCacheUsage(totals)).toContain("Cache reads 27.3%");
		expect(formatCacheUsage(aggregateCacheUsage([assistantEntry(900, 0, 0)]))).toContain(
			"Cache telemetry unavailable",
		);
	});

	it("canonicalizes only the known-stable prefix and preserves dynamic bytes", () => {
		const dynamic = "<project_context>\r\nDYNAMIC\r\n</project_context>\r\nCurrent date: 2026-08-11";
		const result = optimizeDeepSeekPrompt(`Core\r\nRules\r\n${dynamic}`, {
			cwd: "/workspace",
			contextFiles: [{ path: "/workspace/AGENTS.md", content: "DYNAMIC" }],
		});
		expect(result.changed).toBe(true);
		expect(result.systemPrompt).toBe(`Core\nRules\n${dynamic}`);
		expect(result.systemPrompt.slice(result.systemPrompt.indexOf(dynamic))).toBe(dynamic);

		const custom = optimizeDeepSeekPrompt("Custom\r\nprompt", {
			cwd: "/workspace",
			customPrompt: "Custom\r\nprompt",
		});
		expect(custom).toMatchObject({ systemPrompt: "Custom\r\nprompt", changed: false, stablePrefixBytes: 0 });
	});

	it("keeps stats-only request bytes neutral and rewrites only official DeepSeek prompts", async () => {
		process.env.ADROUTER_CACHE_OPTIMIZER = "stats-only";
		let harness = extensionHarness();
		let handler = harness.handlers.get("before_agent_start")?.[0];
		expect(handler).toBeDefined();
		const event = {
			type: "before_agent_start",
			prompt: "hello",
			systemPrompt: "Core\r\nCurrent date: 2026-08-11",
			systemPromptOptions: { cwd: "/workspace" },
		};
		expect(await handler?.(event, extensionContext())).toBeUndefined();

		process.env.ADROUTER_CACHE_OPTIMIZER = "prompt-rewrite";
		harness = extensionHarness();
		handler = harness.handlers.get("before_agent_start")?.[0];
		expect(await handler?.(event, extensionContext("mimo-v2.5"))).toBeUndefined();
		expect(await handler?.(event, extensionContext())).toEqual({
			systemPrompt: "Core\nCurrent date: 2026-08-11",
		});
	});

	it("contains no provider mutation, hosted cache controls, or network hooks", () => {
		const source = readFileSync(new URL("../bundled/pi-cache-optimizer-2.8.10/index.ts", import.meta.url), "utf8");
		for (const forbidden of [
			"models.json",
			"registerProvider",
			"PI_CACHE_RETENTION",
			"before_provider_request",
			"promptCacheKey",
			"fetch(",
		]) {
			expect(source).not.toContain(forbidden);
		}
	});

	it("keeps doctor output free of paths and prompt contents", () => {
		const secretPath = "/workspace/private-user";
		const secretPrompt = "do-not-print-this-prompt";
		const resolution = resolveCacheOptimizerMode("stats-only", {
			status: "valid",
			mode: "stats-only",
			permissions: "restricted",
		});
		const report = __cacheOptimizerInternals.buildDoctorReport(resolution, extensionContext(), undefined);
		expect(report).not.toContain(secretPath);
		expect(report).not.toContain(secretPrompt);
		expect(report).toContain("Provider/model mutation: disabled");
	});
});
