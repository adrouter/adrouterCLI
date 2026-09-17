import { randomBytes } from "node:crypto";
import {
	closeSync,
	constants,
	fchmodSync,
	fsyncSync,
	fstatSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ExtensionContext } from "@adrouter/cli";
import type { ExtractedContent } from "./extract.ts";
import type { SearchResult } from "./perplexity.ts";
import { getWebSearchConfigDir } from "./utils.ts";

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_CACHE_DIR = "web-search-cache";
const FETCH_CACHE_VERSION = 1;
const CACHE_KEY_PATTERN = /^[A-Za-z0-9_-]+\.json$/;
const CACHE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_METADATA_TEXT = 8192;
const MAX_CACHE_ENTRIES = 128;
const MAX_CACHE_BYTES = 128 * 1024 * 1024;
const O_DIRECTORY = process.platform === "win32" ? 0 : (constants.O_DIRECTORY ?? 0);
const O_NOFOLLOW = process.platform === "win32" ? 0 : (constants.O_NOFOLLOW ?? 0);

export interface QueryResultData {
	query: string;
	answer: string;
	results: SearchResult[];
	error: string | null;
	provider?: string;
}

interface FetchCacheRef {
	version: typeof FETCH_CACHE_VERSION;
	key: string;
	storedAt: number;
}

interface StoredFetchUrlMetadata {
	url: string;
	title: string;
	error: string | null;
	contentLength: number;
	mimeType?: string;
	status?: number;
	duration?: number;
}

export interface StoredSearchData {
	id: string;
	type: "search" | "fetch";
	timestamp: number;
	queries?: QueryResultData[];
	urls?: ExtractedContent[];
	fetchCache?: FetchCacheRef;
	urlMetadata?: StoredFetchUrlMetadata[];
	fetchCacheError?: string;
}

interface CacheFile {
	name: string;
	size: number;
	mtimeMs: number;
}

const storedResults = new Map<string, StoredSearchData>();

export function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getFetchCacheDir(): string {
	return join(getWebSearchConfigDir(), FETCH_CACHE_DIR);
}

function cachePath(key: string): string | null {
	return CACHE_KEY_PATTERN.test(key) ? join(getFetchCacheDir(), key) : null;
}

function enforceMode(fd: number, mode: number): void {
	try {
		fchmodSync(fd, mode);
	} catch (error) {
		if (process.platform !== "win32") throw error;
	}
}

