#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative } from "node:path";

const markdown = [];
function visit(directory) {
	for (const entry of readdirSync(directory)) {
		if ([".git", "dist", "node_modules", "bundled"].includes(entry)) continue;
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) visit(path);
		else if (path.endsWith(".md")) markdown.push(path);
	}
}
visit(".");

const failures = [];
for (const path of markdown) {
	if (/[\\/]CHANGELOG\.md$/.test(path)) continue;
	const text = readFileSync(path, "utf8");
	for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
		const target = match[1].split("#", 1)[0];
		if (!target || target === "link" || target.includes("REFERENCE") || /^(?:https?:|mailto:)/.test(target)) continue;
		const resolved = normalize(join(dirname(path), target));
		if (!existsSync(resolved)) failures.push(`${relative(".", path)}: missing local link ${target}`);
	}
}

const rootReadme = readFileSync("README.md", "utf8");
const adrouterModelIds = [
	"deepseek-v4-flash",
	"deepseek-v4-pro",
	"mimo-v2.5",
	"mimo-v2.5-pro",
	"agnes-2.5-flash",
	"agnes-2.5-pro-alpha",
];
for (const path of [
	"README.md",
	"docs/installation.md",
	"docs/usage.md",
	"docs/troubleshooting.md",
	"packages/coding-agent/bundled/adroutercli/skills/adroutercli/docs/SKILL.md",
]) {
	const text = readFileSync(path, "utf8");
	for (const modelId of adrouterModelIds) {
		if (!text.includes(modelId)) failures.push(`${path}: missing hosted AdRouter model ID ${modelId}`);
	}
}
for (const command of [
	"npm install --global --ignore-scripts @adrouter/cli@beta",
	"adrouter --version",
	"adrouter --json doctor",
	"adrouter-profile set work --provider adrouter --model deepseek-v4-flash",
	"adrouter-profile list",
	"adrouter-profile apply work --dry-run --no-launch",
	"adrouter-profile restore",
	"npm uninstall --global @adrouter/cli",
]) {
	if (!rootReadme.includes(command)) failures.push(`README.md: missing tested command example: ${command}`);
}
for (const invalid of ["adrouter-profile create", "adrouter-profile use"]) {
	if (rootReadme.includes(invalid)) failures.push(`README.md: invalid profile command remains: ${invalid}`);
}

const cliManifest = JSON.parse(readFileSync("packages/coding-agent/package.json", "utf8"));
if (JSON.stringify(Object.keys(cliManifest.bin).sort()) !== JSON.stringify(["adrouter", "adrouter-profile"])) {
	failures.push("packages/coding-agent/package.json: command surface differs from documentation");
}

const profileCli = join("packages", "coding-agent", "dist", "profile-cli.js");
if (!existsSync(profileCli)) {
	failures.push(`${profileCli}: build output is required to execute documentation examples`);
} else {
	const isolatedHome = mkdtempSync(join(tmpdir(), "adrouter-docs-home-"));
	const project = mkdtempSync(join(tmpdir(), "adrouter-docs-project-"));
	try {
		const env = {
			...process.env,
			ADROUTER_PROFILES_DIR: join(isolatedHome, ".adrouter", "profiles"),
			HOME: isolatedHome,
			USERPROFILE: isolatedHome,
		};
		for (const args of [
			["set", "work", "--provider", "adrouter", "--model", "deepseek-v4-flash"],
			["list"],
			["apply", "work", "--cwd", project, "--no-launch"],
			["restore", "--cwd", project],
		]) {
			const result = spawnSync(process.execPath, [profileCli, ...args], { encoding: "utf8", env });
			if (result.status !== 0) failures.push(`documented profile example failed: adrouter-profile ${args.join(" ")}`);
		}
	} finally {
		rmSync(isolatedHome, { recursive: true, force: true });
		rmSync(project, { recursive: true, force: true });
	}
}

if (failures.length) {
	console.error("Documentation check failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}
console.log(`Documentation check passed (${markdown.length} Markdown files).`);
