#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertPackageTarball, PUBLIC_PACKAGES, readTarEntries } from "./package-policy.mjs";
import { assertResumablePublication, publicationChannel } from "./release-policy.mjs";

const dryRun = process.argv.includes("--dry-run");
const stage = process.argv.includes("--stage");
const firstPublish = process.argv.includes("--first-publish");
const manifestIndex = process.argv.indexOf("--manifest");
const manifestPath = manifestIndex >= 0 ? process.argv[manifestIndex + 1] : undefined;
const knownArgs = new Set(["--dry-run", "--stage", "--first-publish", "--manifest", manifestPath]);
const unknownArgs = process.argv.slice(2).filter((argument) => !knownArgs.has(argument));
if (
	unknownArgs.length > 0 ||
	Number(dryRun) + Number(stage) + Number(firstPublish) !== 1 ||
	(manifestIndex >= 0 && !manifestPath)
) {
	throw new Error(
		"Usage: node scripts/publish.mjs (--dry-run|--stage|--first-publish) [--manifest <path>]",
	);
}

function commandForPlatform(command) {
	return process.platform === "win32" ? `${command}.cmd` : command;
}

function pause(milliseconds) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function run(command, args, options = {}) {
	const result = spawnSync(commandForPlatform(command), args, {
		cwd: options.cwd,
		encoding: "utf8",
		stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
	});
	if (result.status !== 0) {
		const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
		throw new Error(output ? `${command} ${args.join(" ")} failed\n${output}` : `${command} ${args.join(" ")} failed`);
	}
	return result.stdout ?? "";
}

function runNpmJson(args, options = {}) {
	return JSON.parse(run("npm", [...args, "--json"], { ...options, capture: true }) || "null");
}

