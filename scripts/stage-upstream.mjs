#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
	componentById,
	readUpstreamLock,
	validateUpstreamLock,
	verifyNpmTarball,
	verifySourceArchive,
} from "./upstream-lock.mjs";

function option(name) {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

const componentId = option("--component");
const version = option("--version");
const validArgs = new Set(["--component", "--version"]);
for (let index = 2; index < process.argv.length; index += 2) {
	if (!validArgs.has(process.argv[index]) || process.argv[index + 1] === undefined) {
		console.error("Usage: node scripts/stage-upstream.mjs --component <id> --version <exact>");
		process.exit(2);
	}
}
if (!componentId || !version) {
	console.error("Usage: node scripts/stage-upstream.mjs --component <id> --version <exact>");
	process.exit(2);
}

const lock = readUpstreamLock();
const failures = validateUpstreamLock(lock);
if (failures.length > 0) throw new Error(`Invalid upstream lock: ${failures.join("; ")}`);
const component = componentById(lock, componentId);
if (!component) throw new Error(`Unknown upstream component: ${componentId}`);
if (!component.target || component.target.version !== version) {
	throw new Error(`${componentId} is frozen at ${component.target?.version ?? "no target"}; refusing ${version}`);
}

const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim();
if (dirty) throw new Error("Upstream staging requires a clean working tree");

const stagingRoot = mkdtempSync(join(tmpdir(), `adrouter-${componentId}-${version}-`));

async function download(url, label) {
	const response = await fetch(url, {
		headers: { accept: "application/octet-stream", "user-agent": "AdRouterCLI upstream staging" },
		signal: AbortSignal.timeout(120_000),
	});
	if (!response.ok) throw new Error(`${componentId}: ${label} returned HTTP ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

const sourceBytes = await download(component.target.source_url, "source archive");
verifySourceArchive(sourceBytes, component.target, componentId);
const sourceArchivePath = join(
	stagingRoot,
	basename(new URL(component.target.source_url).pathname) || `${componentId}-${version}-source.tar.gz`,
);
writeFileSync(sourceArchivePath, sourceBytes, { mode: 0o600 });

const npmBytes = await download(component.target.npm_tarball_url, "npm tarball");
verifyNpmTarball(npmBytes, component.target, componentId);
const npmArchivePath = join(
	stagingRoot,
	basename(new URL(component.target.npm_tarball_url).pathname) || `${componentId}-${version}.tgz`,
);
writeFileSync(npmArchivePath, npmBytes, { mode: 0o600 });

const extracted = join(stagingRoot, "source");
mkdirSync(extracted, { recursive: true, mode: 0o700 });
execFileSync("tar", ["-xzf", sourceArchivePath, "-C", extracted]);
console.log(`Verified ${componentId}@${version}`);
console.log(`Source archive: ${sourceArchivePath}`);
console.log(`npm tarball: ${npmArchivePath}`);
console.log(`Extracted source: ${extracted}`);
console.log("No repository files were changed.");
