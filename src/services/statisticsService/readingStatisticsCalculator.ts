import { BookWithReadingHistory } from '../../models/bookWithReadingHistory';
import { toReadingUnit } from '../../models/readingUnit';
import { dayOf, formatDate } from '../../utils/dateUtils';

export interface PeriodStatisticEntry {
	count: number;
	pages: number;
	readingDays: number;
	averageTimeToFinish: number;
}

export type PeriodStatistics = Record<string, PeriodStatisticEntry>;

export interface BookStatistics {
	totalBooks: number;
	reading: number;
	unread: number;
	finished: number;
	abandoned: number;
	totalPages: number;
	/** Mean rating across rated books, or 0 when nothing is rated. */
	averageRating: number;
	readPages: number;
	totalReadingDays: number;
	totalSessions: number;
	totalQuotes: number;
	currentStreak: number;
	longestStreak: number;
	/** Activity count per YYYY-MM-DD for calendar heatmap visualization. */
	dailyActivity: Record<string, number>;
	/** Minutes across every sitting that said how long it was. */
	totalMinutes: number;
	averageTimeToFinish: number;
	categoryCounts: Record<string, number>;
	yearlyStats: PeriodStatistics;
	monthlyStats: PeriodStatistics;
}

/**
 * Computes reading statistics from a collection of books with their reading history.
 *
 * Extracted as a pure domain service (Split Phase / Extract Class) so aggregation
 * is independent of view rendering and free of timezone-sensitive Date parsing.
 */
export class ReadingStatisticsCalculator {
	static calculate(books: readonly BookWithReadingHistory[]): BookStatistics {
		const stats: BookStatistics = {
			totalBooks: books.length,
			reading: 0,
			unread: 0,
			finished: 0,
			abandoned: 0,
			totalPages: 0,
			averageRating: 0,
			readPages: 0,
			totalReadingDays: 0,
			totalSessions: 0,
			totalQuotes: 0,
			currentStreak: 0,
			longestStreak: 0,
			dailyActivity: {},
			totalMinutes: 0,
			averageTimeToFinish: 0,
			categoryCounts: {},
			yearlyStats: {},
			monthlyStats: {},
		};

		const allReadingDays = new Set<string>();
		const ratings: number[] = [];
		let sessionDaysOfFinishedBooks = 0;
		let finishedBooksWithSessions = 0;

		for (const book of books) {
			ReadingStatisticsCalculator.incrementStatusCount(stats, book);
			ReadingStatisticsCalculator.accumulateBookTotals(stats, ratings, book);

			const bookReadingDays = ReadingStatisticsCalculator.collectBookReadingDays(book);
			for (const day of bookReadingDays) {
				allReadingDays.add(day);
				stats.dailyActivity[day] = (stats.dailyActivity[day] ?? 0) + 1;
			}

			if (book.status !== 'finished') {
				continue;
			}

			ReadingStatisticsCalculator.accumulateCategories(stats.categoryCounts, book.category);

			if (bookReadingDays.size > 0) {
				sessionDaysOfFinishedBooks += bookReadingDays.size;
				finishedBooksWithSessions++;
			}

			ReadingStatisticsCalculator.accumulateFinishedPeriod(
				stats,
				book,
				bookReadingDays.size
			);
		}

		const sortedDays = [...allReadingDays].sort();
		const streaks = ReadingStatisticsCalculator.computeStreaks(sortedDays);

		stats.totalReadingDays = sortedDays.length;
		stats.currentStreak = streaks.current;
		stats.longestStreak = streaks.longest;
		stats.averageRating = ReadingStatisticsCalculator.computeMeanRating(ratings);
		stats.averageTimeToFinish = finishedBooksWithSessions > 0
			? Math.round(sessionDaysOfFinishedBooks / finishedBooksWithSessions)
			: 0;

		ReadingStatisticsCalculator.finalizePeriodAverages(stats.yearlyStats);
		ReadingStatisticsCalculator.finalizePeriodAverages(stats.monthlyStats);

		return stats;
	}

	private static incrementStatusCount(stats: BookStatistics, book: BookWithReadingHistory): void {
		switch (book.status) {
			case 'reading':
				stats.reading++;
				break;
			case 'unread':
				stats.unread++;
				break;
			case 'abandoned':
				stats.abandoned++;
				break;
			case 'finished':
				stats.finished++;
				break;
		}
	}

