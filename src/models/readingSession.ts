/**
 * One sitting with a book — the unit this plugin records.
 *
 * A session is a note of its own: its properties hold the facts (which book,
 * which day, how far, how long) and its body holds whatever the reader wrote.
 * Nothing in the body is ever parsed, so the passages and reflections in it can
 * take any shape at all, and there can be as many of them as the sitting
 * deserved.
 */
export interface ReadingSession {
	/** The book note this session belongs to. */
	bookPath: string;
	/** YYYY-MM-DD */
	date: string;
	/** Position this sitting started from. */
	from: number;
	/** Position it ended at. */
	to: number;
	/** How long it lasted, in minutes, when the reader said. */
	minutes?: number;
	/** How many passages were copied out. */
	quoteCount: number;
	/** The session note itself, for sessions that have one. */
	notePath?: string;
}

/** How far a sitting got. */
export function sessionAmount(session: ReadingSession): number {
	return Math.max(0, session.to - session.from);
}

/** One passage copied out, and where it came from. */
export interface QuoteDraft {
	text: string;
	page?: number;
	line?: number;
}

/** What the reader typed into the record dialog. */
export interface SessionDraft {
	/** YYYY-MM-DD; defaults to today when omitted. */
	date?: string;
	from: number;
	to: number;
	minutes?: number;
	/** Every passage copied out during this sitting, in the order they were read. */
	quotes: QuoteDraft[];
	/** What the reader made of it. */
	thoughts?: string;
	/** Mark the book finished with this sitting (even if `to` is before `total`). */
	finished?: boolean;
	/** Record the session, then mark the book abandoned. */
	abandoned?: boolean;
	/** A number sets the rating, `null` clears it, `undefined` leaves it alone. */
	rating?: number | null;
}

/** The passages that actually have something in them. */
export function filledQuotes(draft: SessionDraft): QuoteDraft[] {
	return draft.quotes.filter((quote) => quote.text.trim() !== '');
}