function npmJsonOrMissing(args) {
	const result = spawnSync(commandForPlatform("npm"), [...args, "--json"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.status === 0) return JSON.parse(result.stdout || "null");
	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	if (/\bE404\b|404 Not Found/.test(output)) return undefined;
	throw new Error(`npm ${args.join(" ")} failed\n${output}`);
}

function packageMetadata(manifest) {
	return {
		bin: manifest.bin ?? null,
		dependencies: manifest.dependencies ?? {},
		description: manifest.description ?? "",
		engines: manifest.engines ?? {},
		name: manifest.name,
		repository: manifest.repository ?? null,
		version: manifest.version,
	};
}

function metadataMatches(local, remote) {
	return JSON.stringify(packageMetadata(local)) === JSON.stringify(packageMetadata(remote));
}

function packageJsonFromTarball(tarball) {
	const entry = readTarEntries(tarball).find(({ path }) => path === "package/package.json");
	if (!entry) throw new Error(`${tarball} has no package.json`);
	return JSON.parse(entry.content.toString("utf8"));
}

function stagedItems() {
	const result = runNpmJson(["stage", "list"]);
	if (Array.isArray(result)) return result;
	if (Array.isArray(result?.items)) return result.items;
	if (result && typeof result === "object") return Object.values(result).flat().filter((value) => value && typeof value === "object");
	return [];
}

function findStage(items, name, version) {
	return items.find(
		(item) =>
			(item.packageName === name || item.name === name || item.package === name) &&
			String(item.version) === version,
	);
}

function verifyStagedPackage(stageItem, pkg, localArtifact, downloadRoot) {
	const id = stageItem.id ?? stageItem.stageId;
	if (!id) throw new Error(`${pkg.name}@${localArtifact.version} staged record has no stage ID`);
	const directory = join(downloadRoot, pkg.name.replaceAll("/", "-").replace("@", ""));
	mkdirSync(directory, { recursive: true });
	const download = runNpmJson(["stage", "download", id], { cwd: directory });
	const details = download[pkg.name] ?? download;
	const tarball = join(directory, details.filename);
	const remoteManifest = packageJsonFromTarball(tarball);
	return {
		metadataMatches: metadataMatches(localArtifact.manifest, remoteManifest),
		registryIntegrity: String(details.integrity),
		stageId: id,
		stageTag: stageItem.tag,
	};
}

function publishedPackage(name, version) {
	const manifest = npmJsonOrMissing(["view", `${name}@${version}`]);
	if (!manifest) return undefined;
	return Array.isArray(manifest) ? manifest.at(-1) : manifest;
}

function packageTags(name) {
	return npmJsonOrMissing(["view", name, "dist-tags"]) ?? {};
}

function collectStates(artifacts, items, downloadRoot) {
	return PUBLIC_PACKAGES.map((pkg) => {
		const artifact = artifacts.get(pkg.name);
		const tags = packageTags(pkg.name);
		const published = publishedPackage(pkg.name, artifact.version);
		if (published) {
			return {
				localIntegrity: artifact.integrity,
				metadataMatches: metadataMatches(artifact.manifest, published),
				name: pkg.name,
				registryIntegrity: published.dist?.integrity,
				status: "published",
				tags,
				version: published.version,
			};
		}
		const stageItem = findStage(items, pkg.name, artifact.version);
		if (stageItem) {
			const verified = verifyStagedPackage(stageItem, pkg, artifact, downloadRoot);
			return {
				localIntegrity: artifact.integrity,
				name: pkg.name,
				status: "staged",
				tags,
				version: artifact.version,
				...verified,
			};
		}
		return {
			localIntegrity: artifact.integrity,
			metadataMatches: true,
			name: pkg.name,
			status: "missing",
			tags,
			version: artifact.version,
		};
	});
}

const workDirectory = mkdtempSync(join(tmpdir(), "adrouter-publish-"));
try {
	const tarballDirectory = join(workDirectory, "tarballs");
	const downloadDirectory = join(workDirectory, "staged");
	mkdirSync(tarballDirectory, { recursive: true });
	mkdirSync(downloadDirectory, { recursive: true });
	const artifacts = new Map();

	for (const pkg of PUBLIC_PACKAGES) {
		const manifest = JSON.parse(readFileSync(join(pkg.directory, "package.json"), "utf8"));
		if (manifest.name !== pkg.name) throw new Error(`${pkg.directory} has unexpected package name ${manifest.name}`);
		const packed = runNpmJson(
			["pack", "--ignore-scripts", "--pack-destination", tarballDirectory],
			{ cwd: pkg.directory },
		)[0];
		const tarball = join(tarballDirectory, packed.filename);
		const verified = assertPackageTarball(pkg, packed, tarball);
		artifacts.set(pkg.name, { ...verified, manifest, tarball });
	}

	const versions = new Set([...artifacts.values()].map(({ version }) => version));
	if (versions.size !== 1) throw new Error(`Publish packages are not lockstep versioned: ${[...versions].join(", ")}`);
	const version = [...versions][0];
	const channel = publicationChannel(version);
	const record = {
		commit: run("git", ["rev-parse", "HEAD"], { capture: true }).trim(),
		packages: PUBLIC_PACKAGES.map(({ name }) => {
			const { integrity, shasum, size, version: packageVersion } = artifacts.get(name);
			return { integrity, name, shasum, size, version: packageVersion };
		}),
		tag: channel.tag,
		version,
	};
	if (manifestPath) writeFileSync(manifestPath, `${JSON.stringify(record, null, 2)}\n`);

	if (dryRun) {
		for (const pkg of PUBLIC_PACKAGES) {
			run("npm", [
				"publish",
				artifacts.get(pkg.name).tarball,
				"--dry-run",
				"--access",
				"public",
				"--tag",
				channel.tag,
				"--ignore-scripts",
			]);
		}
		console.log(`Validated and recorded all four ${version} tarballs without publishing.`);
		process.exit(0);
	}

	let items = stage ? stagedItems() : [];
	let states = collectStates(artifacts, items, downloadDirectory);
	assertResumablePublication(states, version, channel);

	if (firstPublish && !channel.prerelease) {
		throw new Error("One-time first publication is restricted to the beta prerelease channel");
	}

	for (let index = 0; index < PUBLIC_PACKAGES.length; index++) {
		const pkg = PUBLIC_PACKAGES[index];
		if (states[index].status !== "missing") {
			console.log(`Verified existing ${states[index].status} artifact ${pkg.name}@${version}; resuming.`);
			continue;
		}
		const publishArgs = stage
			? ["stage", "publish", artifacts.get(pkg.name).tarball]
			: ["publish", artifacts.get(pkg.name).tarball];
		run("npm", [
			...publishArgs,
			"--access",
			"public",
			"--tag",
			channel.tag,
			"--provenance",
			"--ignore-scripts",
		]);
		const expectedStatus = stage ? "staged" : "published";
		const visibilityDeadline = Date.now() + 5 * 60 * 1000;
		let waitingForVisibility = false;
		do {
			items = stage ? stagedItems() : [];
			states = collectStates(artifacts, items, downloadDirectory);
			assertResumablePublication(states, version, channel);
			if (states[index].status === expectedStatus) break;
			if (stage || Date.now() >= visibilityDeadline) break;
			if (!waitingForVisibility) {
				console.log(`Waiting for npm consumer metadata for ${pkg.name}@${version} to become visible.`);
				waitingForVisibility = true;
			}
			pause(5_000);
		} while (true);
		if (states[index].status !== expectedStatus) {
			throw new Error(`${pkg.name}@${version} was not visible after ${expectedStatus}`);
		}
		console.log(`${stage ? "Staged" : "Published"} and integrity-verified ${pkg.name}@${version}.`);
	}
	if (stage) {
		console.log(
			"All four packages are staged and verified. Approve them with human 2FA in dependency order; approve @adrouter/cli last.",
		);
	} else {
		console.log("All four first-publication packages are public, verified under beta, and absent from latest.");
	}
} finally {
	rmSync(workDirectory, { recursive: true, force: true });
}
