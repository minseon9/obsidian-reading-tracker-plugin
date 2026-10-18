import { App, TFile } from 'obsidian';
import { Frontmatter } from './types';

/** Matches the leading `---` block of a note, without interpreting its contents. */
const FRONTMATTER_BLOCK = /^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/;

/**
 * Reads and writes notes through Obsidian's own metadata APIs.
 *
 * The plugin deliberately never parses or re-serialises YAML itself. Obsidian
 * already keeps a parsed copy of every note's properties in the metadata cache,
 * and `processFrontMatter` edits only the keys it is handed — so a reader's own
 * quoting, key order, comments, and any property this plugin doesn't know about
 * all survive a progress update untouched.
 */
export class NoteAccess {
	/**
	 * A note's properties, straight from the metadata cache — no file read.
	 * Returns null for a note Obsidian has not indexed yet, or one with no
	 * properties at all.
	 */
	static frontmatter(app: App, file: TFile): Frontmatter | null {
		const cached = app.metadataCache.getFileCache(file)?.frontmatter;
		return cached ?? null;
	}

	/** A note's body, with the properties block removed. */
	static async body(app: App, file: TFile): Promise<string> {
		const content = await app.vault.cachedRead(file);
		return NoteAccess.stripFrontmatter(content);
	}

	/** Edit a note's properties in place, leaving everything else as written. */
	static async updateFrontmatter(
		app: App,
		file: TFile,
		mutate: (frontmatter: Frontmatter) => void
	): Promise<void> {
		await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			mutate(frontmatter);
		});
	}

	/**
	 * Edit a note's body, leaving its properties block byte-for-byte alone.
	 * `vault.process` makes the read-modify-write atomic.
	 */
	static async updateBody(app: App, file: TFile, mutate: (body: string) => string): Promise<void> {
		await app.vault.process(file, (content) => {
			const head = NoteAccess.frontmatterBlock(content);
			return head + mutate(content.slice(head.length));
		});
	}

	/** The raw `---` block of a note, or an empty string when it has none. */
	private static frontmatterBlock(content: string): string {
		return content.match(FRONTMATTER_BLOCK)?.[0] ?? '';
	}

	private static stripFrontmatter(content: string): string {
		return content.slice(NoteAccess.frontmatterBlock(content).length);
	}
}
