#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { assertAdRouterOfflineModelList, verifyInstalledRuntime } from "./verify-installed-runtime.mjs";

const PACKAGE_NAME = "@adrouter/cli";
const REGISTRY_URL = "https://registry.npmjs.org/";
const supportedArguments = new Set(["--if-published", "--tarball-only"]);
for (const argument of process.argv.slice(2)) {
	if (!supportedArguments.has(argument)) throw new Error(`Unsupported argument: ${argument}`);
}
const ifPublished = process.argv.includes("--if-published");
const expectedVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const root = mkdtempSync(join(tmpdir(), "adrouter-registry-install-"));
const prefix = join(root, "prefix");
const isolatedHome = join(root, "home");
const userConfig = join(root, "anonymous.npmrc");
writeFileSync(userConfig, `registry=${REGISTRY_URL}\n`, { mode: 0o600 });

const isWindows = process.platform === "win32";
const tarballOnly = isWindows || process.argv.includes("--tarball-only");
const npm = { command: "npm", args: [] };
const binDirectory = isWindows ? prefix : join(prefix, "bin");
const packageRoot = isWindows
	? join(prefix, "node_modules", "@adrouter", "cli")
	: join(prefix, "lib", "node_modules", "@adrouter", "cli");
const env = {
	...process.env,
	ADROUTER_API_KEY: "offline-catalog-fixture",
	ADROUTER_API_URL: "http://127.0.0.1:1",
	ADROUTER_CODING_AGENT_DIR: join(root, "state"),
	HOME: isolatedHome,
	NPM_CONFIG_PREFIX: prefix,
	NPM_CONFIG_USERCONFIG: userConfig,
	npm_config_prefix: prefix,
	npm_config_userconfig: userConfig,
	PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
	PI_NO_LOCAL_LLM: "1",
	USERPROFILE: isolatedHome,
};
for (const name of Object.keys(env)) {
	if (/^(?:NODE_AUTH_TOKEN|NPM_TOKEN)$/i.test(name) || /^NPM_CONFIG_.*AUTH/i.test(name)) delete env[name];
}

function executable(name) {
	return isWindows ? join(prefix, `${name}.cmd`) : join(prefix, "bin", name);
}

function run(command, args, timeout = 45_000, stdio = "pipe") {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: "utf8",
		env,
		stdio,
		timeout,
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed (status ${result.status}, signal ${result.signal ?? "none"}, error ${
				result.error?.message ?? "none"
			})\nSTDOUT:\n${result.stdout ?? ""}\nSTDERR:\n${result.stderr ?? ""}`,
		);
	}
	return result.stdout ?? "";
}

function runNpm(args, timeout, stdio) {
	return run(npm.command, [...npm.args, ...args], timeout, stdio);
}

function verifyIntegrity(bytes, integrity) {
	for (const candidate of integrity.trim().split(/\s+/)) {
		const separator = candidate.indexOf("-");
		if (separator < 1) continue;
		const algorithm = candidate.slice(0, separator);
		const expected = candidate.slice(separator + 1);
		if (!["sha1", "sha256", "sha384", "sha512"].includes(algorithm)) continue;
		if (createHash(algorithm).update(bytes).digest("base64") === expected) return;
	}
	throw new Error(`Registry tarball did not match its published integrity for ${PACKAGE_NAME}@${expectedVersion}`);
}

async function downloadRegistryTarball() {
	console.log(`Resolving ${PACKAGE_NAME}@${expectedVersion} anonymously from ${REGISTRY_URL}`);
	const metadataResponse = await fetch(`${REGISTRY_URL}${encodeURIComponent(PACKAGE_NAME)}`, {
		headers: { accept: "application/json" },
		signal: AbortSignal.timeout(120_000),
	});
	if (!metadataResponse.ok) {
		throw new Error(`Registry metadata request failed: ${metadataResponse.status} ${metadataResponse.statusText}`);
	}
	const metadata = await metadataResponse.json();
	const release = metadata.versions?.[expectedVersion];
	if (!release) {
		if (ifPublished) {
			console.log(`${PACKAGE_NAME}@${expectedVersion} is not published yet; skipping the optional CI registry check.`);
			return undefined;
		}
		throw new Error(`Registry metadata is missing ${PACKAGE_NAME}@${expectedVersion}`);
	}
	const tarballUrl = release.dist?.tarball;
	const integrity = release.dist?.integrity;
	if (typeof tarballUrl !== "string" || !tarballUrl.startsWith(REGISTRY_URL)) {
		throw new Error(`Registry metadata has an invalid tarball URL for ${PACKAGE_NAME}@${expectedVersion}`);
	}
	if (typeof integrity !== "string" || integrity.trim() === "") {
		throw new Error(`Registry metadata is missing integrity for ${PACKAGE_NAME}@${expectedVersion}`);
	}

	console.log(`Downloading the published tarball for ${PACKAGE_NAME}@${expectedVersion}`);
	const tarballResponse = await fetch(tarballUrl, { signal: AbortSignal.timeout(180_000) });
	if (!tarballResponse.ok) {
		throw new Error(`Registry tarball request failed: ${tarballResponse.status} ${tarballResponse.statusText}`);
	}
	const bytes = Buffer.from(await tarballResponse.arrayBuffer());
	verifyIntegrity(bytes, integrity);
	if (typeof release.dist.shasum === "string") {
		const actualShasum = createHash("sha1").update(bytes).digest("hex");
		if (actualShasum !== release.dist.shasum) {
			throw new Error(`Registry tarball did not match its published shasum for ${PACKAGE_NAME}@${expectedVersion}`);
		}
	}
	const tarballPath = join(root, `adrouter-cli-${expectedVersion}.tgz`);
	writeFileSync(tarballPath, bytes, { mode: 0o600 });
	console.log(`Verified registry integrity for ${PACKAGE_NAME}@${expectedVersion}`);
	return tarballPath;
}

async function withTimeout(promise, label, timeout) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeout}ms`)), timeout);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

