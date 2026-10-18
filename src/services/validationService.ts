import { Book } from '../models/book';
import { isBookStatus } from '../models/bookStatus';
import { isReadingUnit } from '../models/readingUnit';

const MIN_RATING = 0;
const MAX_RATING = 5;

export class ValidationUtils {
	static validateAndFixBook(book: Partial<Book>): Partial<Book> {
		const fixed: Partial<Book> = { ...book };

		if (fixed.status && !isBookStatus(fixed.status)) {
			fixed.status = 'unread';
		}

		if (fixed.readingUnit && !isReadingUnit(fixed.readingUnit)) {
			fixed.readingUnit = 'pages';
		}

		if (fixed.totalPages !== undefined && fixed.totalPages <= 0) {
			fixed.totalPages = undefined;
		}

		if (fixed.readPage !== undefined) {
			fixed.readPage = ValidationUtils.clampReadPage(fixed.readPage, fixed.totalPages);
		}

		if (fixed.rating !== undefined) {
			fixed.rating = ValidationUtils.normalizeRating(fixed.rating);
		}

		if (!fixed.title || fixed.title.trim().length === 0) {
			fixed.title = 'Unknown title';
		}

		return fixed;
	}

	private static clampReadPage(readPage: number, totalPages?: number): number {
		const nonNegative = Math.max(0, readPage);
		if (totalPages !== undefined && totalPages > 0) {
			return Math.min(nonNegative, totalPages);
		}
		return nonNegative;
	}

	private static normalizeRating(rating: number): number | undefined {
		if (typeof rating !== 'number' || Number.isNaN(rating)) {
			return undefined;
		}
		return Math.min(MAX_RATING, Math.max(MIN_RATING, Math.round(rating)));
	}
}
