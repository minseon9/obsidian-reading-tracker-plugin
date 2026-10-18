# Releasing

Two different things live here: how to **verify a build locally**, and how to
**publish and submit** it. Do them in that order.

---

## 1. Verify locally

### Everything the machine can check

```bash
npm run verify
```

That is `build` → `lint` → `validate` → `smoke`:

| Step | What it proves |
| --- | --- |
| `build` | TypeScript type-checks, and `main.js` + `styles.css` are produced |
| `lint` | ESLint plus `eslint-plugin-obsidianmd` — sentence case, API misuse, unused code |
| `validate` | `scripts/validate-release.mjs`, which mirrors the community directory's automated checks (see below) |
| `smoke` | `scripts/smoke-test.cjs` loads `main.js` the way Obsidian does, with a stubbed API, and constructs the plugin |

`validate` covers: manifest fields present and well-formed; `id` lowercase and
free of `obsidian`; `version` semver with no leading `v`; `versions.json` valid,
covering this version, and agreeing with `minAppVersion`; `package.json` version
matching; required root files; release assets built; and a source scan for
`innerHTML`, `var`, `eval`, inline `cssText`, `Vault.modify`,
`getAbstractFileByPath`, default hotkeys, and non-error console logging.

`smoke` catches what only appears at load time: a syntax error, a top-level
throw, a missing default export, an unbundled dependency, a leftover sourcemap
from a `dev` build.

Both run in CI on every push, and again in the release workflow before a tag is
published.

### Using it in a real vault

Until the plugin is in the community directory, install it by hand:

```bash
npm run build
npm run deploy -- /path/to/your/vault
```

That copies `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/reading-tracker/`. In Obsidian, turn off **Restricted
mode** under Settings → Community plugins, hit **Reload**, and enable *Reading
Tracker*. Re-run both commands after each change; if the plugin is already
enabled, `Ctrl/Cmd+P → Reload app without saving` picks the new build up.

Enabling it creates `Reading Tracker/Books`, `Reading Tracker/Sessions` and
`Reading Tracker/Views` at the vault root, with four `.base` files in Views. To
keep everything somewhere else, change **Reading tracker folder** in settings
and delete the empty default folders.

### What only a person can check

The scripts cannot open Obsidian. For that, build a throwaway vault:

```bash
npm run test-vault          # ../reading-tracker-testvault
npm run test-vault -- <path> # or somewhere else
```

It symlinks this repo in as `.obsidian/plugins/reading-tracker`, so `npm run
dev` rebuilds land in the vault and `Ctrl/Cmd+P → Reload app without saving`
picks them up. It refuses to touch a path that looks like a vault you have been
using, but never point it at real notes: it recreates whatever path it is given.

The vault starts with three notes that exercise the awkward cases:

| Note | What it is for |
| --- | --- |
| `Books/소년이 온다.md` | A book note the plugin did not write, with a hand-written index |
| `Books/_index.md` | A note in the books folder with no book properties |
| `Books/Frankenstein.md` | A 0.2.x note: old `### date` history block, `created`/`updated`, `reading_history_summary` |

Open that vault in Obsidian (**Open folder as vault**), enable **Reading
Tracker** under Settings → Community plugins, and work through the checklist:

**On load**

- [ ] `Reading Tracker/Sessions/` and `Reading Tracker/Views/` appear
- [ ] `shelf.base`, `library.base`, `sessions.base`, `statistics.base` are created
- [ ] No errors in the console (`Cmd+Opt+I`)

**Book notes**

- [ ] Opening `소년이 온다` shows a book icon in the note header
- [ ] Opening `_index.md` does **not** — it has no book properties
- [ ] Opening `Frankenstein` shows it, and its old history block is untouched

**Recording a sitting** — on `소년이 온다`, click the header icon

- [ ] **From** is prefilled with 140, the furthest the hand-written index reached
- [ ] Enter To 216, Minutes 90, a passage with page 152 line 7, then **Add passage** for a second with page 168, and some thoughts
- [ ] A note appears at `Sessions/2026-… 소년이 온다.md` and opens
- [ ] Its properties carry `book`, `date`, `from`, `to`, `amount`, `unit`, `minutes`, and `quotes: 2`
- [ ] Its body shows two quote callouts, titled `p.152 l.7` and `p.168`, then the thoughts
- [ ] The ✕ on a passage removes it, and is hidden when only one row is left
- [ ] `book` resolves as a link, and the book note shows a backlink
- [ ] The book note's index gained `- …: 140-216 — [[…]]`
- [ ] The book note's `read_page` is now 216, and its other properties kept their formatting
- [ ] Recording a second sitting the same day produces `… 2.md`, not an overwrite

