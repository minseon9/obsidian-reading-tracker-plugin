export type BookStatus = 'unread' | 'reading' | 'finished' | 'abandoned';

/** Every status a book can be in, in shelf order. */
export const BOOK_STATUSES: readonly BookStatus[] = ['unread', 'reading', 'finished', 'abandoned'] as const;

/** Statuses a book can be given when it is first created. */
export const INITIAL_BOOK_STATUSES: readonly BookStatus[] = ['unread', 'reading'] as const;

/** Statuses that mean the book is no longer being read. */
export const CLOSED_BOOK_STATUSES: readonly BookStatus[] = ['finished', 'abandoned'] as const;

const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
	unread: 'Unread',
	reading: 'Reading',
	finished: 'Finished',
	abandoned: 'Abandoned',
};

export function isBookStatus(value: unknown): value is BookStatus {
	return typeof value === 'string' && (BOOK_STATUSES as readonly string[]).includes(value);
}

export function toBookStatus(value: unknown, fallback: BookStatus = 'unread'): BookStatus {
	return isBookStatus(value) ? value : fallback;
}

export function bookStatusLabel(status: BookStatus): string {
	return BOOK_STATUS_LABELS[status];
}

/** A book is "closed" once it is finished or abandoned — it leaves the active shelf. */
export function isClosedStatus(status: BookStatus): boolean {
	return (CLOSED_BOOK_STATUSES as readonly string[]).includes(status);
}
