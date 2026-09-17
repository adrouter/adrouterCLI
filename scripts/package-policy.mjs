import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";
import { CLI_PACKAGE, INTERNAL_PACKAGES } from "./npm-artifact.mjs";

export const PUBLIC_PACKAGES = [CLI_PACKAGE];
export { INTERNAL_PACKAGES };

const nativeExtensions = /\.(?:dll|dylib|exe|node)$/i;
const localPathPatterns = [
	/\/Users\/[A-Za-z0-9._-]+\//,
	/\/home\/[A-Za-z0-9._-]+\//,
	/\blocal:\//i,
];
const secretPatterns = [
	/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
	/\bnpm_[A-Za-z0-9]{30,}\b/,
	/(?:^|\s)_authToken\s*=/m,
];
const executableMagic = [
	{ label: "ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] },
	{ label: "PE", bytes: [0x4d, 0x5a] },
	{ label: "Mach-O", bytes: [0xfe, 0xed, 0xfa, 0xce] },
	{ label: "Mach-O", bytes: [0xce, 0xfa, 0xed, 0xfe] },
	{ label: "Mach-O", bytes: [0xfe, 0xed, 0xfa, 0xcf] },
	{ label: "Mach-O", bytes: [0xcf, 0xfa, 0xed, 0xfe] },
	{ label: "Mach-O universal", bytes: [0xca, 0xfe, 0xba, 0xbe] },
	{ label: "Mach-O universal", bytes: [0xbe, 0xba, 0xfe, 0xca] },
];

function readOctal(buffer, start, length) {
	const value = buffer.subarray(start, start + length).toString("utf8").replaceAll("\0", "").trim();
	return value ? Number.parseInt(value, 8) : 0;
}

export function readTarEntries(tarballPath) {
	const archive = gunzipSync(readFileSync(tarballPath));
	const entries = [];
	let offset = 0;
	while (offset + 512 <= archive.length) {
		const header = archive.subarray(offset, offset + 512);
		if (header.every((byte) => byte === 0)) break;
		const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/s, "");
		const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/s, "");
		const path = prefix ? `${prefix}/${name}` : name;
		const size = readOctal(header, 124, 12);
		const type = String.fromCharCode(header[156] || 0x30);
		const linkPath = header.subarray(157, 257).toString("utf8").replace(/\0.*$/s, "");
		const contentStart = offset + 512;
		const contentEnd = contentStart + size;
		if (contentEnd > archive.length) throw new Error(`${basename(tarballPath)} has a truncated tar entry: ${path}`);
		entries.push({ linkPath, path, type, content: archive.subarray(contentStart, contentEnd) });
		offset = contentStart + Math.ceil(size / 512) * 512;
	}
	return entries;
}

function isAllowedPath(pkg, path) {
	if (path === "package/package.json" || path === "package/LICENSE") return true;
	if (pkg.kind === "library") {
		return path === "package/docs/README.md" || path.startsWith("package/dist/");
	}
	return (
		[
			"package/README.md",
			"package/BUNDLED_SOURCES.json",
			"package/THIRD_PARTY_NOTICES.md",
			"package/npm-shrinkwrap.json",
		].includes(path) ||
		path.startsWith("package/dist/") ||
		path.startsWith("package/node_modules/")
	);
}

function isText(buffer) {
	if (buffer.includes(0)) return false;
	const sample = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("utf8");
	return !sample.includes("\uFFFD");
}

function findExecutableMagic(buffer) {
	return executableMagic.find(({ bytes }) => bytes.every((byte, index) => buffer[index] === byte))?.label;
}

export function embeddedDirectDependencyFailures(packageManifest, entries) {
	const failures = [];
	for (const [name, declaredVersion] of Object.entries(packageManifest.dependencies ?? {})) {
		if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(declaredVersion)) continue;
		const manifestPath = `package/node_modules/${name}/package.json`;
		const entry = entries.find(({ path }) => path === manifestPath);
		if (!entry) continue;
		const embeddedManifest = JSON.parse(entry.content.toString("utf8"));
		if (embeddedManifest.version !== declaredVersion) {
			failures.push(
				`embedded ${name}@${embeddedManifest.version ?? "unknown"} does not match declared ${declaredVersion}`,
			);
		}
	}
	return failures;
}

