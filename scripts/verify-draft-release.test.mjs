import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("draft verifier checks all three release metadata attestations", () => {
	const source = readFileSync(new URL("./verify-draft-release.mjs", import.meta.url), "utf8");
	for (const artifact of ["adrouterCLI.cdx.json", "BUNDLED_SOURCES.json", "THIRD_PARTY_NOTICES.md"]) {
		assert.match(source, new RegExp(artifact.replace(".", "\\.")));
	}
	assert.match(source, /const args = \["attestation", "verify"/);
	assert.match(source, /run\("gh", args\)/);
	assert.match(source, /--predicate-type", "https:\/\/cyclonedx\.org\/bom"/);
});
