import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultUpstreamLockPath = resolve(repositoryRoot, "upstreams.lock.json");

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const commitHash = /^[0-9a-f]{7,40}$/;
const sha256 = /^[0-9a-f]{64}$/;
const npmIntegrity = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

export function readUpstreamLock(path = defaultUpstreamLockPath) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function validateSnapshot(snapshot, label, failures, { target = false } = {}) {
	if (snapshot === null) return;
	if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
		failures.push(`${label} must be an object or null`);
		return;
	}
	if (target && !exactVersion.test(snapshot.version ?? "")) {
		failures.push(`${label}.version must be an exact semantic version`);
	}
	if (snapshot.commit !== undefined && !commitHash.test(snapshot.commit)) {
		failures.push(`${label}.commit must be a lowercase Git commit hash`);
	}
	for (const field of ["source_url", "npm_tarball_url"]) {
		if (snapshot[field] !== undefined && !/^https:\/\//.test(snapshot[field])) {
			failures.push(`${label}.${field} must use HTTPS`);
		}
	}
	for (const field of ["source_sha256", "source_tarball_sha256", "npm_tarball_sha256"]) {
		if (snapshot[field] !== undefined && !sha256.test(snapshot[field])) {
			failures.push(`${label}.${field} must be a lowercase SHA-256 digest`);
		}
	}
	if (snapshot.npm_integrity !== undefined && !npmIntegrity.test(snapshot.npm_integrity)) {
		failures.push(`${label}.npm_integrity must be a sha512 SRI value`);
	}
	if (target) {
		const sourceFields = [snapshot.source_url, snapshot.source_sha256];
		if (sourceFields.some((value) => value !== undefined) && sourceFields.some((value) => value === undefined)) {
			failures.push(`${label} must pair source_url with source_sha256`);
		}
		const npmFields = [snapshot.npm_tarball_url, snapshot.npm_integrity, snapshot.npm_tarball_sha256];
		if (npmFields.some((value) => value !== undefined) && npmFields.some((value) => value === undefined)) {
			failures.push(`${label} must provide npm_tarball_url, npm_integrity, and npm_tarball_sha256 together`);
		}
	}
}

export function validateUpstreamLock(lock) {
	const failures = [];
	if (lock?.schema !== 1) failures.push("schema must be 1");
	if (lock?.product !== "AdRouterCLI") failures.push("product must be AdRouterCLI");
	if (!/^\d{4}-\d{2}-\d{2}$/.test(lock?.updated_on ?? "")) failures.push("updated_on must be YYYY-MM-DD");
	if (!Array.isArray(lock?.components) || lock.components.length === 0) {
		failures.push("components must be a non-empty array");
		return failures;
	}

	const ids = new Set();
	const publicOrders = new Set();
	for (const [index, component] of lock.components.entries()) {
		const label = `components[${index}]`;
		if (!component || typeof component !== "object" || Array.isArray(component)) {
			failures.push(`${label} must be an object`);
			continue;
		}
		if (!/^[a-z0-9][a-z0-9-]*$/.test(component.id ?? "")) failures.push(`${label}.id is invalid`);
		if (ids.has(component.id)) failures.push(`duplicate component id: ${component.id}`);
		ids.add(component.id);
		if (typeof component.kind !== "string" || !component.kind) failures.push(`${component.id}.kind is required`);
		if (typeof component.license !== "string" || !component.license) failures.push(`${component.id}.license is required`);
		if (component.repository !== undefined && !/^https:\/\//.test(component.repository)) {
			failures.push(`${component.id}.repository must use HTTPS`);
		}
		validateSnapshot(component.active, `${component.id}.active`, failures);
		validateSnapshot(component.target, `${component.id}.target`, failures, { target: component.target !== null });
		for (const disposition of ["adopt", "adapt", "defer", "reject"]) {
			if (!Array.isArray(component.feature_disposition?.[disposition])) {
				failures.push(`${component.id}.feature_disposition.${disposition} must be an array`);
			}
		}
		if (component.discovery?.npm_package !== undefined && typeof component.discovery.npm_package !== "string") {
			failures.push(`${component.id}.discovery.npm_package must be a string`);
		}
		if (component.public_bundle) {
			const order = component.public_bundle.order;
			if (!Number.isSafeInteger(order) || order < 0) failures.push(`${component.id}.public_bundle.order is invalid`);
			if (publicOrders.has(order)) failures.push(`duplicate public bundle order: ${order}`);
			publicOrders.add(order);
			if (component.active === null) failures.push(`${component.id}.public_bundle requires an active source`);
			if (component.public_bundle.redistribution?.status !== "cleared") {
				failures.push(`${component.id}.public_bundle redistribution is not cleared`);
			}
		}
	}

	const runtime = lock.runtime;
	if (!runtime || typeof runtime !== "object") return [...failures, "runtime is required"];
	const directories = runtime.bundle_directories;
	if (!Array.isArray(directories) || new Set(directories).size !== directories?.length) {
		failures.push("runtime.bundle_directories must be a unique array");
	}
	for (const [index, extension] of (runtime.extensions ?? []).entries()) {
		if (!ids.has(extension.component)) failures.push(`runtime.extensions[${index}] references an unknown component`);
		if (!Array.isArray(extension.relative_path) || extension.relative_path.length < 2) {
			failures.push(`runtime.extensions[${index}].relative_path is invalid`);
		} else if (!directories.includes(extension.relative_path[0])) {
			failures.push(`runtime.extensions[${index}] directory is not declared`);
		}
	}
	for (const [index, skillPath] of (runtime.skill_directories ?? []).entries()) {
		if (!Array.isArray(skillPath) || skillPath.length === 0 || !directories.includes(skillPath[0])) {
			failures.push(`runtime.skill_directories[${index}] is invalid`);
		}
	}
	if (!Array.isArray(runtime.required_skills) || runtime.required_skills.length === 0) {
		failures.push("runtime.required_skills must be a non-empty array");
	}
	return failures;
}

