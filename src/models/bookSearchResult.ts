import { Book } from './book';

/**
 * A book as it comes back from a search.
 *
 * `editionKey` is how the provider identifies the specific edition, used to
 * look up details the search results leave out — the page count, mainly. It is
 * provider plumbing, so it never reaches the note's properties.
 */
export interface BookSearchResult extends Book {
	editionKey?: string;
}