function verifyDownloadedTarball(tarballPath) {
	const extractRoot = join(root, "registry-tarball");
	mkdirSync(extractRoot, { recursive: true });
	run("tar", ["-xzf", tarballPath, "-C", extractRoot], 120_000);
	const extractedPackageRoot = join(extractRoot, "package");
	const manifest = JSON.parse(readFileSync(join(extractedPackageRoot, "package.json"), "utf8"));
	if (manifest.version !== expectedVersion) {
		throw new Error(`Registry tarball metadata is ${manifest.version}, expected ${expectedVersion}`);
	}
	if (manifest.bin?.adrouter !== "dist/cli.js" || manifest.bin?.["adrouter-profile"] !== "dist/profile-cli.js") {
		throw new Error(`Registry tarball is missing the expected command entries for ${PACKAGE_NAME}@${expectedVersion}`);
	}

	for (const resource of [
		"BUNDLED_SOURCES.json",
		"THIRD_PARTY_NOTICES.md",
		join("dist", "cli.js"),
		join("dist", "profile-cli.js"),
		join("dist", "bundled", "pi-subagents-0.30.0", "src", "extension", "index.ts"),
		join("dist", "bundled", "pi-cache-optimizer-2.6.16", "index.ts"),
		join("dist", "bundled", "pi-opencode-bridge-0.2.1", "index.ts"),
		join("dist", "bundled", "btw-23017e9", "index.ts"),
		join("dist", "bundled", "pi-web-access-0.13.0", "dist", "index.js"),
	]) {
		const path = join(extractedPackageRoot, resource);
		if (!existsSync(path)) throw new Error(`Registry tarball resource is missing: ${path}`);
	}

	for (const name of ["@adrouter/ai", "@adrouter/tui", "@adrouter/agent-core"]) {
		const dependencyRoot = join(extractedPackageRoot, "node_modules", ...name.split("/"));
		const stat = lstatSync(dependencyRoot);
		if (!stat.isDirectory() || stat.isSymbolicLink()) {
			throw new Error(`${name} must be a real nested package directory in the registry tarball`);
		}
		const dependencyManifest = JSON.parse(readFileSync(join(dependencyRoot, "package.json"), "utf8"));
		if (dependencyManifest.version !== expectedVersion) {
			throw new Error(`${name}@${dependencyManifest.version} does not match ${expectedVersion}`);
		}
	}

	console.log(
		`Anonymous registry tarball verified ${PACKAGE_NAME}@${expectedVersion}, both command entries, all bundled extensions, and private dependencies.`,
	);
}

async function installCandidate() {
	const target = await downloadRegistryTarball();
	if (!target) return false;
	if (tarballOnly) {
		verifyDownloadedTarball(target);
		return false;
	}
	console.log(`Installing ${PACKAGE_NAME}@${expectedVersion} into an isolated global prefix`);
	runNpm(
		[
			"install",
			"--global",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--registry",
			REGISTRY_URL,
			"--min-release-age=0",
			target,
		],
		600_000,
		"inherit",
	);
	console.log(`Installed ${PACKAGE_NAME}@${expectedVersion}; verifying packaged runtime`);
	return true;
}

