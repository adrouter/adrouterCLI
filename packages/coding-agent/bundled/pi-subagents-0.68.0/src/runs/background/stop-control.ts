import * as fs from "node:fs";
import * as path from "node:path";
import { writeAtomicJson } from "../../shared/atomic-json.ts";

const MAX_STOP_REQUEST_BYTES = 4_096;

export function stopRequestPath(asyncDir: string): string {
	return path.join(asyncDir, "control", "stop.json");
}

export function requestAsyncStop(asyncDir: string, now = Date.now): void {
	const controlDir = path.join(asyncDir, "control");
	fs.mkdirSync(controlDir, { recursive: true, mode: 0o700 });
	if (process.platform !== "win32") fs.chmodSync(controlDir, 0o700);
	const requestPath = stopRequestPath(asyncDir);
	if (fs.existsSync(requestPath) && fs.lstatSync(requestPath).isSymbolicLink()) {
		throw new Error("Refusing to replace a symbolic-link stop request");
	}
	writeAtomicJson(requestPath, { version: 1, type: "stop", requestedAt: now() });
	if (process.platform !== "win32") fs.chmodSync(requestPath, 0o600);
}

/** Consume one private, bounded stop request. Malformed requests are discarded and ignored. */
export function consumeAsyncStop(asyncDir: string): boolean {
	const requestPath = stopRequestPath(asyncDir);
	try {
		const metadata = fs.lstatSync(requestPath);
		if (metadata.isSymbolicLink() || metadata.size > MAX_STOP_REQUEST_BYTES) {
			fs.rmSync(requestPath, { force: true });
			return false;
		}
		const parsed = JSON.parse(fs.readFileSync(requestPath, "utf8")) as Record<string, unknown>;
		fs.rmSync(requestPath, { force: true });
		return parsed.version === 1 && parsed.type === "stop" && typeof parsed.requestedAt === "number";
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		try {
			fs.rmSync(requestPath, { force: true });
		} catch {
			// Best-effort cleanup; the next bounded poll may retry.
		}
		return false;
	}
}
