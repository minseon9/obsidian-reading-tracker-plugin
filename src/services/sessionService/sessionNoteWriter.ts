import { App, TFile, normalizePath } from 'obsidian';
import { QuoteDraft, ReadingSession, SessionDraft, filledQuotes, sessionAmount } from '../../models/readingSession';
import { ReadingUnit, formatPosition } from '../../models/readingUnit';
import { FileNameGenerator } from '../pathService/fileNameGenerator';
import { FolderManager } from '../pathService/folderManager';
import { PathManager } from '../pathService/pathManager';
import { NoteAccess } from '../frontmatterService/noteAccess';

/** Enough sittings in one day with one book that hitting it means something is wrong. */
const MAX_SESSIONS_PER_DAY = 50;

/**
 * Creates the note for one sitting.
 *
 * Properties carry the facts, so views and statistics can read a session
 * without opening the file. The body is the reader's — a quote callout to start
 * it off, then room to write. Nothing in the body is read back.
 */
export class SessionNoteWriter {
	private app: App;
	private folderManager: FolderManager;

	constructor(app: App) {
		this.app = app;
		this.folderManager = new FolderManager(app);
	}

	async create(
		bookFile: TFile,
		bookTitle: string,
		draft: SessionDraft,
		date: string,
		unit: ReadingUnit,
		baseFolder: string
	): Promise<{ file: TFile; session: ReadingSession }> {
		const folder = PathManager.getSessionsFolderPath(baseFolder);
		await this.folderManager.ensureFolder(folder);

		const file = await this.createNote(folder, date, bookTitle, SessionNoteWriter.body(draft));
		const quoteCount = filledQuotes(draft).length;
		const session: ReadingSession = {
			bookPath: bookFile.path,
			date,
			from: draft.from,
			to: draft.to,
			minutes: draft.minutes,
			quoteCount,
			notePath: file.path,
		};

		// Let Obsidian link and serialise, so the vault's own link format is used
		// and the book note collects a backlink from every sitting.
		const link = this.app.fileManager.generateMarkdownLink(bookFile, file.path);

		await NoteAccess.updateFrontmatter(this.app, file, (frontmatter) => {
			frontmatter.book = link;
			frontmatter.date = date;
			frontmatter.from = session.from;
			frontmatter.to = session.to;
			frontmatter.amount = sessionAmount(session);
			frontmatter.unit = unit;
			if (session.minutes !== undefined) {
				frontmatter.minutes = session.minutes;
			}
			if (quoteCount > 0) {
				// A count, not the pages: the passages and their citations live in
				// the body, and nothing here should be a second copy of them.
				frontmatter.quotes = quoteCount;
			}
		});

		return { file, session };
	}

	/**
	 * Write the note as `2026-10-04 소년이 온다.md`, numbered if that day already
	 * has one.
	 *
	 * The name is settled by trying to create it rather than by looking first:
	 * two sittings recorded moments apart would both see a free name, because
	 * the vault index has not caught up with the first one yet.
	 */
	private async createNote(
		folder: string,
		date: string,
		bookTitle: string,
		body: string
	): Promise<TFile> {
		const stem = `${date} ${FileNameGenerator.generate(bookTitle)}`;

		for (let attempt = 1; attempt <= MAX_SESSIONS_PER_DAY; attempt++) {
			const name = attempt === 1 ? stem : `${stem} ${attempt}`;
			const path = normalizePath(`${folder}/${name}.md`);

			try {
				return await this.app.vault.create(path, body);
			} catch (error) {
				if (!FolderManager.isAlreadyExists(error)) {
					throw error;
				}
			}
		}

		throw new Error(`Already ${MAX_SESSIONS_PER_DAY} sessions recorded for "${bookTitle}" on ${date}.`);
	}

	/**
	 * Each passage gets its own quote callout, titled with the page and line it
	 * came from; everything else the reader wrote follows as ordinary prose.
	 */
	private static body(draft: SessionDraft): string {
		const blocks = filledQuotes(draft).map((quote) => SessionNoteWriter.callout(quote));

		const thoughts = draft.thoughts?.replace(/\s+$/, '');
		if (thoughts) {
			blocks.push(thoughts);
		}

		return blocks.length === 0 ? '' : `${blocks.join('\n\n')}\n`;
	}

	/** One passage as a quote callout. */
	private static callout(quote: QuoteDraft): string {
		const lines = [`> [!quote]${SessionNoteWriter.citation(quote)}`];
		for (const line of quote.text.replace(/\s+$/, '').split('\n')) {
			lines.push(line.trim() === '' ? '>' : `> ${line}`);
		}
		return lines.join('\n');
	}

	/** ` p.152 l.7`, or empty when the passage has no location. */
	private static citation(quote: QuoteDraft): string {
		if (quote.page === undefined) {
			return '';
		}
		const line = quote.line !== undefined ? ` l.${quote.line}` : '';
		return ` p.${quote.page}${line}`;
	}

	/** The line that indexes this session on the book note. */
	indexLine(session: ReadingSession, unit: ReadingUnit, bookNotePath: string): string {
		const range = `${formatPosition(session.from, unit)}-${formatPosition(session.to, unit)}`;
		const sessionFile = session.notePath ? this.app.vault.getFileByPath(session.notePath) : null;
		const link = sessionFile
			? ` — ${this.app.fileManager.generateMarkdownLink(sessionFile, bookNotePath)}`
			: '';
		return `- ${session.date}: ${range}${link}`;
	}
}
