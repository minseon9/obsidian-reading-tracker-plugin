/**
 * Builds a throwaway vault for verifying the plugin by hand, with this repo
 * symlinked in as the plugin — so `npm run dev` rebuilds land in the vault and
 * "Reload app without saving" picks them up.
 *
 *   node scripts/setup-test-vault.mjs [path]
 *
 * Defaults to ../reading-tracker-testvault. Never point it at a real vault:
 * it deletes and recreates whatever path it is given.
 *
 * The notes it seeds are the awkward cases — a book note the plugin did not
 * write, a note in the books folder that is not a book, and a 0.2.x note whose
 * old history has to survive untouched.
 */
import { mkdirSync, rmSync, writeFileSync, symlinkSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vault = resolve(process.argv[2] ?? join(repo, '..', 'reading-tracker-testvault'));

if (existsSync(join(vault, '.obsidian', 'workspace.json'))) {
	console.error(`Refusing to touch ${vault}: it looks like a vault you have been using.`);
	console.error('Delete it yourself first, or pass a different path.');
	process.exit(1);
}

rmSync(vault, { recursive: true, force: true });
mkdirSync(join(vault, '.obsidian', 'plugins'), { recursive: true });

const write = (relative, contents) => {
	const path = join(vault, relative);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents);
};

write('.obsidian/core-plugins.json', JSON.stringify({
	'file-explorer': true,
	'global-search': true,
	switcher: true,
	backlink: true,
	'outgoing-link': true,
	properties: true,
	'page-preview': true,
	'command-palette': true,
	'editor-status': true,
	outline: true,
	'word-count': true,
	'file-recovery': true,
	bases: true,
}, null, 2));

write('.obsidian/community-plugins.json', JSON.stringify(['reading-tracker'], null, 2));

symlinkSync(repo, join(vault, '.obsidian', 'plugins', 'reading-tracker'));

// A book note the plugin did not write, with a hand-written index.
write('Reading Tracker/Books/소년이 온다.md', `---
title: 소년이 온다
author: [한강]
category: [소설]
publisher: 창비
total: 216
status: reading
reading_unit: pages
read_page: 140
read_started: 2026-10-01 21:40:00
---

# 소년이 온다

## Reading History

- 2026-10-01: 0-95
- 2026-10-02: 140
`);

// No book properties, so it must not get a Record reading action.
write('Reading Tracker/Books/_index.md', `# 읽는 중인 책 목록

This note has no book properties, so the header action must stay off it.
`);

// A 0.2.x note: the old history block has to be read and left alone.
write('Reading Tracker/Books/Frankenstein.md', `---
title: Frankenstein
author: [Mary Shelley]
total: 280
status: reading
read_page: 150
created: 2026-01-28 10:00:00
updated: 2026-01-28 15:30:00
reading_history_summary:
  - date: 2026-01-28
    startPage: 0
    endPage: 150
    pagesRead: 150
    timestamp: 2026-01-28 15:30:00
---

# Frankenstein

## Reading History

### 2026-01-28

- **Start Page:** 0
- **End Page:** 150
- **Pages Read:** 150
- **Timestamp:** 2026-01-28 15:30:00
- **Notes:**

  This line has to survive the upgrade exactly as it is.
`);

console.log(`Test vault ready at ${vault}`);
console.log('Open it in Obsidian with "Open folder as vault", then enable Reading Tracker.');
console.log('Checklist: docs/RELEASING.md');
