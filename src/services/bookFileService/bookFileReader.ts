import { App, TFile, normalizePath } from 'obsidian';
import { Book } from '../../models/book';
import { BookWithReadingHistory } from '../../models/bookWithReadingHistory';
import { ReadingSession } from '../../models/readingSession';
import { toReadingUnit } from '../../models/readingUnit';
import { FrontmatterConverter } from '../frontmatterService/frontmatterConverter';
import { NoteAccess } from '../frontmatterService/noteAccess';
import { Frontmatter } from '../frontmatterService/types';
import { ValidationUtils } from '../validationService';
import { FileNameGenerator } from '../pathService/fileNameGenerator';
import { PathManager } from '../pathService/pathManager';
import { ReadingIndex, DEFAULT_READING_HISTORY_HEADING } from './readingIndex';
import { SessionNoteReader } from '../sessionService/sessionNoteReader';

export class BookFileReader {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Read a book from a note's properties.
	 *
	 * Properties come from Obsidian's metadata cache, so this costs nothing and
	 * stays in step with edits the reader makes by hand.
	 * Returns an empty book for a note with no properties.
	 */
	read(file: TFile, validate: boolean = true): Partial<Book> {
		return this.fromFrontmatter(NoteAccess.frontmatter(this.app, file), validate);
	}

	/** As `read`, but also hands back the raw properties for callers that need the session index. */
	readWithFrontmatter(
		file: TFile,
		validate: boolean = true
	): { book: Partial<Book>; frontmatter: Frontmatter } {
		const frontmatter = NoteAccess.frontmatter(this.app, file) ?? {};
		return { book: this.fromFrontmatter(frontmatter, validate), frontmatter };
	}

	/**
	 * Read a book together with its sittings (from session notes and manual index entries).
	 * Returns null when the file has no valid book title.
	 */
	async readWithHistory(
		file: TFile,
		sessions: ReadingSession[],
		heading: string = DEFAULT_READING_HISTORY_HEADING
	): Promise<BookWithReadingHistory | null> {
		const bookData = this.read(file);
		if (!bookData.title) {
			return null;
		}

		const days = new Set(sessions.map((session) => session.date));
		let furthest = sessions.reduce((max, session) => Math.max(max, session.to), 0);
		const minutesRead = sessions.reduce((total, session) => total + (session.minutes ?? 0), 0);
		const quoteCount = sessions.reduce((total, session) => total + session.quoteCount, 0);
		let sessionCount = sessions.length;

		const unit = toReadingUnit(bookData.readingUnit);
		const body = await NoteAccess.body(this.app, file);
		for (const entry of ReadingIndex.parse(body, heading, unit)) {
			if (entry.hasLink) continue;
			days.add(entry.date);
			furthest = Math.max(furthest, entry.to);
			sessionCount++;
		}

		const readingDays = [...days].sort();

		return {
			...(bookData as Book),
			// A sitting can be ahead of `read_page` if the reader edited
			// the index or a session note by hand.
			readPage: Math.max(furthest, bookData.readPage ?? 0),
			lastReadDate: readingDays[readingDays.length - 1],
			readingDays,
			sessionCount,
			minutesRead,
			quoteCount,
		};
	}

	/**
	 * List all book notes in the configured books folder, sorted with currently-reading books first.
	 */
	listBooksInFolder(baseFolder: string): Array<{ book: Book; file: TFile }> {
		const folderPath = PathManager.getBooksFolderPath(baseFolder);
		const folder = this.app.vault.getFolderByPath(folderPath);
		if (!folder) {
			return [];
		}

		const results: Array<{ book: Book; file: TFile }> = [];
		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== 'md') {
				continue;
			}
			const bookData = this.read(child);
			if (bookData.title) {
				results.push({ book: bookData as Book, file: child });
			}
		}

		const priority: Record<string, number> = {
			reading: 0,
			unread: 1,
			abandoned: 2,
			finished: 3,
		};

		return results.sort((a, b) => {
			const orderDiff = (priority[a.book.status] ?? 9) - (priority[b.book.status] ?? 9);
			if (orderDiff !== 0) {
				return orderDiff;
			}
			return b.file.stat.mtime - a.file.stat.mtime;
		});
	}

	/**
	 * Load multiple book files together with their reading history.
	 */
	async readManyWithHistory(
		filePaths: string[],
		baseFolder: string,
		heading: string = DEFAULT_READING_HISTORY_HEADING
	): Promise<Array<{ book: BookWithReadingHistory; file: TFile }>> {
		const books: Array<{ book: BookWithReadingHistory; file: TFile }> = [];
		const sessionsByBook = new SessionNoteReader(this.app).byBook(baseFolder);

		for (const path of filePaths) {
			try {
				const vaultFile = this.app.vault.getFileByPath(path);
				if (!vaultFile) {
					continue;
				}

				const sessions = sessionsByBook.get(vaultFile.path) ?? [];
				const book = await this.readWithHistory(vaultFile, sessions, heading);
				if (book) {
					books.push({ book, file: vaultFile });
				}
			} catch (error) {
				console.error('[Reading Tracker] Error reading book with history:', error);
			}
		}

		return books;
	}

	private fromFrontmatter(frontmatter: Frontmatter | null, validate: boolean): Partial<Book> {
		if (!frontmatter) {
			return {};
		}
		const book = FrontmatterConverter.frontmatterToBook(frontmatter);
		return validate ? ValidationUtils.validateAndFixBook(book) : book;
	}

	findExisting(folderPath: string, title: string): TFile | null {
		const fileName = `${FileNameGenerator.generate(title)}.md`;
		const filePath = normalizePath(`${folderPath}/${fileName}`);
		return this.app.vault.getFileByPath(filePath);
	}
}
