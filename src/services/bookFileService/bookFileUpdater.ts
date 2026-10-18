import { App, TFile } from 'obsidian';
import { Book } from '../../models/book';
import { toBookStatus } from '../../models/bookStatus';
import { ReadingSession, SessionDraft } from '../../models/readingSession';
import { effectiveTotal, toReadingUnit } from '../../models/readingUnit';
import { ReadingTrackerSettings, DEFAULT_SETTINGS } from '../../settings/types';
import { FrontmatterConverter } from '../frontmatterService/frontmatterConverter';
import { NoteAccess } from '../frontmatterService/noteAccess';
import { Frontmatter } from '../frontmatterService/types';
import { SessionNoteWriter } from '../sessionService/sessionNoteWriter';
import { ReadingIndex } from './readingIndex';
import { formatDate, formatDateTime } from '../../utils/dateUtils';

export class BookFileUpdater {
	private app: App;
	private settings: ReadingTrackerSettings;
	private sessionWriter: SessionNoteWriter;

	constructor(app: App, settings: ReadingTrackerSettings = DEFAULT_SETTINGS) {
		this.app = app;
		this.settings = settings;
		this.sessionWriter = new SessionNoteWriter(app);
	}

	/** Write the given book fields back to the note, touching no other property. */
	async updateBook(file: TFile, updates: Partial<Book>): Promise<void> {
		await NoteAccess.updateFrontmatter(this.app, file, (frontmatter) => {
			FrontmatterConverter.applyToFrontmatter(frontmatter, updates);
		});
	}

	/** Mark a book as currently being read, setting `read_started` on its first transition. */
	async startReading(file: TFile): Promise<void> {
		await NoteAccess.updateFrontmatter(this.app, file, (frontmatter) => {
			frontmatter.status = 'reading';
			if (!frontmatter.read_started) {
				frontmatter.read_started = formatDateTime();
			}
		});
	}

	/**
	 * Record one sitting with a book.
	 *
	 * Three things happen, in order: the sitting gets its own note, the book
	 * note's index gains a line pointing at it, and the book's properties catch
	 * up with where the reader now is. Each write touches only its own file.
	 *
	 * Returns the session and its note, so the caller can open it.
	 */
	async recordSession(
		bookFile: TFile,
		draft: SessionDraft
	): Promise<{ session: ReadingSession; sessionFile: TFile }> {
		const frontmatter = NoteAccess.frontmatter(this.app, bookFile);
		const unit = toReadingUnit(frontmatter?.reading_unit);
		const title = BookFileUpdater.resolveBookTitle(frontmatter, bookFile);
		const sessionDate = draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
			? draft.date
			: formatDate();

		const { file: sessionFile, session } = await this.sessionWriter.create(
			bookFile,
			title,
			draft,
			sessionDate,
			unit,
			this.settings.bookFolder
		);

		const line = this.sessionWriter.indexLine(session, unit, bookFile.path);
		await NoteAccess.updateBody(this.app, bookFile, (body) =>
			ReadingIndex.appendLine(body, line, this.settings.readingHistoryHeading)
		);

		await NoteAccess.updateFrontmatter(this.app, bookFile, (properties) => {
			properties.read_page = draft.to;
			BookFileUpdater.applyStatus(properties, draft, sessionDate);
			if (draft.rating !== undefined) {
				properties.rating = draft.rating ?? undefined;
			}
		});

		return { session, sessionFile };
	}

	/** The furthest position reached so far, from the index or the book itself. */
	static lastPosition(frontmatter: Frontmatter | null, body: string, heading: string): number {
		const unit = toReadingUnit(frontmatter?.reading_unit);
		const furthest = ReadingIndex.parse(body, heading, unit).reduce(
			(max, entry) => Math.max(max, entry.to),
			0
		);
		const readPage = typeof frontmatter?.read_page === 'number' ? frontmatter.read_page : 0;
		return Math.max(furthest, readPage);
	}

	private static resolveBookTitle(frontmatter: Frontmatter | null, bookFile: TFile): string {
		return typeof frontmatter?.title === 'string' && frontmatter.title.trim()
			? frontmatter.title
			: bookFile.basename;
	}

	private static applyStatus(
		frontmatter: Frontmatter,
		draft: SessionDraft,
		sessionDate: string
	): void {
		if (draft.abandoned) {
			frontmatter.status = 'abandoned';
			return;
		}

		const unit = toReadingUnit(frontmatter.reading_unit);
		const rawTotal = typeof frontmatter.total === 'number' ? frontmatter.total : undefined;
		const total = effectiveTotal(rawTotal, unit);
		const timestamp = sessionDate === formatDate() ? formatDateTime() : `${sessionDate} 00:00:00`;

		if (draft.finished || (total && draft.to >= total)) {
			frontmatter.status = 'finished';
			if (!frontmatter.read_finished) {
				frontmatter.read_finished = timestamp;
			}
			return;
		}

		// Picking an abandoned book back up puts it on the shelf again. A finished
		// book is left alone, so correcting its last session can't un-finish it.
		const status = toBookStatus(frontmatter.status);
		if (draft.to > 0 && (status === 'unread' || status === 'abandoned')) {
			frontmatter.status = 'reading';
			if (!frontmatter.read_started) {
				frontmatter.read_started = timestamp;
			}
		}
	}
}
