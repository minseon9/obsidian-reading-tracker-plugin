/**
 * Copies the built plugin into a vault, for using it before it is in the
 * community directory.
 *
 *   node scripts/deploy-to-vault.mjs <vault path>
 *
 * A copy, not a symlink: the vault keeps working if this repo moves. Re-run it
 * after every `npm run build`. For developing against a throwaway vault, use
 * `npm run test-vault` instead, which symlinks and needs no re-running.
 */
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const vault = process.argv[2] ? resolve(process.argv[2]) : null;

if (!vault) {
	console.error('Usage: npm run deploy -- <vault path>');
	process.exit(1);
}
if (!existsSync(join(vault, '.obsidian'))) {
	console.error(`${vault} has no .obsidian folder — is it a vault?`);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const target = join(vault, '.obsidian', 'plugins', manifest.id);

const required = ['main.js', 'manifest.json'];
const missing = required.filter((file) => !existsSync(file));
if (missing.length > 0) {
	console.error(`Missing ${missing.join(', ')} — run \`npm run build\` first.`);
	process.exit(1);
}

// A symlinked plugin folder is a dev vault pointing back at this repo; copying
// into it would just write these files onto themselves.
if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
	console.log(`${target} is a symlink to this repo — nothing to copy.`);
	console.log('`npm run build` alone updates that vault.');
	process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of [...required, 'styles.css']) {
	if (existsSync(file)) {
		copyFileSync(file, join(target, file));
	}
}

console.log(`${manifest.name} ${manifest.version} → ${target}`);
console.log('In Obsidian: Settings → Community plugins → Reload, then enable it.');
console.log('Already enabled? Ctrl/Cmd+P → "Reload app without saving".');