function secureCacheDirectory(create: boolean): string | null {
	const directory = getFetchCacheDir();
	if (create) mkdirSync(directory, { recursive: true, mode: 0o700 });
	let before;
	try {
		before = lstatSync(directory);
	} catch (error) {
		if (!create && (error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	if (before.isSymbolicLink() || !before.isDirectory()) {
		throw new Error("Fetched content cache path is not a safe directory");
	}
	if (process.platform === "win32") return directory;
	const fd = openSync(directory, constants.O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
	try {
		const opened = fstatSync(fd);
		if (!opened.isDirectory() || opened.dev !== before.dev || opened.ino !== before.ino) {
			throw new Error("Fetched content cache directory changed while opening");
		}
		enforceMode(fd, 0o700);
	} finally {
		closeSync(fd);
	}
	return directory;
}

function truncate(value: string | undefined): string {
	if (!value) return "";
	return value.length > MAX_METADATA_TEXT ? `${value.slice(0, MAX_METADATA_TEXT)}...` : value;
}

function metadataFor(urls: ExtractedContent[]): StoredFetchUrlMetadata[] {
	return urls.map((item) => ({
		url: truncate(item.url),
		title: truncate(item.title),
		error: item.error ? truncate(item.error) : null,
		contentLength: item.content.length,
		...(typeof item.duration === "number" ? { duration: item.duration } : {}),
	}));
}

function pruneCache(now = Date.now(), reservedBytes = 0, preferredKey?: string): void {
	const directory = secureCacheDirectory(false);
	if (!directory) return;
	const files: CacheFile[] = [];
	for (const name of readdirSync(directory)) {
		if (!CACHE_KEY_PATTERN.test(name)) continue;
		const path = join(directory, name);
		let info;
		try {
			info = lstatSync(path);
			if (info.isSymbolicLink() || !info.isFile()) continue;
			if (now - info.mtimeMs >= CACHE_TTL_MS) {
				unlinkSync(path);
				continue;
			}
			files.push({ name, size: info.size, mtimeMs: info.mtimeMs });
		} catch {}
	}
	files.sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));
	let bytes = files.reduce((total, file) => total + file.size, reservedBytes);
	let count = files.length + (preferredKey && !files.some((file) => file.name === preferredKey) ? 1 : 0);
	for (const file of files) {
		if (count <= MAX_CACHE_ENTRIES && bytes <= MAX_CACHE_BYTES) break;
		if (file.name === preferredKey) continue;
		try {
			unlinkSync(join(directory, file.name));
			bytes -= file.size;
			count -= 1;
		} catch {}
	}
	if (count > MAX_CACHE_ENTRIES || bytes > MAX_CACHE_BYTES) {
		throw new Error("Fetched content cache could not meet its limits");
	}
}

function writeFetchCache(data: StoredSearchData & { urls: ExtractedContent[] }): FetchCacheRef {
	if (!CACHE_ID_PATTERN.test(data.id)) throw new Error(`Invalid fetched content cache id: ${data.id}`);
	const serialized = JSON.stringify(data);
	const bytes = Buffer.byteLength(serialized);
	if (bytes > MAX_CACHE_BYTES) throw new Error(`Fetched content cache entry exceeds ${MAX_CACHE_BYTES} bytes`);
	const directory = secureCacheDirectory(true)!;
	const key = `${data.id}.json`;
	pruneCache(Date.now(), bytes, key);
	const finalPath = join(directory, key);
	const tempPath = `${finalPath}.${process.pid}.${Date.now()}.${randomBytes(16).toString("hex")}.tmp`;
	let fd: number | null = null;
	try {
		fd = openSync(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | O_NOFOLLOW, 0o600);
		enforceMode(fd, 0o600);
		writeFileSync(fd, serialized, "utf8");
		fsyncSync(fd);
		closeSync(fd);
		fd = null;
		secureCacheDirectory(false);
		renameSync(tempPath, finalPath);
		const written = lstatSync(finalPath);
		if (written.isSymbolicLink() || !written.isFile()) throw new Error("Fetched content cache entry is unsafe");
		pruneCache(Date.now(), 0, key);
	} catch (error) {
		if (fd !== null) try { closeSync(fd); } catch {}
		try { unlinkSync(tempPath); } catch {}
		throw error;
	}
	return { version: FETCH_CACHE_VERSION, key, storedAt: Date.now() };
}

function unavailable(data: StoredSearchData, reason: string): StoredSearchData {
	return {
		...data,
		urls: (data.urlMetadata ?? []).map((item) => ({
			url: item.url,
			title: item.title,
			content: "",
			error: reason,
			...(item.mimeType ? { mimeType: item.mimeType } : {}),
			...(typeof item.status === "number" ? { status: item.status } : {}),
			...(typeof item.duration === "number" ? { duration: item.duration } : {}),
		})),
	};
}

function readFetchCache(data: StoredSearchData): StoredSearchData {
	if (data.type !== "fetch" || data.urls) return data;
	if (Date.now() - data.timestamp >= CACHE_TTL_MS) return unavailable(data, "Cached fetched content is missing or expired");
	if (!data.fetchCache) return unavailable(data, data.fetchCacheError ?? "Cached fetched content is unavailable");
	const path = cachePath(data.fetchCache.key);
	if (!path) return unavailable(data, "Cached fetched content is invalid");
	let fd: number | null = null;
	try {
		if (!secureCacheDirectory(false)) throw new Error("missing cache directory");
		const before = lstatSync(path);
		if (before.isSymbolicLink() || !before.isFile()) throw new Error("unsafe cache entry");
		fd = openSync(path, constants.O_RDONLY | O_NOFOLLOW);
		const opened = fstatSync(fd);
		if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) throw new Error("cache entry changed while opening");
		if (opened.size > MAX_CACHE_BYTES) throw new Error("cache entry exceeds the configured size limit");
		enforceMode(fd, 0o600);
		const parsed = JSON.parse(readFileSync(fd, "utf8")) as unknown;
		if (!isValidStoredData(parsed) || parsed.type !== "fetch" || parsed.id !== data.id || !parsed.urls) {
			throw new Error("invalid cache entry");
		}
		return { ...parsed, fetchCache: data.fetchCache, urlMetadata: data.urlMetadata };
	} catch (error) {
		return unavailable(data, `Cached fetched content could not be read: ${error instanceof Error ? error.message : String(error)}`);
	} finally {
		if (fd !== null) try { closeSync(fd); } catch {}
	}
}

function pruneExpiredMemory(now = Date.now()): void {
	for (const [id, data] of storedResults) {
		if (now - data.timestamp >= CACHE_TTL_MS) storedResults.delete(id);
	}
}

export function storeResult(id: string, data: StoredSearchData): StoredSearchData {
	pruneExpiredMemory();
	if (data.type !== "fetch" || !data.urls) {
		storedResults.set(id, data);
		return data;
	}
	let fetchCache: FetchCacheRef | undefined;
	let fetchCacheError: string | undefined;
	try {
		fetchCache = writeFetchCache(data as StoredSearchData & { urls: ExtractedContent[] });
	} catch (error) {
		fetchCacheError = `Failed to write fetched content cache: ${error instanceof Error ? error.message : String(error)}`;
	}
	const urlMetadata = metadataFor(data.urls);
	storedResults.set(id, { ...data, fetchCache, urlMetadata, fetchCacheError });
	return { id: data.id, type: "fetch", timestamp: data.timestamp, urlMetadata, fetchCache, fetchCacheError };
}

export function getResult(id: string): StoredSearchData | null {
	const data = storedResults.get(id);
	if (!data) return null;
	const loaded = readFetchCache(data);
	if (loaded !== data) storedResults.set(id, loaded);
	return loaded;
}

export function getAllResults(): StoredSearchData[] {
	pruneExpiredMemory();
	return Array.from(storedResults.values());
}

export function deleteResult(id: string): boolean {
	const data = storedResults.get(id);
	if (data?.fetchCache) {
		const path = cachePath(data.fetchCache.key);
		if (path) try { unlinkSync(path); } catch {}
	}
	return storedResults.delete(id);
}

export function clearResults(): void {
	storedResults.clear();
}

function isValidStoredData(data: unknown): data is StoredSearchData {
	if (!data || typeof data !== "object" || Array.isArray(data)) return false;
	const value = data as Record<string, unknown>;
	if (typeof value.id !== "string" || !value.id || (value.type !== "search" && value.type !== "fetch")) return false;
	if (typeof value.timestamp !== "number" || !Number.isFinite(value.timestamp)) return false;
	if (value.type === "search") return Array.isArray(value.queries);
	if (Array.isArray(value.urls)) return true;
	if (!Array.isArray(value.urlMetadata)) return false;
	if (value.fetchCache === undefined) return typeof value.fetchCacheError === "string";
	const ref = value.fetchCache as Record<string, unknown>;
	return ref?.version === FETCH_CACHE_VERSION && typeof ref.key === "string" && CACHE_KEY_PATTERN.test(ref.key);
}

export function restoreFromSession(ctx: ExtensionContext): void {
	storedResults.clear();
	const now = Date.now();
	try { pruneCache(now); } catch {}
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === "web-search-results" && isValidStoredData(entry.data)) {
			if (now - entry.data.timestamp < CACHE_TTL_MS) storedResults.set(entry.data.id, entry.data);
		}
	}
}
