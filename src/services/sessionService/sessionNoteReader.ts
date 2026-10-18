import { App, TFile } from 'obsidian';
import { ReadingSession } from '../../models/readingSession';
import { PathManager } from '../pathService/pathManager';
import { NoteAccess } from '../frontmatterService/noteAccess';

/**
 * Collects reading sessions from the session notes.
 *
 * Everything needed comes from each note's properties by way of Obsidian's
 * metadata cache, so a whole library's worth of sessions is read without
 * opening a single file — and a session note's body stays free-form, because
 * nothing ever parses it.
 */
export class SessionNoteReader {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/** Every session in the vault, grouped by the book note it belongs to. */
	byBook(baseFolder: string): Map<string, ReadingSession[]> {
		const grouped = new Map<string, ReadingSession[]>();
		const folder = this.app.vault.getFolderByPath(PathManager.getSessionsFolderPath(baseFolder));
		if (!folder) {
			return grouped;
		}

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== 'md') {
				continue;
			}

			const session = this.read(child);
			if (!session) {
				continue;
			}

			const existing = grouped.get(session.bookPath);
			if (existing) {
				existing.push(session);
			} else {
				grouped.set(session.bookPath, [session]);
			}
		}

		for (const sessions of grouped.values()) {
			sessions.sort((a, b) => a.date.localeCompare(b.date));
		}
		return grouped;
	}

	/** Read one session note, or null when it isn't one. */
	read(file: TFile): ReadingSession | null {
		const frontmatter = NoteAccess.frontmatter(this.app, file);
		if (!frontmatter) {
			return null;
		}

		const bookPath = this.resolveBook(frontmatter.book, file.path);
		const date = typeof frontmatter.date === 'string' ? frontmatter.date : undefined;
		const to = typeof frontmatter.to === 'number' ? frontmatter.to : undefined;
		if (!bookPath || !date || to === undefined) {
			return null;
		}

		return {
			bookPath,
			date,
			from: typeof frontmatter.from === 'number' ? frontmatter.from : 0,
			to,
			minutes: typeof frontmatter.minutes === 'number' ? frontmatter.minutes : undefined,
			quoteCount: typeof frontmatter.quotes === 'number' ? frontmatter.quotes : 0,
			notePath: file.path,
		};
	}

	/**
	 * `book` is a link, so resolve it through Obsidian's own link resolution —
	 * the session keeps pointing at the right note after the book is renamed.
	 */
	private resolveBook(value: unknown, sourcePath: string): string | null {
		if (typeof value !== 'string') {
			return null;
		}

		const linkpath = value.match(/\[\[([^\]|#]+)/)?.[1] ?? value.match(/\]\(([^)]+)\)/)?.[1] ?? value;
		const target = this.app.metadataCache.getFirstLinkpathDest(
			decodeURIComponent(linkpath).replace(/\.md$/, '').trim(),
			sourcePath
		);
		return target?.path ?? null;
	}
}
