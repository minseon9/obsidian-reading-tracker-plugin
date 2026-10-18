import { Book } from './book';

/**
 * A book plus the facts gathered from its reading sessions, so each view does
 * not have to collect them again.
 */
export interface BookWithReadingHistory extends Book {
	/** Date of the most recent sitting, if any. */
	lastReadDate?: string;
	/** Distinct dates the book was read on, oldest first. */
	readingDays: string[];
	/** How many sittings are recorded. */
	sessionCount: number;
	/** Minutes spent, across the sittings that said. */
	minutesRead: number;
	/** How many passages were copied out across sittings. */
	quoteCount: number;
}