function runInstalled(name, entrypoint, args) {
	return isWindows
		? run(process.execPath, [join(packageRoot, entrypoint), ...args])
		: run(executable(name), args);
}

async function verifyInstalledCandidate() {
	const adrouter = executable("adrouter");
	const profile = executable("adrouter-profile");
	for (const path of [adrouter, profile]) {
		if (!existsSync(path)) throw new Error(`Expected installed command is missing: ${path}`);
	}

	if (!isWindows) {
		const version = runInstalled("adrouter", join("dist", "cli.js"), ["--version"]).trim();
		if (version !== expectedVersion) throw new Error(`adrouter --version returned ${version}, expected ${expectedVersion}`);
		if (!runInstalled("adrouter", join("dist", "cli.js"), ["--help"]).includes("Usage:")) {
			throw new Error("adrouter --help did not contain Usage:");
		}
		runInstalled("adrouter-profile", join("dist", "profile-cli.js"), ["list"]);
		const doctor = JSON.parse(runInstalled("adrouter", join("dist", "cli.js"), ["--json", "doctor"]));
		if (!doctor || typeof doctor !== "object") throw new Error("adrouter --json doctor did not return a JSON object");
		if (doctor.installation?.kind !== "packaged" || doctor.installation?.deployable !== true) {
			throw new Error(`Installed doctor rejected the package: ${JSON.stringify(doctor.installation)}`);
		}
		assertAdRouterOfflineModelList(
			runInstalled("adrouter", join("dist", "cli.js"), [
				"--offline",
				"--no-approve",
				"--list-models",
				"adrouter",
			]),
		);
	}

	for (const resource of [
		"package.json",
		"BUNDLED_SOURCES.json",
		"THIRD_PARTY_NOTICES.md",
		join("dist", "cli.js"),
		join("dist", "profile-cli.js"),
		join("dist", "modes", "interactive", "theme", "dark.json"),
		join("node_modules", "@adrouter", "ai", "dist", "index.js"),
		join("node_modules", "@adrouter", "tui", "dist", "index.js"),
		join("node_modules", "@adrouter", "agent-core", "dist", "index.js"),
	]) {
		const path = join(packageRoot, resource);
		if (!existsSync(path)) throw new Error(`Installed package resource is missing: ${path}`);
	}
	const installedVersion = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version;
	if (installedVersion !== expectedVersion) {
		throw new Error(`Installed package metadata is ${installedVersion}, expected ${expectedVersion}`);
	}
	if (!isWindows) {
		const dependencyTree = JSON.parse(runNpm(["ls", "--global", "--all", "--json", "--prefix", prefix]));
		if (dependencyTree.problems?.length) {
			throw new Error(`Global dependency tree is invalid: ${dependencyTree.problems.join(", ")}`);
		}
		runInstalled("adrouter-profile", join("dist", "profile-cli.js"), [
			"set",
			"registry-ci",
			"--provider",
			"adrouter",
			"--model",
			"deepseek-v4-flash",
		]);
		if (!runInstalled("adrouter-profile", join("dist", "profile-cli.js"), ["list"]).includes("registry-ci")) {
			throw new Error("Installed profile listing failed");
		}
		runInstalled("adrouter-profile", join("dist", "profile-cli.js"), [
			"apply",
			"registry-ci",
			"--cwd",
			root,
			"--no-launch",
		]);
		runInstalled("adrouter-profile", join("dist", "profile-cli.js"), ["restore", "--cwd", root]);
	}
	await withTimeout(
		verifyInstalledRuntime({
			packageRoot,
			project: root,
			agentDir: join(root, "state"),
			expectedVersion,
		}),
		"Installed runtime verification",
		300_000,
	);

	console.log(
		`Anonymous registry install verified bundled ${PACKAGE_NAME}@${expectedVersion} and both commands.`,
	);
}

let failure;
try {
	if (await installCandidate()) await verifyInstalledCandidate();
} catch (error) {
	failure = error;
	console.error(error instanceof Error ? (error.stack ?? error.message) : error);
} finally {
	try {
		rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
	} catch (error) {
		console.warn(`Could not remove isolated registry-install directory ${root}: ${error.message}`);
	}
}

// Imported packaged modules can retain Windows event-loop handles after every
// verification has passed or timed out. Exit explicitly on both paths.
process.exit(failure ? 1 : 0);
