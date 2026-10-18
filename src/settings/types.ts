import { DEFAULT_READING_HISTORY_HEADING } from '../services/bookFileService/readingIndex';

/**
 * Everything the plugin lets a reader configure.
 *
 * Deliberately small. Anything that only has one sensible answer — when a book
 * counts as finished, whether a sitting is worth recording, what timezone the
 * reader is in — is simply done, not asked about.
 */
export interface ReadingTrackerSettings {
	/** Where book notes, session notes and the generated views live. */
	bookFolder: string;
	/** Heading on a book note that its reading index is kept under. */
	readingHistoryHeading: string;
}

export const DEFAULT_SETTINGS: ReadingTrackerSettings = {
	bookFolder: 'Reading Tracker',
	readingHistoryHeading: DEFAULT_READING_HISTORY_HEADING,
};
