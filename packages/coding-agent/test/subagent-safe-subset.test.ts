// @ts-nocheck -- vendored TypeScript is exercised through the runtime loader, not the host build graph.
import { existsSync, lstatSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirectories: string[] = [];

function loadBundled(relativePath: string) {
	return import(new URL(`../bundled/pi-subagents-0.68.0/${relativePath}`, import.meta.url).href);
}

function tempDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "adrouter-subagent-safe-subset-"));
	tempDirectories.push(directory);
	return directory;
}

afterEach(() => {
	delete process.env.ADROUTER_SUBAGENTS;
	delete process.env.PI_SUBAGENT_MAX_DEPTH;
	for (const directory of tempDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("AdRouter pi-subagents safe subset", () => {
	it("starts maintenance once per session and clears it on shutdown", async () => {
		const { createSessionMaintenanceLifecycle } = await loadBundled("src/extension/session-maintenance.ts");
		const calls: string[] = [];
		const lifecycle = createSessionMaintenanceLifecycle({
			startWatcher: () => calls.push("start"),
			primeResults: () => calls.push("prime"),
			stopWatcher: () => calls.push("stop"),
			clearTimers: () => calls.push("clear"),
		});

		lifecycle.start();
		lifecycle.start();
		lifecycle.stop();
		lifecycle.stop();
		lifecycle.start();
		expect(calls).toEqual(["start", "prime", "stop", "clear", "start", "prime"]);
	});

	it("forces depth-one, three-child, and no-intercom/worktree configuration", async () => {
		const { applyAdRouterSubagentPolicy } = await loadBundled("src/extension/config.ts");
		const {
			DEFAULT_SUBAGENT_MAX_DEPTH,
			resolveCurrentMaxSubagentDepth,
			resolveTopLevelParallelConcurrency,
			resolveTopLevelParallelMaxTasks,
		} = await loadBundled("src/shared/types.ts");
		const config = applyAdRouterSubagentPolicy({
			maxSubagentDepth: 9,
			parallel: { maxTasks: 99, concurrency: 99 },
			chain: { dynamicFanout: { maxItems: 99 } },
			intercomBridge: { mode: "always" },
			worktreeSetupHook: "/tmp/unsafe.mjs",
			worktreeSetupHookTimeoutMs: 1,
			control: { notifyChannels: ["event", "intercom"] },
		});
		expect(config).toMatchObject({
			maxSubagentDepth: 1,
			parallel: { maxTasks: 3, concurrency: 3 },
			chain: { dynamicFanout: { maxItems: 3 } },
			intercomBridge: { mode: "off" },
			control: { notifyChannels: ["event"] },
		});
		expect(config.worktreeSetupHook).toBeUndefined();
		expect(config.worktreeSetupHookTimeoutMs).toBeUndefined();
		expect(DEFAULT_SUBAGENT_MAX_DEPTH).toBe(1);
		process.env.PI_SUBAGENT_MAX_DEPTH = "25";
		expect(resolveCurrentMaxSubagentDepth(25)).toBe(1);
		expect(resolveTopLevelParallelMaxTasks(25)).toBe(3);
		expect(resolveTopLevelParallelConcurrency(25, 25)).toBe(3);
	});

	it("exposes only the reviewed management and static execution schema", async () => {
		const { SubagentParams } = await loadBundled("src/extension/schemas.ts");
		const { SUBAGENT_ACTIONS } = await loadBundled("src/shared/types.ts");
		expect(SUBAGENT_ACTIONS).toEqual([
			"list",
			"get",
			"models",
			"children",
			"status",
			"interrupt",
			"stop",
			"resume",
			"doctor",
		]);
		const schema = SubagentParams as unknown as {
			properties: Record<string, unknown>;
		};
		expect(schema.properties).not.toHaveProperty("config");
		expect(schema.properties).not.toHaveProperty("worktree");
		expect(schema.properties).not.toHaveProperty("share");
		const chain = schema.properties.chain as {
			items: { properties: Record<string, unknown> };
		};
		expect(chain.items.properties).not.toHaveProperty("expand");
		expect(chain.items.properties).not.toHaveProperty("collect");
		expect(chain.items.properties).not.toHaveProperty("worktree");
	});

	it("isolates child extensions, nested delegation, MCP tools, ambient secrets, and sponsor controls", async () => {
		const { buildAdRouterChildProcessEnv, buildPiArgs, cleanupTempDir } =
			await loadBundled("src/runs/shared/pi-args.ts");
		const built = buildPiArgs({
			baseArgs: ["--mode", "json", "-p"],
			task: "Inspect the repository",
			sessionEnabled: false,
			inheritProjectContext: true,
			inheritSkills: false,
			tools: ["read", "grep", "subagent", "/tmp/unreviewed-tool.ts"],
			extensions: ["/tmp/unreviewed-extension.ts"],
			subagentOnlyExtensions: ["/tmp/child-only.ts"],
			mcpDirectTools: ["private-server/tool"],
		});
		try {
			expect(built.args).toContain("--no-extensions");
			expect(built.args.filter((arg) => arg === "--extension")).toHaveLength(1);
			expect(built.args.join(" ")).toContain("subagent-prompt-runtime.ts");
			expect(built.args.join(" ")).not.toContain("unreviewed");
			expect(built.args.join(" ")).not.toContain("child-only");
			expect(built.args).toContain("read,grep");
			expect(built.env).toMatchObject({
				ADROUTER_BUNDLED_FEATURES: "off",
				MCP_DIRECT_TOOLS: "__none__",
				PI_SUBAGENT_FANOUT_CHILD: "0",
				PI_SUBAGENT_PARENT_EVENT_SINK: "",
			});

			const childEnv = buildAdRouterChildProcessEnv(
				{ ...built.env, PI_SUBAGENT_DEPTH: "1" },
				{
					PATH: "/usr/bin",
					ADROUTER_CODING_AGENT_DIR: "/tmp/adrouter-agent",
					ADROUTER_API_KEY: "secret",
					OPENAI_API_KEY: "secret",
					ADROUTER_AD_MODE: "on",
					NODE_OPTIONS: "--require=/tmp/untrusted.cjs",
				},
			);
			expect(childEnv.PATH).toBe("/usr/bin");
			expect(childEnv.ADROUTER_CODING_AGENT_DIR).toBe("/tmp/adrouter-agent");
			expect(childEnv.PI_SUBAGENT_DEPTH).toBe("1");
			expect(childEnv.ADROUTER_API_KEY).toBeUndefined();
			expect(childEnv.OPENAI_API_KEY).toBeUndefined();
			expect(childEnv.ADROUTER_AD_MODE).toBeUndefined();
			expect(childEnv.NODE_OPTIONS).toBeUndefined();
		} finally {
			cleanupTempDir(built.tempDir);
		}
	});

	it("permits only one mutation-capable child in each parallel group", async () => {
		const { validateAdRouterParallelPolicy } = await loadBundled("src/runs/foreground/subagent-executor.ts");
		const agents = [
			{ name: "reader-a", tools: ["read", "grep"] },
			{ name: "reader-b", tools: ["find", "ls"] },
			{ name: "writer", tools: ["read", "write"] },
			{ name: "shell", tools: ["read", "bash"] },
		] as never;
		expect(
			validateAdRouterParallelPolicy(
				{
					tasks: [
						{ agent: "reader-a", task: "A" },
						{ agent: "reader-b", task: "B" },
						{ agent: "writer", task: "C" },
					],
				},
				agents,
			),
		).toBeNull();
		const unsafe = validateAdRouterParallelPolicy(
			{
				tasks: [
					{ agent: "writer", task: "A" },
					{ agent: "shell", task: "B" },
				],
			},
			agents,
		);
		expect(unsafe?.isError).toBe(true);
		expect(unsafe?.content[0]).toMatchObject({ type: "text" });
		expect((unsafe?.content[0] as { text?: string }).text).toContain("at most one mutation-capable child");
	});

	it("uses private one-shot stop requests and refuses symbolic-link targets", async () => {
		const { consumeAsyncStop, requestAsyncStop, stopRequestPath } = await loadBundled(
			"src/runs/background/stop-control.ts",
		);
		const runDirectory = tempDirectory();
		requestAsyncStop(runDirectory, () => 1234);
		const requestPath = stopRequestPath(runDirectory);
		expect(existsSync(requestPath)).toBe(true);
		if (process.platform !== "win32") {
			expect(statSync(join(runDirectory, "control")).mode & 0o077).toBe(0);
			expect(statSync(requestPath).mode & 0o077).toBe(0);
		}
		expect(consumeAsyncStop(runDirectory)).toBe(true);
		expect(consumeAsyncStop(runDirectory)).toBe(false);

		if (process.platform !== "win32") {
			const target = join(runDirectory, "target.json");
			writeFileSync(target, "{}\n");
			symlinkSync(target, requestPath);
			expect(lstatSync(requestPath).isSymbolicLink()).toBe(true);
			expect(() => requestAsyncStop(runDirectory)).toThrow(/symbolic-link/);
		}
	});

	it("interrupts every live child in a parallel run", async () => {
		const { createInterruptRegistry } = await loadBundled("src/runs/background/interrupt-registry.ts");
		const registry = createInterruptRegistry();
		const calls: string[] = [];
		const registerA = registry.createRegistrar();
		const registerB = registry.createRegistrar();
		registerA(() => calls.push("a"));
		registerB(() => calls.push("b"));
		expect(registry.size()).toBe(2);
		expect(registry.interruptAll()).toBe(2);
		expect(calls.sort()).toEqual(["a", "b"]);
		registerA(undefined);
		expect(registry.size()).toBe(1);
	});

	it("keeps stable disabled contracts without executing the runtime", async () => {
		const { default: registerSubagents } = await loadBundled("src/extension/index.ts");
		process.env.ADROUTER_SUBAGENTS = "off";
		const commands: string[] = [];
		const handlers: string[] = [];
		let tool: { execute: () => Promise<{ isError?: boolean; content: Array<{ text: string }> }> } | undefined;
		registerSubagents({
			registerTool: (definition: typeof tool) => {
				tool = definition;
			},
			registerCommand: (name: string) => {
				commands.push(name);
			},
			on: (event: string) => {
				handlers.push(event);
			},
		} as never);

		expect(commands.sort()).toEqual([
			"chain",
			"parallel",
			"run",
			"run-chain",
			"subagents-doctor",
			"subagents-interrupt",
			"subagents-resume",
			"subagents-status",
			"subagents-stop",
		]);
		expect(handlers.sort()).toEqual(["session_shutdown", "session_start", "tool_result"]);
		const result = await tool?.execute();
		expect(result?.isError).toBe(true);
		expect(result?.content[0]?.text).toContain("ADROUTER_SUBAGENTS=off");
	});
});