export function assertPackageTarball(pkg, packed, tarballPath) {
	const entries = readTarEntries(tarballPath);
	const paths = new Set(entries.map((entry) => entry.path.replace(/^package\//, "")));
	const failures = [];

	for (const entry of entries) {
		const relativePath = entry.path.replace(/^package\//, "");
		if (entry.type !== "0" && entry.type !== "\0" && entry.type !== "5" && entry.type !== "x") {
			failures.push(`archive link or unsupported entry ${relativePath}`);
		}
		if (entry.type === "5" || entry.type === "x") continue;
		if (!entry.path.startsWith("package/") || !isAllowedPath(pkg, entry.path)) {
			failures.push(`unexpected file ${relativePath}`);
		}
		if (nativeExtensions.test(relativePath)) failures.push(`native executable extension ${relativePath}`);
		const magic = findExecutableMagic(entry.content);
		if (magic) failures.push(`${magic} executable payload ${relativePath}`);
		if (relativePath.endsWith(".md") && !relativePath.startsWith("node_modules/")) {
			const approved =
				relativePath === "docs/README.md" ||
				relativePath === "README.md" ||
				relativePath === "THIRD_PARTY_NOTICES.md" ||
				relativePath.startsWith("dist/bundled/");
			if (!approved) failures.push(`undeclared documentation ${relativePath}`);
		}
		if (isText(entry.content)) {
			const text = entry.content.toString("utf8");
			const ownedPath =
				!relativePath.startsWith("node_modules/") || relativePath.startsWith("node_modules/@adrouter/");
			if (ownedPath) {
				for (const pattern of localPathPatterns) {
					if (pattern.test(text)) failures.push(`local path in ${relativePath}`);
				}
				for (const pattern of secretPatterns) {
					if (pattern.test(text)) failures.push(`secret-like content in ${relativePath}`);
				}
			}
		}
	}

	if (pkg.kind === "cli") {
		const packageManifestEntry = entries.find(({ path }) => path === "package/package.json");
		const packageManifest = packageManifestEntry
			? JSON.parse(packageManifestEntry.content.toString("utf8"))
			: {};
		const expectedBundles = INTERNAL_PACKAGES.map(({ name }) => name).sort();
		const declaredBundles = [...(packageManifest.bundleDependencies ?? [])].sort();
		if (JSON.stringify(declaredBundles) !== JSON.stringify(expectedBundles)) {
			failures.push(`bundleDependencies differs: ${declaredBundles.join(", ")}`);
		}
		if (packed.bundled && expectedBundles.some((name) => !packed.bundled.includes(name))) {
			failures.push(`npm pack bundled tree is missing an internal package: ${packed.bundled.join(", ")}`);
		}
		failures.push(...embeddedDirectDependencyFailures(packageManifest, entries));
		for (const internal of INTERNAL_PACKAGES) {
			if (packageManifest.dependencies?.[internal.name] !== packageManifest.version) {
				failures.push(`${internal.name} is not pinned exactly to ${packageManifest.version}`);
			}
			const root = `node_modules/${internal.name}`;
			const manifestPath = `${root}/package.json`;
			const internalManifestEntry = entries.find(({ path }) => path === `package/${manifestPath}`);
			if (!internalManifestEntry) {
				failures.push(`missing bundled package ${manifestPath}`);
				continue;
			}
			const internalManifest = JSON.parse(internalManifestEntry.content.toString("utf8"));
			if (
				internalManifest.name !== internal.name ||
				internalManifest.version !== packageManifest.version ||
				internalManifest.private !== true ||
				internalManifest.publishConfig !== undefined
			) {
				failures.push(`invalid bundled manifest ${manifestPath}`);
			}
			if (!paths.has(`${root}/LICENSE`)) failures.push(`missing bundled license ${root}/LICENSE`);
			if (!paths.has(`${root}/dist/index.js`)) failures.push(`missing bundled runtime ${root}/dist/index.js`);
		}
		for (const entry of entries.filter(({ path }) =>
			/(?:^|\/)node_modules\/(?:@[^/]+\/[^/]+|[^/]+)\/package\.json$/.test(path),
		)) {
			const manifest = JSON.parse(entry.content.toString("utf8"));
			if (typeof manifest.license !== "string" || manifest.license.trim() === "") {
				failures.push(`bundled dependency has no license metadata: ${entry.path.replace(/^package\//, "")}`);
			}
		}
		const shrinkwrap = entries.find(({ path }) => path === "package/npm-shrinkwrap.json");
		if (shrinkwrap && /registry\.npmjs\.org\/@adrouter\//.test(shrinkwrap.content.toString("utf8"))) {
			failures.push("shrinkwrap references an internal AdRouter registry tarball");
		}
		for (const required of [
			"README.md",
			"BUNDLED_SOURCES.json",
			"THIRD_PARTY_NOTICES.md",
			"dist/cli.js",
			"dist/profile-cli.js",
			"dist/bundled/pi-web-access-0.29.0/index.ts",
			"dist/bundled/pi-web-access-0.29.0/dist/index.js",
			"dist/bundled/pi-web-access-0.29.0/LICENSE",
			"dist/bundled/pi-web-access-0.29.0/skills/librarian/docs/SKILL.md",
			"dist/bundled/adroutercli/skills/adroutercli/docs/SKILL.md",
		]) {
			if (!paths.has(required)) failures.push(`missing required runtime file ${required}`);
		}
	}

	if (failures.length > 0) {
		throw new Error(`${pkg.name} package policy failed:\n- ${[...new Set(failures)].sort().join("\n- ")}`);
	}

	const buffer = readFileSync(tarballPath);
	const integrity = `sha512-${createHash("sha512").update(buffer).digest("base64")}`;
	if (packed.integrity && packed.integrity !== integrity) {
		throw new Error(`${pkg.name} npm pack integrity does not match the tarball bytes`);
	}
	return {
		filename: basename(tarballPath),
		integrity,
		name: pkg.name,
		shasum: createHash("sha1").update(buffer).digest("hex"),
		size: buffer.length,
		version: packed.version,
	};
}
