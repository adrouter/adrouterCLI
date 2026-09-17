import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ProxyAgent } from "undici";

export function getWebSearchConfigDir(): string {
	if (process.env.ADROUTER_CODING_AGENT_DIR) return process.env.ADROUTER_CODING_AGENT_DIR;
	return join(homedir(), ".adrouter", "agent");
}

export function getWebSearchConfigPath(): string {
	return join(getWebSearchConfigDir(), "web-search.json");
}

export function formatSeconds(s: number): string {
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

export function readExecError(err: unknown): { code?: string; stderr: string; message: string } {
	if (!err || typeof err !== "object") {
		return { stderr: "", message: String(err) };
	}
	const code = (err as { code?: string }).code;
	const message = (err as { message?: string }).message ?? "";
	const stderrRaw = (err as { stderr?: Buffer | string }).stderr;
	const stderr = Buffer.isBuffer(stderrRaw)
		? stderrRaw.toString("utf-8")
		: typeof stderrRaw === "string"
			? stderrRaw
			: "";
	return { code, stderr, message };
}

export function isTimeoutError(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	if ((err as { killed?: boolean }).killed) return true;
	const name = (err as { name?: string }).name;
	const code = (err as { code?: string }).code;
	const message = (err as { message?: string }).message ?? "";
	return name === "AbortError" || code === "ETIMEDOUT" || message.toLowerCase().includes("timed out");
}

export function trimErrorText(text: string): string {
	return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function mapFfmpegError(err: unknown): string {
	const { code, stderr, message } = readExecError(err);
	if (code === "ENOENT") return "ffmpeg is not installed. Install with: brew install ffmpeg";
	if (isTimeoutError(err)) return "ffmpeg timed out extracting frame";
	if (stderr.includes("403")) return "Stream URL returned 403 — may have expired, try again";
	const snippet = trimErrorText(stderr || message);
	return snippet ? `ffmpeg failed: ${snippet}` : "ffmpeg failed";
}

const proxyStorage = new AsyncLocalStorage<string | null>();
const proxyAgents = new Map<string, ProxyAgent>();

export function normalizeWebProxyUrl(value: unknown, source = "proxy"): string | null {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value !== "string") throw new Error(`${source} must be an HTTP(S) proxy URL string`);
	let parsed: URL;
	try {
		parsed = new URL(value.trim());
	} catch {
		throw new Error(`${source} must be a valid proxy URL`);
	}
	if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
		throw new Error(`${source} must use http:// or https:// and include a host`);
	}
	parsed.hash = "";
	parsed.search = "";
	return parsed.toString();
}

function loadConfiguredProxy(): string | null {
	const path = getWebSearchConfigPath();
	if (!existsSync(path)) return null;
	const raw = JSON.parse(readFileSync(path, "utf8")) as { proxy?: unknown };
	return normalizeWebProxyUrl(raw.proxy, `proxy in ${path}`);
}

export function runWithWebProxy<T>(proxy: string | undefined, fn: () => T): T {
	const normalized = proxy === undefined ? loadConfiguredProxy() : normalizeWebProxyUrl(proxy);
	return proxyStorage.run(normalized, fn);
}

export function getActiveWebProxy(): string | null {
	return proxyStorage.getStore() ?? null;
}

function noProxyMatches(hostname: string, entry: string): boolean {
	if (!entry) return false;
	if (entry === "*") return true;
	let host = entry.trim().toLowerCase();
	if (host.startsWith("[")) {
		const close = host.indexOf("]");
		if (close >= 0) host = host.slice(1, close);
	} else {
		const colon = host.lastIndexOf(":");
		if (colon > -1 && /^\d+$/.test(host.slice(colon + 1))) host = host.slice(0, colon);
	}
	host = host.replace(/^\./, "");
	return hostname === host || hostname.endsWith(`.${host}`);
}

function bypassProxy(url: URL): boolean {
	const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1") return true;
	const configured = process.env.NO_PROXY ?? process.env.no_proxy;
	return configured ? configured.split(",").some((entry) => noProxyMatches(hostname, entry)) : false;
}

interface ScopedFetch {
	(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response>;
	__adrouterWebProxyFetch?: boolean;
}

/** Route only requests made inside runWithWebProxy; all unrelated global fetch calls remain direct. */
export function installScopedWebProxyFetch(): void {
	const current = globalThis.fetch as ScopedFetch;
	if (typeof current !== "function" || current.__adrouterWebProxyFetch) return;
	const nativeFetch = current;
	const wrapped: ScopedFetch = (input, init) => {
		const proxy = getActiveWebProxy();
		if (!proxy) return nativeFetch(input, init);
		let url: URL;
		try {
			url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
		} catch {
			return nativeFetch(input, init);
		}
		if ((url.protocol !== "http:" && url.protocol !== "https:") || bypassProxy(url)) return nativeFetch(input, init);
		let dispatcher = proxyAgents.get(proxy);
		if (!dispatcher) {
			dispatcher = new ProxyAgent(proxy);
			proxyAgents.set(proxy, dispatcher);
		}
		return nativeFetch(input, { ...init, dispatcher } as unknown as RequestInit);
	};
	wrapped.__adrouterWebProxyFetch = true;
	globalThis.fetch = wrapped;
}
