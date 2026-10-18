/**
 * The parts of the Open Library API this plugin actually reads.
 *
 * Open Library returns a great deal more than this; only the fields used to
 * fill in a book note are declared, so it stays obvious what the plugin looks
 * at. https://openlibrary.org/dev/docs/api/search
 */

/** One hit from `/search.json`. */
export interface OpenLibrarySearchDoc {
	title: string;
	subtitle?: string;
	author_name?: string[];
	publisher?: string[];
	publish_date?: string[];
	publish_year?: number[];
	first_publish_year?: number;
	number_of_pages?: number;
	number_of_pages_median?: number;
	subject?: string[];
	/** Cover image id, used to build a cover URL. */
	cover_i?: number;
	/** Identifies the edition to look up for details the search omits. */
	cover_edition_key?: string;
}

export interface OpenLibrarySearchResponse {
	docs: OpenLibrarySearchDoc[];
}

/** A specific edition, from `/books/{olid}.json` — this is where page counts live. */
export interface OpenLibraryEdition {
	title: string;
	subtitle?: string;
	authors?: Array<{ key: string; name?: string }>;
	publishers?: string[];
	publish_date?: string;
	number_of_pages?: number;
	isbn_10?: string[];
	isbn_13?: string[];
	covers?: number[];
	subjects?: string[];
	works?: Array<{ key: string }>;
}

/** The work an edition belongs to, from `/works/{id}.json` — used as a fallback. */
export interface OpenLibraryWork {
	title: string;
	subtitle?: string;
	publishers?: string[];
	publish_date?: string;
	number_of_pages?: number;
	subjects?: string[];
}