	private static accumulateBookTotals(
		stats: BookStatistics,
		ratings: number[],
		book: BookWithReadingHistory
	): void {
		if (book.rating !== undefined && book.rating > 0) {
			ratings.push(book.rating);
		}

		const unit = toReadingUnit(book.readingUnit);
		if (unit === 'pages') {
			if (book.totalPages) stats.totalPages += book.totalPages;
			if (book.readPage) stats.readPages += book.readPage;
		}

		stats.totalMinutes += book.minutesRead;
		stats.totalSessions += book.sessionCount;
		stats.totalQuotes += book.quoteCount;
	}

	private static collectBookReadingDays(book: BookWithReadingHistory): Set<string> {
		const days = new Set<string>(book.readingDays);
		const startedOn = dayOf(book.readStarted);
		if (startedOn) {
			days.add(startedOn);
		}
		return days;
	}

	private static accumulateCategories(
		categoryCounts: Record<string, number>,
		categories?: string[]
	): void {
		if (!categories || categories.length === 0) {
			return;
		}
		for (const category of categories) {
			categoryCounts[category] = (categoryCounts[category] || 0) + 1;
		}
	}

	private static accumulateFinishedPeriod(
		stats: BookStatistics,
		book: BookWithReadingHistory,
		readingDayCount: number
	): void {
		const finishedDay = dayOf(book.readFinished);
		if (!finishedDay) {
			return;
		}

		const year = finishedDay.slice(0, 4);
		const month = finishedDay.slice(0, 7);
		const pageCount = toReadingUnit(book.readingUnit) === 'pages' ? (book.totalPages ?? 0) : 0;

		for (const bucket of [
			ReadingStatisticsCalculator.getOrCreateBucket(stats.yearlyStats, year),
			ReadingStatisticsCalculator.getOrCreateBucket(stats.monthlyStats, month),
		]) {
			bucket.count++;
			bucket.pages += pageCount;
			bucket.readingDays += readingDayCount;
			bucket.averageTimeToFinish += readingDayCount;
		}
	}

	private static getOrCreateBucket(
		periods: PeriodStatistics,
		key: string
	): PeriodStatisticEntry {
		return (periods[key] ??= {
			count: 0,
			pages: 0,
			readingDays: 0,
			averageTimeToFinish: 0,
		});
	}

	private static computeMeanRating(ratings: readonly number[]): number {
		if (ratings.length === 0) {
			return 0;
		}
		const sum = ratings.reduce((acc, value) => acc + value, 0);
		return Math.round((sum / ratings.length) * 10) / 10;
	}

	private static finalizePeriodAverages(periods: PeriodStatistics): void {
		for (const entry of Object.values(periods)) {
			if (entry.count > 0) {
				entry.averageTimeToFinish = Math.round(entry.averageTimeToFinish / entry.count);
			}
		}
	}

	/**
	 * Compute longest consecutive day streak and active streak (anchored to today or yesterday).
	 */
	private static computeStreaks(sortedDays: readonly string[]): { current: number; longest: number } {
		if (sortedDays.length === 0) {
			return { current: 0, longest: 0 };
		}

		let longest = 1;
		let running = 1;

		for (let i = 1; i < sortedDays.length; i++) {
			const prev = sortedDays[i - 1];
			const curr = sortedDays[i];
			if (prev && curr && ReadingStatisticsCalculator.daysBetween(prev, curr) === 1) {
				running++;
				if (running > longest) {
					longest = running;
				}
			} else {
				running = 1;
			}
		}

		const lastDay = sortedDays[sortedDays.length - 1];
		const today = formatDate();
		const gapFromToday = lastDay ? ReadingStatisticsCalculator.daysBetween(lastDay, today) : Infinity;
		const current = gapFromToday <= 1 ? running : 0;

		return { current, longest };
	}

	private static daysBetween(dayA: string, dayB: string): number {
		const [y1 = 0, m1 = 1, d1 = 1] = dayA.split('-').map(Number);
		const [y2 = 0, m2 = 1, d2 = 1] = dayB.split('-').map(Number);
		const utcA = Date.UTC(y1, m1 - 1, d1);
		const utcB = Date.UTC(y2, m2 - 1, d2);
		return Math.round((utcB - utcA) / 86_400_000);
	}
}
