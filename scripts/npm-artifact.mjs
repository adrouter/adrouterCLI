import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export const INTERNAL_PACKAGES = [
	{ directory: "packages/ai", name: "@adrouter/ai", kind: "library" },
	{ directory: "packages/tui", name: "@adrouter/tui", kind: "library" },
	{ directory: "packages/agent", name: "@adrouter/agent-core", kind: "library" },
];

export const CLI_PACKAGE = {
	directory: "packages/coding-agent",
	name: "@adrouter/cli",
	kind: "cli",
};

function npmCommand() {
	return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpmJson(args, cwd) {
	const result = spawnSync(npmCommand(), [...args, "--json"], {
		cwd,
		encoding: "utf8",
		maxBuffer: 128 * 1024 * 1024,
		shell: process.platform === "win32",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status !== 0) {
		throw new Error(
			`npm ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
		);
	}
	return JSON.parse(result.stdout || "null");
}

function copyCliPublishTree(source, destination) {
	cpSync(source, destination, {
		recursive: true,
		filter(path) {
			const pathFromSource = relative(source, path);
			if (!pathFromSource) return true;
			const firstSegment = pathFromSource.split(/[\\/]/, 1)[0];
			return firstSegment !== "node_modules" && !pathFromSource.endsWith(".tgz");
		},
	});
}

export function createBundledCliTarball({ outputDirectory, repoRoot = process.cwd() }) {
	if (!outputDirectory) throw new Error("createBundledCliTarball requires outputDirectory");
	mkdirSync(outputDirectory, { recursive: true });
	const temporaryRoot = mkdtempSync(join(tmpdir(), "adrouter-npm-stage-"));
	try {
		const internalTarballDirectory = join(temporaryRoot, "internal-tarballs");
		const stagedCliDirectory = join(temporaryRoot, "cli");
		mkdirSync(internalTarballDirectory, { recursive: true });

		const internalTarballs = [];
		for (const pkg of INTERNAL_PACKAGES) {
			const packageDirectory = join(repoRoot, pkg.directory);
			const manifest = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8"));
			if (manifest.name !== pkg.name || manifest.private !== true) {
				throw new Error(`${pkg.directory} must be the private package ${pkg.name}`);
			}
			const packed = runNpmJson(
				["pack", "--ignore-scripts", "--pack-destination", internalTarballDirectory],
				packageDirectory,
			)[0];
			internalTarballs.push(join(internalTarballDirectory, packed.filename));
		}

		const cliSourceDirectory = join(repoRoot, CLI_PACKAGE.directory);
		const sourceManifest = readFileSync(join(cliSourceDirectory, "package.json"), "utf8");
		const sourceShrinkwrap = readFileSync(join(cliSourceDirectory, "npm-shrinkwrap.json"), "utf8");
		copyCliPublishTree(cliSourceDirectory, stagedCliDirectory);
		runNpmJson(
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--legacy-peer-deps",
				"--omit=dev",
				"--no-save",
				...internalTarballs,
			],
			stagedCliDirectory,
		);
		if (readFileSync(join(stagedCliDirectory, "package.json"), "utf8") !== sourceManifest) {
			throw new Error("Staging the internal tarballs changed the CLI manifest");
		}
		if (readFileSync(join(stagedCliDirectory, "npm-shrinkwrap.json"), "utf8") !== sourceShrinkwrap) {
			throw new Error("Staging the internal tarballs changed the CLI shrinkwrap");
		}

		const packed = runNpmJson(
			["pack", "--ignore-scripts", "--pack-destination", outputDirectory],
			stagedCliDirectory,
		)[0];
		return {
			packed,
			tarball: join(outputDirectory, packed.filename),
		};
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
}