**Searching**

- [ ] Ribbon → **Search and add book**, search `frankenstein`, add one; the note is created with its cover and page count
- [ ] Search `불편한 편의점` — no results, and **Add "불편한 편의점" by hand** appears
- [ ] That button creates the book note and opens it; filling in `total` makes progress work

**Views**

- [ ] `shelf.base` renders, with Reading and To Read sections
- [ ] Drag an unread book into Reading, and use **Start reading** on another — both set `status: reading`
- [ ] `library.base` groups unread, finished and abandoned
- [ ] `sessions.base` lists the sittings as a table
- [ ] `statistics.base` shows pages, reading days, time spent and the charts

**Status**

- [ ] Recording past `total` sets `status: finished` and `read_finished`
- [ ] **Give up on this book** sets `status: abandoned`; recording again returns it to `reading`

**Unload**

- [ ] Disabling the plugin leaves no errors, and the views stop rendering cleanly

---

## 2. Publish and submit

Obsidian changed how plugins get into the community directory. **You no longer
open a pull request against `obsidianmd/obsidian-releases`.** Submission happens
through the directory web app, which verifies repository ownership through your
linked GitHub account and runs the review checks itself.

### One-time setup

1. Create an Obsidian account if you do not have one.
2. Sign in at <https://community.obsidian.md>.
3. Link your GitHub account to your profile. This is what lets the directory
   verify that you own `minseon9/obsidian-reading-tracker-plugin`.

### Cut the release

The release workflow is tag-driven and refuses a tag that does not match the
manifest, so bump the version first.

```bash
npm run verify            # don't tag something that doesn't pass
npm version 0.5.1         # updates package.json, manifest.json, versions.json
git push origin master
git push origin 0.5.1     # the tag must be exactly the version — no leading "v"
```

`.github/workflows/release.yml` then:

1. checks the tag against `manifest.json`'s `version` and that `versions.json`
   has an entry for it,
2. runs `npm ci`, then `build`, `lint`, `validate` and `smoke`,
3. publishes a GitHub release tagged with the version, attaching `main.js`,
   `manifest.json` and `styles.css` as individual assets.

The three assets must be attached individually — a zip is not accepted.

### Submit

1. Go to <https://community.obsidian.md> and add your plugin.
2. The directory reads `manifest.json` from the default branch's HEAD, so push
   `master` before submitting.
3. Automated review runs and the directory shows anything that needs
   correcting. Address it by publishing a **new release with an incremented
   version** — the checks cannot be re-run against the same version.

### Where this plugin stands

| Check | Status |
| --- | --- |
| `id` unique in the directory, no `obsidian` in it | `reading-tracker` — unused as of this writing |
| `id` never changes after the first release | fixed |
| `version` semver, matching the release tag | enforced by the release workflow |
| `versions.json` valid and covering each release | enforced by `npm run validate` |
| `isDesktopOnly` accurate | `true`. The plugin uses no Node or Electron API, so a reviewer may ask why — the reason is the interface, which assumes a desktop-sized window, not an API dependency. |
| `README.md`, `LICENSE`, `manifest.json` at the repo root | yes |
| No `innerHTML` / `outerHTML` / `insertAdjacentHTML` | enforced by `validate` |
| No inline styles; styling lives in `styles.css` | enforced by `validate` |
| Sentence case in UI strings | enforced by `eslint-plugin-obsidianmd` |
| `Vault.process()` / `processFrontMatter()` for edits | `noteAccess.ts`; `Vault.modify` is rejected by `validate` |
| `getFileByPath()` / `getFolderByPath()` | enforced by `validate` |
| Console shows errors only by default | enforced by `validate` |
| No default hotkeys | enforced by `validate` |
| No telemetry; one disclosed network call | `src/apis/openLibrary.ts`, Open Library only |
| No runtime dependencies to vet | `package.json` |
| Listeners and timers cleaned up on unload | `register*` helpers in `main.ts` |

### After acceptance

Announce it in the forum's Share & Showcase section and in Discord's `#updates`
channel, which needs the developer role.
