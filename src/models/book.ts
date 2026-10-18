import { BookStatus } from './bookStatus';
import { ReadingUnit } from './readingUnit';

/**
 * A book, as described by its note's properties.
 *
 * There is no `created` or `updated` field: Obsidian already tracks both on
 * every file, so duplicating them into properties would only give the reader
 * two numbers to keep in step.
 */
export interface Book {
	// Basic information
	title: string;
	subtitle?: string;
	author: string[];

	// Publication information
	publisher?: string;
	publishDate?: string;
	totalPages?: number;
	isbn?: string;

	// Metadata
	coverUrl?: string;
	category?: string[];

	// Shelf organisation
	series?: string;
	seriesPosition?: number;

	// Reading status
	status: BookStatus;
	readingUnit?: ReadingUnit;
	readPage?: number;
	readStarted?: string;
	readFinished?: string;
	rating?: number;
}

/** Format series name and position, e.g. `Earthsea #1`, or undefined when not part of a series. */
export function formatSeriesLabel(book: Pick<Book, 'series' | 'seriesPosition'>): string | undefined {
	if (!book.series) {
		return undefined;
	}
	return book.seriesPosition !== undefined
		? `${book.series} #${book.seriesPosition}`
		: book.series;
}

/** Format a book's title together with its series when present, e.g. `A Wizard of Earthsea — Earthsea #1`. */
export function formatBookTitleWithSeries(book: Pick<Book, 'title' | 'series' | 'seriesPosition'>): string {
	const seriesLabel = formatSeriesLabel(book);
	return seriesLabel ? `${book.title} — ${seriesLabel}` : book.title;
}
