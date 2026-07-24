#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tag = process.argv[2];
if (!tag) throw new Error("Usage: node scripts/verify-draft-release.mjs <tag>");

function run(command, args, cwd) {
	const result = spawnSync(command, args, { cwd, encoding: "utf8" });
	if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
	return result.stdout.trim();
}

const draft = JSON.parse(run("gh", ["release", "view", tag, "--json", "isDraft,isPrerelease"]));
if (!draft.isDraft || !draft.isPrerelease) throw new Error(`${tag} is not a draft prerelease`);

const directory = mkdtempSync(join(tmpdir(), "adrouter-draft-"));
try {
	run("gh", ["release", "download", tag, "--dir", directory], process.cwd());
	const expected = [
		"BUNDLED_SOURCES.json",
		"SHA256SUMS",
		"THIRD_PARTY_NOTICES.md",
		"adrouterCLI.cdx.json",
	];
	const actual = readdirSync(directory).sort();
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(`Draft inventory mismatch: ${actual.join(", ")}`);
	}
	run("sha256sum", ["-c", "SHA256SUMS"], directory);
	for (const artifact of ["adrouterCLI.cdx.json", "BUNDLED_SOURCES.json", "THIRD_PARTY_NOTICES.md"]) {
		const args = ["attestation", "verify", join(directory, artifact), "--repo", "adrouter/adrouterCLI"];
		if (artifact === "adrouterCLI.cdx.json") {
			args.push("--predicate-type", "https://cyclonedx.org/bom");
		}
		run("gh", args);
	}
	const sbom = JSON.parse(readFileSync(join(directory, "adrouterCLI.cdx.json"), "utf8"));
	if (sbom.bomFormat !== "CycloneDX") throw new Error("Release SBOM is not CycloneDX");
	console.log(`Verified draft release ${tag}.`);
} finally {
	rmSync(directory, { recursive: true, force: true });
}