export function componentById(lock, id) {
	return lock.components.find((component) => component.id === id);
}

export function publicBundleNames(lock) {
	return lock.components
		.filter((component) => component.public_bundle)
		.sort((left, right) => left.public_bundle.order - right.public_bundle.order)
		.map((component) => component.public_bundle.name);
}

export function generatedBundledSources(lock) {
	const bundles = lock.components
		.filter((component) => component.public_bundle)
		.sort((left, right) => left.public_bundle.order - right.public_bundle.order)
		.map((component) => {
			const active = component.active;
			return {
				name: component.public_bundle.name,
				...(active.version ? { version: active.version } : {}),
				...(active.commit ? { commit: active.commit } : {}),
				source_url: active.source_url,
				...(active.npm_integrity ? { npm_integrity: active.npm_integrity } : {}),
				...(active.source_sha256 ? { source_sha256: active.source_sha256 } : {}),
				...(active.source_tarball_sha256 ? { source_tarball_sha256: active.source_tarball_sha256 } : {}),
				license: component.license,
				redistribution: component.public_bundle.redistribution,
				local_modifications: component.local_modifications ?? [],
				update_procedure: component.public_bundle.update_procedure,
				status: component.public_bundle.status,
			};
		});
	return { schema: 1, product: lock.product, bundles };
}

export function generatedBundledSourcesText(lock) {
	return `${JSON.stringify(generatedBundledSources(lock), null, 2)}\n`;
}

function generatedDeclaration(name, value) {
	return `export const ${name} = ${JSON.stringify(value, null, "\t")} as const;`;
}

export function generatedRuntimeModuleText(lock) {
	const extensions = lock.runtime.extensions.map(({ component: _component, relative_path: relativePath, ...entry }) => ({
		...entry,
		relativePath,
	}));
	const source = [
		"// Generated from upstreams.lock.json by scripts/generate-upstream-metadata.mjs.",
		"// Do not edit this file by hand.",
		"",
		generatedDeclaration("GENERATED_BUNDLED_EXTENSION_CONTRACTS", extensions),
		"",
		generatedDeclaration("GENERATED_BUNDLED_SKILL_DIRECTORIES", lock.runtime.skill_directories),
		"",
		generatedDeclaration("GENERATED_REQUIRED_BUNDLED_SKILLS", lock.runtime.required_skills),
		"",
		generatedDeclaration("GENERATED_BUNDLE_DIRECTORIES", lock.runtime.bundle_directories),
		"",
	].join("\n");
	const biomePath = resolve(repositoryRoot, "node_modules/@biomejs/biome/bin/biome");
	const formatted = spawnSync(
		process.execPath,
		[biomePath, "format", "--stdin-file-path", "packages/coding-agent/src/core/bundled-manifest.generated.ts"],
		{ input: source, encoding: "utf8" },
	);
	if (formatted.status !== 0) {
		throw new Error(`Could not format generated runtime manifest: ${formatted.stderr || formatted.stdout}`);
	}
	return formatted.stdout;
}

export function sha256File(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function sha512Integrity(buffer) {
	return `sha512-${createHash("sha512").update(buffer).digest("base64")}`;
}

export function verifySourceArchive(bytes, snapshot, label = "source archive") {
	if (!snapshot?.source_sha256) throw new Error(`${label}: source SHA-256 is not locked`);
	const actual = createHash("sha256").update(bytes).digest("hex");
	if (actual !== snapshot.source_sha256) throw new Error(`${label}: source SHA-256 does not match upstreams.lock.json`);
}

export function verifyNpmTarball(bytes, snapshot, label = "npm tarball") {
	if (!snapshot?.npm_integrity || !snapshot?.npm_tarball_sha256) {
		throw new Error(`${label}: npm integrity and tarball SHA-256 must both be locked`);
	}
	if (sha512Integrity(bytes) !== snapshot.npm_integrity) {
		throw new Error(`${label}: npm integrity does not match upstreams.lock.json`);
	}
	const actualSha256 = createHash("sha256").update(bytes).digest("hex");
	if (actualSha256 !== snapshot.npm_tarball_sha256) {
		throw new Error(`${label}: npm tarball SHA-256 does not match upstreams.lock.json`);
	}
}
