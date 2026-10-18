import { Book } from '../../models/book';
import { toBookStatus } from '../../models/bookStatus';
import { toReadingUnit } from '../../models/readingUnit';
import { Frontmatter } from './types';

/** How each field of a book maps onto a note property. */
const PROPERTY_OF: Record<string, keyof Frontmatter> = {
	title: 'title',
	subtitle: 'subtitle',
	author: 'author',
	category: 'category',
	publisher: 'publisher',
	publishDate: 'publish',
	totalPages: 'total',
	isbn: 'isbn',
	coverUrl: 'cover',
	series: 'series',
	seriesPosition: 'series_position',
	status: 'status',
	readingUnit: 'reading_unit',
	readPage: 'read_page',
	rating: 'rating',
	readStarted: 'read_started',
	readFinished: 'read_finished',
};

export class FrontmatterConverter {
	/**
	 * Apply the given book fields to a note's properties, in place.
	 *
	 * Only fields that are actually present are written, so updating a status
	 * does not rewrite the title, and properties this plugin knows nothing
	 * about are never touched.
	 */
	static applyToFrontmatter(frontmatter: Frontmatter, book: Partial<Book>): void {
		for (const [field, property] of Object.entries(PROPERTY_OF)) {
			const value = book[field as keyof Book];
			if (value !== undefined) {
				frontmatter[property] = value;
			}
		}
	}

	/** The properties a freshly imported book note starts with. */
	static newBookFrontmatter(book: Book): Frontmatter {
		const frontmatter: Frontmatter = {};
		FrontmatterConverter.applyToFrontmatter(frontmatter, {
			...book,
			readPage: book.readPage ?? 0,
			readingUnit: toReadingUnit(book.readingUnit),
			status: book.status || 'unread',
		});
		return frontmatter;
	}

	static frontmatterToBook(frontmatter: Frontmatter): Partial<Book> {
		return {
			title: FrontmatterConverter.toOptionalString(frontmatter.title) ?? '',
			subtitle: FrontmatterConverter.toOptionalString(frontmatter.subtitle),
			author: FrontmatterConverter.toStringList(frontmatter.author),
			category: FrontmatterConverter.toStringList(frontmatter.category),
			publisher: FrontmatterConverter.toOptionalString(frontmatter.publisher),
			publishDate: FrontmatterConverter.toOptionalString(frontmatter.publish),
			totalPages: FrontmatterConverter.toOptionalNumber(frontmatter.total),
			isbn: FrontmatterConverter.toOptionalString(frontmatter.isbn),
			coverUrl: FrontmatterConverter.toOptionalString(frontmatter.cover),
			series: FrontmatterConverter.toOptionalString(frontmatter.series),
			seriesPosition: FrontmatterConverter.toOptionalNumber(frontmatter.series_position),
			status: toBookStatus(frontmatter.status),
			readingUnit: toReadingUnit(frontmatter.reading_unit),
			readPage: FrontmatterConverter.toOptionalNumber(frontmatter.read_page) ?? 0,
			rating: FrontmatterConverter.toOptionalNumber(frontmatter.rating),
			readStarted: FrontmatterConverter.toOptionalString(frontmatter.read_started),
			readFinished: FrontmatterConverter.toOptionalString(frontmatter.read_finished),
		};
	}

	private static toOptionalString(value: unknown): string | undefined {
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed !== '' ? trimmed : undefined;
		}
		if (typeof value === 'number' && !Number.isNaN(value)) {
			return String(value);
		}
		return undefined;
	}

	private static toOptionalNumber(value: unknown): number | undefined {
		return typeof value === 'number' && !Number.isNaN(value) ? value : undefined;
	}

	/**
	 * Obsidian keeps a single value where a reader wrote one, so `author: Han Kang`
	 * arrives as a string rather than a list. Both forms are accepted.
	 */
	private static toStringList(value: unknown): string[] {
		if (Array.isArray(value)) {
			return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
		}
		return typeof value === 'string' && value.trim() !== '' ? [value.trim()] : [];
	}
}
