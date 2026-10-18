/**
 * Checks the things the community directory checks, before submitting.
 *
 * Mirrors obsidian-releases' validate-plugin-entry workflow plus the parts of
 * the developer policies that can be checked mechanically. Run it with
 * `npm run validate` after `npm run build`.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';

const problems = [];
const warnings = [];
const passed = [];

const check = (ok, label, detail) => {
	if (ok) passed.push(label);
	else problems.push(detail ? `${label} — ${detail}` : label);
};
const warn = (ok, label) => {
	if (ok) passed.push(label);
	else warnings.push(label);
};

const readJson = (path) => {
	try {
		return JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		problems.push(`${path} is not valid JSON — ${error.message}`);
		return null;
	}
};

// --- required files at the repo root ---
for (const file of ['manifest.json', 'README.md', 'LICENSE']) {
	check(existsSync(file), `${file} present`, 'the directory requires it at the repo root');
}

const manifest = readJson('manifest.json');
const versions = readJson('versions.json');
const pkg = readJson('package.json');

if (manifest) {
	for (const field of ['id', 'name', 'version', 'minAppVersion', 'description', 'author', 'isDesktopOnly']) {
		check(manifest[field] !== undefined, `manifest.${field} set`);
	}

	check(/^[a-z0-9-]+$/.test(manifest.id ?? ''), 'manifest.id is lowercase letters, digits and dashes', manifest.id);
	check(!(manifest.id ?? '').includes('obsidian'), 'manifest.id does not contain "obsidian"', manifest.id);
	check(!/obsidian/i.test(manifest.name ?? ''), 'manifest.name does not contain "Obsidian"', manifest.name);
	check((manifest.name ?? '') === (manifest.name ?? '').trim(), 'manifest.name has no stray whitespace');
	check(/^\d+\.\d+\.\d+$/.test(manifest.version ?? ''), 'manifest.version is x.y.z with no leading "v"', manifest.version);
	check(/^\d+\.\d+\.\d+$/.test(manifest.minAppVersion ?? ''), 'manifest.minAppVersion is x.y.z', manifest.minAppVersion);
	check(typeof manifest.isDesktopOnly === 'boolean', 'manifest.isDesktopOnly is a boolean');
	check((manifest.description ?? '').length <= 250, 'manifest.description is at most 250 characters');
	check(!/^(an?|the) /i.test(manifest.description ?? ''), 'manifest.description does not open with an article');
	check(!/obsidian/i.test(manifest.description ?? ''), 'manifest.description does not say "Obsidian"');

	if (manifest.authorUrl) {
		check(!manifest.authorUrl.includes('obsidian.md'), 'manifest.authorUrl is not obsidian.md');
	}
	if (manifest.fundingUrl) {
		check(/^https:\/\//.test(manifest.fundingUrl), 'manifest.fundingUrl is https');
	}
}

// --- versions.json has to cover this release ---
if (manifest && versions) {
	check(
		Object.prototype.hasOwnProperty.call(versions, manifest.version),
		`versions.json has an entry for ${manifest.version}`,
		'add it with `npm version <x.y.z>`'
	);
	check(
		versions[manifest.version] === manifest.minAppVersion,
		`versions.json["${manifest.version}"] matches minAppVersion`,
		`${versions[manifest.version]} vs ${manifest.minAppVersion}`
	);
	for (const [version, min] of Object.entries(versions)) {
		check(/^\d+\.\d+\.\d+$/.test(version), `versions.json key ${version} is semver`);
		check(/^\d+\.\d+\.\d+$/.test(min), `versions.json["${version}"] value is semver`);
	}
}

if (manifest && pkg) {
	check(pkg.version === manifest.version, 'package.json version matches manifest', `${pkg.version} vs ${manifest.version}`);
}

// --- release assets, which have to be attached individually ---
for (const asset of ['main.js', 'manifest.json']) {
	check(existsSync(asset), `${asset} built`, 'run `npm run build`');
}
warn(existsSync('styles.css'), 'styles.css built');

if (existsSync('main.js')) {
	const bytes = statSync('main.js').size;
	warn(bytes < 5_000_000, `main.js is a reasonable size (${(bytes / 1024).toFixed(0)} KB)`);
}

// --- policy checks over the source ---
const sources = [];
const walk = (dir) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path);
		else if (extname(entry.name) === '.ts') sources.push(path);
	}
};
if (existsSync('src')) walk('src');

const offenders = (pattern) =>
	sources.filter((path) => pattern.test(readFileSync(path, 'utf8')));

const banned = [
	[/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML/, 'no innerHTML / outerHTML / insertAdjacentHTML'],
	[/\bvar\s/, 'no `var`'],
	[/\beval\s*\(/, 'no eval()'],
	[/\.style\.cssText/, 'no inline style.cssText'],
	[/vault\.modify\s*\(/, 'no Vault.modify (use Vault.process)'],
	[/getAbstractFileByPath/, 'no getAbstractFileByPath (use getFileByPath / getFolderByPath)'],
	[/hotkeys\s*:/, 'no default hotkeys on commands'],
	[/console\.(log|warn|info)\s*\(/, 'console shows errors only by default'],
];

for (const [pattern, label] of banned) {
	const hits = offenders(pattern);
	check(hits.length === 0, label, hits.join(', '));
}

check(sources.length > 0, 'source files found under src/');

// --- report ---
console.log(`\n${passed.length} checks passed`);
for (const warning of warnings) console.log(`  ! ${warning}`);
if (problems.length === 0) {
	console.log('\nReady to release.\n');
} else {
	console.log(`\n${problems.length} problem(s):`);
	for (const problem of problems) console.log(`  x ${problem}`);
	console.log('');
	process.exit(1);
}
