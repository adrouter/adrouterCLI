#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { verifyInstalledRuntime } from "./verify-installed-runtime.mjs";

const expectedVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const root = mkdtempSync(join(tmpdir(), "adrouter-registry-install-"));
const prefix = join(root, "prefix");
const isolatedHome = join(root, "home");
const userConfig = join(root, "anonymous.npmrc");
writeFileSync(userConfig, "registry=https://registry.npmjs.org/\nalways-auth=false\n", { mode: 0o600 });

const isWindows = process.platform === "win32";
const npm =
	isWindows
		? {
				command: process.execPath,
				args: [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")],
			}
		: { command: "npm", args: [] };
const binDirectory = isWindows ? prefix : join(prefix, "bin");
const packageRoot = isWindows
	? join(prefix, "node_modules", "@adrouter", "cli")
	: join(prefix, "lib", "node_modules", "@adrouter", "cli");
const env = {
	...process.env,
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

function run(command, args, timeout = 45_000) {
	const result = spawnSync(command, args, {
		cwd: root,
		encoding: "utf8",
		env,
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

function runNpm(args, timeout) {
	return run(npm.command, [...npm.args, ...args], timeout);
}

function windowsInstallReady() {
	for (const path of [
		executable("adrouter"),
		executable("adrouter-profile"),
		join(packageRoot, "package.json"),
		join(packageRoot, "dist", "cli.js"),
		join(packageRoot, "dist", "profile-cli.js"),
		join(packageRoot, "node_modules", "@adrouter", "ai", "dist", "index.js"),
		join(packageRoot, "node_modules", "@adrouter", "tui", "dist", "index.js"),
		join(packageRoot, "node_modules", "@adrouter", "agent-core", "dist", "index.js"),
	]) {
		if (!existsSync(path)) return false;
	}
	try {
		return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version === expectedVersion;
	} catch {
		return false;
	}
}

async function installWithNpm(args, timeout) {
	if (!isWindows) {
		runNpm(args, timeout);
		return;
	}

	await new Promise((resolve, reject) => {
		const child = spawn(npm.command, [...npm.args, ...args], {
			cwd: root,
			env,
			stdio: "ignore",
			windowsHide: true,
		});
		child.unref();
		let settled = false;
		let readyChecks = 0;
		let readiness;
		let timer;
		const finish = (error) => {
			if (settled) return;
			settled = true;
			clearInterval(readiness);
			clearTimeout(timer);
			if (error) reject(error);
			else resolve();
		};
		readiness = setInterval(() => {
			readyChecks = windowsInstallReady() ? readyChecks + 1 : 0;
			if (readyChecks < 2) return;
			child.kill();
			finish();
		}, 1_000);
		timer = setTimeout(() => {
			child.kill();
			finish(new Error(`npm install timed out after ${timeout}ms`));
		}, timeout);
		child.once("error", (error) => {
			finish(error);
		});
		child.once("exit", (code, signal) => {
			if (code === 0) finish();
			else finish(new Error(`npm install failed (status ${code}, signal ${signal ?? "none"})`));
		});
	});
}

function runInstalled(name, entrypoint, args) {
	return isWindows
		? run(process.execPath, [join(packageRoot, entrypoint), ...args])
		: run(executable(name), args);
}

try {
	await installWithNpm(
		[
			"install",
			"--global",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--registry",
			"https://registry.npmjs.org/",
			"--min-release-age=0",
			`@adrouter/cli@${expectedVersion}`,
		],
		600_000,
	);

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
		runInstalled("adrouter", join("dist", "cli.js"), ["--offline", "--no-approve", "--list-models", "adrouter"]);
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
	await verifyInstalledRuntime({
		packageRoot,
		project: root,
		agentDir: join(root, "state"),
		expectedVersion,
	});

	console.log(
		`Anonymous registry install verified bundled @adrouter/cli@${expectedVersion} and both ${
			isWindows ? "Windows command shims" : "commands"
		}.`,
	);
} finally {
	try {
		rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
	} catch (error) {
		console.warn(`Could not remove isolated registry-install directory ${root}: ${error.message}`);
	}
}

// Imported packaged modules can retain Windows event-loop handles after every
// verification has passed. Exit explicitly only on the successful path; thrown
// verification errors bypass this statement and retain their nonzero exit.
process.exit(0);
