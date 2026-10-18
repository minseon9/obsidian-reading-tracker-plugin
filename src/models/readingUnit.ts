/**
 * How a book's progress is measured.
 *
 * - `pages`: plain page numbers (the default).
 * - `percent`: 0-100, for ebooks that only report a percentage.
 * - `time`: minutes, entered and displayed as `H:MM`, for audiobooks.
 *
 * Positions are always stored as plain numbers in frontmatter so that Bases
 * views can sort and aggregate them; the unit only controls input and display.
 */
export type ReadingUnit = 'pages' | 'percent' | 'time';

export const READING_UNITS: readonly ReadingUnit[] = ['pages', 'percent', 'time'] as const;

const READING_UNIT_LABELS: Record<ReadingUnit, string> = {
	pages: 'Pages',
	percent: 'Percent',
	time: 'Time (audiobook)',
};

export function isReadingUnit(value: unknown): value is ReadingUnit {
	return typeof value === 'string' && (READING_UNITS as readonly string[]).includes(value);
}

export function toReadingUnit(value: unknown, fallback: ReadingUnit = 'pages'): ReadingUnit {
	return isReadingUnit(value) ? value : fallback;
}

export function readingUnitLabel(unit: ReadingUnit): string {
	return READING_UNIT_LABELS[unit];
}

/** The default `total` for a unit, used when the book has no explicit total. */
export function defaultTotalFor(unit: ReadingUnit): number | undefined {
	return unit === 'percent' ? 100 : undefined;
}

/** Resolve the effective total for a book, falling back to the unit's natural total (e.g. 100 for percent). */
export function effectiveTotal(totalPages: number | undefined, unit: ReadingUnit): number | undefined {
	if (totalPages !== undefined && totalPages > 0) {
		return totalPages;
	}
	return defaultTotalFor(unit);
}

/** Calculate completion percentage (0-100), or null when total is unknown. */
export function calculateProgressPercent(
	current: number,
	totalPages: number | undefined,
	unit: ReadingUnit
): number | null {
	const total = effectiveTotal(totalPages, unit);
	if (!total || total <= 0) {
		return null;
	}
	return Math.min(100, Math.max(0, (current / total) * 100));
}

/**
 * Parse a user-entered position into the stored number.
 * Accepts `H:MM` and `HhMM` for time and a trailing `%` for percent.
 * Returns null when the input cannot be understood.
 */
export function parsePosition(raw: string, unit: ReadingUnit): number | null {
	const value = raw.trim();
	if (value === '') return null;

	if (unit === 'time') {
		const clock = value.match(/^(\d+)\s*[:h]\s*(\d{1,2})$/i);
		if (clock && clock[1] && clock[2]) {
			const minutes = parseInt(clock[2], 10);
			if (minutes > 59) return null;
			return parseInt(clock[1], 10) * 60 + minutes;
		}
		const plain = value.match(/^(\d+)\s*(?:m|min|mins|minutes)?$/i);
		return plain && plain[1] ? parseInt(plain[1], 10) : null;
	}

	if (unit === 'percent') {
		const percent = value.match(/^(\d+(?:\.\d+)?)\s*%?$/);
		if (!percent || !percent[1]) return null;
		return Math.round(parseFloat(percent[1]));
	}

	return /^\d+$/.test(value) ? parseInt(value, 10) : null;
}

/** Format a stored position for display. */
export function formatPosition(value: number, unit: ReadingUnit): string {
	if (unit === 'time') {
		const hours = Math.floor(value / 60);
		const minutes = value % 60;
		return `${hours}:${minutes.toString().padStart(2, '0')}`;
	}
	if (unit === 'percent') return `${value}%`;
	return value.toString();
}

/** Format an amount covered in one session, e.g. "150 pages" or "0:45". */
export function formatAmount(value: number, unit: ReadingUnit): string {
	if (unit === 'time') return formatPosition(value, unit);
	if (unit === 'percent') return `${value}%`;
	return `${value} ${value === 1 ? 'page' : 'pages'}`;
}

/** Placeholder text for a position input. */
export function positionPlaceholder(unit: ReadingUnit): string {
	if (unit === 'time') return '1:30';
	if (unit === 'percent') return '45';
	return '150';
}
