/**
 * Date helpers.
 *
 * Everything is in the reader's local time — a session logged at 2am belongs to
 * that night, which is what the vault's daily notes assume too.
 */

const PAD = (value: number): string => String(value).padStart(2, '0');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Format a date as `YYYY-MM-DD HH:mm:ss` in local time. */
export function formatDateTime(date: Date = new Date()): string {
	return `${formatDate(date)} ${PAD(date.getHours())}:${PAD(date.getMinutes())}:${PAD(date.getSeconds())}`;
}

/** Format a date as `YYYY-MM-DD` in local time. */
export function formatDate(date: Date = new Date()): string {
	return `${date.getFullYear()}-${PAD(date.getMonth() + 1)}-${PAD(date.getDate())}`;
}

/** The `YYYY-MM-DD` part of a stored timestamp. */
export function dayOf(timestamp: string | undefined): string | undefined {
	return timestamp?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
}

/** Format minutes as `12h 30m` or `45m`, or `-` when zero/negative. */
export function formatDurationMinutes(minutes: number): string {
	if (minutes <= 0) {
		return '-';
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

/** Format a `YYYY-MM` key as `Oct 2026`. */
export function formatMonthLabel(monthKey: string): string {
	const [year = '', monthNum = '1'] = monthKey.split('-');
	const monthIndex = parseInt(monthNum, 10) - 1;
	const monthName = MONTH_NAMES[monthIndex] ?? 'Jan';
	return `${monthName} ${year}`;
}
