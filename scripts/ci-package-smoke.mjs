#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertAdRouterOfflineModelList, verifyInstalledRuntime } from "./verify-installed-runtime.mjs";

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		env: options.env,
		shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command),
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed\n${[result.stdout, result.stderr].filter(Boolean).join("\n")}`,
		);
	}
	return result.stdout ?? "";
}

function removeTemporaryDirectory(directory) {
	rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}

const root = process.cwd();
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const smokeRoot = mkdtempSync(join(tmpdir(), "adrouter-ci-package-smoke-"));
const output = join(smokeRoot, "release");
const isolatedHome = mkdtempSync(join(tmpdir(), "adrouter-ci-home-"));
const project = mkdtempSync(join(tmpdir(), "adrouter-ci-project-"));
try {
	run(process.execPath, [
		join(root, "scripts", "local-release.mjs"),
		"--out",
		output,
		"--skip-check",
		"--skip-test",
		"--skip-binary",
		"--skip-bun-install",
		"--skip-install",
	]);
	const install = join(smokeRoot, "global-prefix");
	const binDirectory = process.platform === "win32" ? install : join(install, "bin");
	const cli = process.platform === "win32" ? join(install, "adrouter.cmd") : join(binDirectory, "adrouter");
	const profiles = process.platform === "win32" ? join(install, "adrouter-profile.cmd") : join(binDirectory, "adrouter-profile");
	const packageRoot =
		process.platform === "win32"
			? join(install, "node_modules", "@adrouter", "cli")
			: join(install, "lib", "node_modules", "@adrouter", "cli");
	const env = {
		...process.env,
		ADROUTER_API_KEY: "offline-catalog-fixture",
		ADROUTER_API_URL: "http://127.0.0.1:1",
		ADROUTER_CODING_AGENT_DIR: join(isolatedHome, ".adrouter", "agent"),
		ADROUTER_PROFILES_DIR: join(isolatedHome, ".adrouter", "profiles"),
		HOME: isolatedHome,
		NPM_CONFIG_PREFIX: install,
		PI_NO_LOCAL_LLM: "1",
		USERPROFILE: isolatedHome,
	};
	const tarball = join(output, "tarballs", `adrouter-cli-${version}.tgz`);
	run(process.platform === "win32" ? "npm.cmd" : "npm", [
		"install",
		"--global",
		"--ignore-scripts",
		"--no-audit",
		"--no-fund",
		tarball,
	], { env });

	if (run(cli, ["--version"], { capture: true, cwd: project, env }).trim() !== version) {
		throw new Error("Packaged CLI reported the wrong version");
	}
	if (!run(cli, ["--help"], { capture: true, cwd: project, env }).includes("adrouter")) {
		throw new Error("Packaged CLI help is unavailable");
	}
	const doctor = JSON.parse(run(cli, ["--json", "doctor"], { capture: true, cwd: project, env }));
	if (doctor.ok !== true || doctor.version !== version) throw new Error("Packaged doctor JSON is invalid");
	if (doctor.installation?.kind !== "packaged" || doctor.installation?.deployable !== true) {
		throw new Error(`Packaged doctor rejected the installation: ${JSON.stringify(doctor.installation)}`);
	}
	const offlineModels = run(cli, ["--offline", "--no-approve", "--list-models", "adrouter"], {
		capture: true,
		cwd: project,
		env,
	});
	assertAdRouterOfflineModelList(offlineModels);

	run(profiles, ["set", "ci", "--provider", "adrouter", "--model", "deepseek-v4-flash"], { cwd: project, env });
	if (!run(profiles, ["list"], { capture: true, cwd: project, env }).includes("ci")) {
		throw new Error("Packaged profile listing failed");
	}
	run(profiles, ["apply", "ci", "--cwd", project, "--no-launch"], { cwd: project, env });
	run(profiles, ["restore", "--cwd", project], { cwd: project, env });

	for (const resource of [
		"BUNDLED_SOURCES.json",
		"THIRD_PARTY_NOTICES.md",
		"README.md",
		"dist/bundled/adroutercli/skills/adroutercli/docs/SKILL.md",
		"dist/bundled/pi-web-access-0.13.0/dist/index.js",
		"node_modules/@adrouter/ai/dist/index.js",
		"node_modules/@adrouter/tui/dist/index.js",
		"node_modules/@adrouter/agent-core/dist/index.js",
	]) {
		if (!existsSync(join(packageRoot, resource))) {
			throw new Error(`Packaged resource is missing: ${resource}`);
		}
	}
	await verifyInstalledRuntime({
		packageRoot,
		project,
		agentDir: join(isolatedHome, ".adrouter", "agent"),
		expectedVersion: version,
	});
	const dependencyTree = JSON.parse(
		run(process.platform === "win32" ? "npm.cmd" : "npm", ["ls", "--global", "--all", "--json", "--prefix", install], {
			capture: true,
			env,
		}),
	);
	if (dependencyTree.problems?.length) {
		throw new Error(`Packaged dependency tree is invalid: ${dependencyTree.problems.join(", ")}`);
	}
	console.log(`Packaged ${version} command and resource smokes passed.`);
} finally {
	// Windows runners can retain a loader/antivirus handle on a native dependency
	// after the installed CLI exits. The runner discards its temporary directory
	// with the job, so avoid turning successful runtime verification into a cleanup
	// failure or a long recursive retry across the installed dependency tree.
	if (process.platform === "win32") {
		console.warn(`Leaving temporary Windows smoke prefix for runner cleanup: ${smokeRoot}`);
	} else {
		removeTemporaryDirectory(smokeRoot);
	}
	removeTemporaryDirectory(isolatedHome);
	removeTemporaryDirectory(project);
}
