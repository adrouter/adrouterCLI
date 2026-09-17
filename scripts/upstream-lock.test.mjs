import assert from "node:assert/strict";
import test from "node:test";
import {
	componentById,
	generatedBundledSources,
	generatedRuntimeModuleText,
	readUpstreamLock,
	sha512Integrity,
	validateUpstreamLock,
	verifyNpmTarball,
	verifySourceArchive,
} from "./upstream-lock.mjs";

test("canonical upstream lock is valid and complete", () => {
	const lock = readUpstreamLock();
	assert.deepEqual(validateUpstreamLock(lock), []);
	assert.equal(componentById(lock, "pi-core")?.target?.version, "0.85.1");
	assert.equal(componentById(lock, "pi-cache-optimizer")?.target?.version, "2.8.10");
	assert.equal(componentById(lock, "pi-subagents")?.target?.version, "0.68.0");
	assert.equal(componentById(lock, "pi-web-access")?.target?.version, "0.29.0");
});

test("public bundle inventory and runtime module are generated deterministically", () => {
	const lock = readUpstreamLock();
	assert.deepEqual(
		generatedBundledSources(lock).bundles.map((bundle) => bundle.name),
		["pi-subagents", "pi-cache-optimizer", "pi-web-access", "BTW", "pi-opencode-tui-patch"],
	);
	const first = generatedRuntimeModuleText(lock);
	assert.equal(first, generatedRuntimeModuleText(JSON.parse(JSON.stringify(lock))));
	assert.match(first, /pi-subagents-0\.45\.2/);
	assert.match(first, /pi-cache-optimizer-2\.8\.2/);
	assert.match(first, /GENERATED_BUNDLE_DIRECTORIES/);
});

test("lock validation rejects duplicate identities and unsafe source URLs", () => {
	const lock = structuredClone(readUpstreamLock());
	lock.components[1].id = lock.components[0].id;
	lock.components[2].target.source_url = "http://example.test/source.tgz";
	const failures = validateUpstreamLock(lock);
	assert.ok(failures.some((failure) => failure.includes("duplicate component id")));
	assert.ok(failures.some((failure) => failure.includes("must use HTTPS")));
});

test("source archive verification rejects a SHA-256 mismatch", () => {
	const bytes = Buffer.from("verified source archive");
	const digest = "35a01aacd89b3a436444e2dca5a3f8dd1b7e1ee4548e4351d83bfaf7c051f2e0";
	verifySourceArchive(bytes, { source_sha256: digest }, "fixture");
	assert.throws(
		() => verifySourceArchive(Buffer.from("tampered source archive"), { source_sha256: digest }, "fixture"),
		/source SHA-256 does not match/,
	);
});

test("npm tarball verification rejects integrity and SHA-256 mismatches independently", () => {
	const bytes = Buffer.from("verified npm tarball");
	const snapshot = {
		npm_integrity: sha512Integrity(bytes),
		npm_tarball_sha256: "fad767925a5fb1d829434f4206edf8bb475756f28691a9bfa940191fff2e98ed",
	};
	verifyNpmTarball(bytes, snapshot, "fixture");
	assert.throws(
		() => verifyNpmTarball(Buffer.from("tampered npm tarball"), snapshot, "fixture"),
		/npm integrity does not match/,
	);
	assert.throws(
		() => verifyNpmTarball(bytes, { ...snapshot, npm_tarball_sha256: "0".repeat(64) }, "fixture"),
		/npm tarball SHA-256 does not match/,
	);
});
