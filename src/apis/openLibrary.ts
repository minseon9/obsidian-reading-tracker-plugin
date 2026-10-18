import {Book} from '../models/book';
import {BookSearchResult} from '../models/bookSearchResult';
import {createBookFromData} from '../models/bookFactory';
import {getJson} from '../utils/httpClientUtils';
import {OpenLibraryEdition, OpenLibrarySearchDoc, OpenLibrarySearchResponse, OpenLibraryWork,} from './types';

export class OpenLibraryClient {
	private baseUrl = 'https://openlibrary.org';

	async searchBooks(query: string, limit: number = 20, offset: number = 0): Promise<BookSearchResult[]> {
		try {
			const encodedQuery = encodeURIComponent(query);
			const url = `${this.baseUrl}/search.json?q=${encodedQuery}&limit=${limit}&offset=${offset}`;
			const data = await getJson<OpenLibrarySearchResponse>(url);
			return this.convertSearchDocsToBooks(data.docs);
		} catch {
			throw new Error(`Failed to search books. Please try again later.`);
		}
	}

	async getBookByOLID(olid: string): Promise<Book | null> {
		try {
			const url = `${this.baseUrl}/books/${olid}.json`;
			const edition = await getJson<OpenLibraryEdition>(url);
			const work = await this.fetchWorkDetails(edition);
			return this.convertEditionToBook(edition, work);
		} catch (error) {
			console.error('[OpenLibrary] Error fetching book by OLID:', error);
			return null;
		}
	}

	private async fetchWorkDetails(edition: OpenLibraryEdition): Promise<OpenLibraryWork | null> {
		if (!edition.works || edition.works.length === 0) {
			return null;
		}

		const firstWork = edition.works[0];
		if (!firstWork?.key) {
			return null;
		}

		try {
			const workUrl = `${this.baseUrl}${firstWork.key}.json`;
			return await getJson<OpenLibraryWork>(workUrl);
		} catch {
			return null;
		}
	}

	getBookCover(coverId: number | string, size: 'S' | 'M' | 'L' = 'M'): string {
		const sizeMap = { S: '-S', M: '-M', L: '-L' };
		if (typeof coverId === 'number') {
			return `https://covers.openlibrary.org/b/id/${coverId}${sizeMap[size]}.jpg`;
		}
		return `https://covers.openlibrary.org/b/isbn/${coverId}${sizeMap[size]}.jpg`;
	}

	private convertEditionToBook(edition: OpenLibraryEdition, work: OpenLibraryWork | null, isbn?: string): Book {
		const authors = this.extractAuthors(edition);
		const resolvedIsbn = edition.isbn_13?.[0] || edition.isbn_10?.[0] || isbn;
		const coverUrl = this.extractCoverUrl(edition, resolvedIsbn);
		const totalPages = edition.number_of_pages ?? work?.number_of_pages;

		return createBookFromData({
			title: edition.title || work?.title || '',
			subtitle: edition.subtitle || work?.subtitle,
			author: authors,
			isbn: resolvedIsbn,
			publisher: edition.publishers?.[0] || work?.publishers?.[0],
			publishDate: edition.publish_date || work?.publish_date,
			totalPages,
			coverUrl,
			category: edition.subjects?.slice(0, 5) || work?.subjects?.slice(0, 5) || [],
		});
	}

	private extractAuthors(edition: OpenLibraryEdition): string[] {
		if (!edition.authors || !Array.isArray(edition.authors)) {
			return [];
		}
		return edition.authors.map(a => a.name || '').filter(name => name.length > 0);
	}

	private extractCoverUrl(edition: OpenLibraryEdition, isbn?: string): string | undefined {
		if (edition.covers && edition.covers.length > 0 && edition.covers[0] !== undefined) {
			return this.getBookCover(edition.covers[0], 'M');
		}
		return isbn ? this.getBookCover(isbn, 'M') : undefined;
	}

	private convertSearchDocToBook(doc: OpenLibrarySearchDoc): BookSearchResult {
		const authors = doc.author_name || [];
		const coverUrl = doc.cover_i ? this.getBookCover(doc.cover_i, 'M') : undefined;
		const publishYear = doc.first_publish_year || doc.publish_year?.[0];
		const publishDate = publishYear ? publishYear.toString() : doc.publish_date?.[0];
		const totalPages = doc.number_of_pages_median ?? doc.number_of_pages;

		const book = createBookFromData({
			title: doc.title,
			subtitle: doc.subtitle,
			author: authors,
			publisher: doc.publisher?.[0],
			publishDate,
			totalPages,
			coverUrl,
			category: doc.subject?.slice(0, 5),
		});

		return { ...book, editionKey: doc.cover_edition_key };
	}

	private convertSearchDocsToBooks(docs: OpenLibrarySearchDoc[]): BookSearchResult[] {
		return docs.map(doc => this.convertSearchDocToBook(doc));
	}

}
