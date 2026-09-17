import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readResponseBufferWithLimit } from "../bundled/pi-web-access-0.29.0/extract.ts";
import {
	clearResults,
	getFetchCacheDir,
	getResult,
	restoreFromSession,
	storeResult,
} from "../bundled/pi-web-access-0.29.0/storage.ts";
import {
	getActiveWebProxy,
	normalizeWebProxyUrl,
	runWithWebProxy,
} from "../bundled/pi-web-access-0.29.0/utils.ts";

const originalAgentDir = process.env.ADROUTER_CODING_AGENT_DIR;
const temporaryDirectories = [];

afterEach(() => {
	clearResults();
	if (originalAgentDir === undefined) delete process.env.ADROUTER_CODING_AGENT_DIR;
	else process.env.ADROUTER_CODING_AGENT_DIR = originalAgentDir;
	for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("AdRouter web-access safety adaptations", () => {
	it("keeps fetched page bodies out of session JSON and restores them from a private cache", () => {
		const root = join(tmpdir(), `adrouter-web-cache-${process.pid}-${Math.random().toString(36).slice(2)}`);
		temporaryDirectories.push(root);
		mkdirSync(root, { recursive: true });
		process.env.ADROUTER_CODING_AGENT_DIR = root;
		const full = {
			id: "fetch_test",
			type: "fetch",
			timestamp: Date.now(),
			urls: [{ url: "https://example.com", title: "Example", content: "private page body", error: null }],
		};
		const sessionRecord = storeResult(full.id, full);
		expect(JSON.stringify(sessionRecord)).not.toContain("private page body");
		expect(statSync(getFetchCacheDir()).mode & 0o777).toBe(0o700);
		expect(statSync(join(getFetchCacheDir(), "fetch_test.json")).mode & 0o777).toBe(0o600);

		clearResults();
		restoreFromSession({
			sessionManager: { getBranch: () => [{ type: "custom", customType: "web-search-results", data: sessionRecord }] },
		});
		expect(getResult(full.id)?.urls?.[0]?.content).toBe("private page body");
	});

	it("enforces decoded response limits even without Content-Length", async () => {
		const response = new Response(new ReadableStream({
			start(controller) {
				controller.enqueue(new Uint8Array(4));
				controller.enqueue(new Uint8Array(4));
				controller.close();
			},
		}));
		await expect(readResponseBufferWithLimit(response, 6)).rejects.toThrow("Response too large");
	});

	it("scopes validated proxy configuration to the web operation", async () => {
		expect(normalizeWebProxyUrl("http://proxy.example:8080")).toBe("http://proxy.example:8080/");
		expect(() => normalizeWebProxyUrl("socks5://proxy.example")).toThrow("http:// or https://");
		expect(getActiveWebProxy()).toBeNull();
		await runWithWebProxy("https://proxy.example", async () => {
			expect(getActiveWebProxy()).toBe("https://proxy.example/");
			await Promise.resolve();
			expect(getActiveWebProxy()).toBe("https://proxy.example/");
		});
		expect(getActiveWebProxy()).toBeNull();
	});
});
