import { ReadingUnit, parsePosition } from '../../models/readingUnit';

export const DEFAULT_READING_HISTORY_HEADING = 'Reading History';

/** `- 2026-10-06: 180-244 — [[2026-10-06 소년이 온다]]` */
const ENTRY_LINE = /^[-*+][ \t]+(\d{4}-\d{2}-\d{2})[ \t]*:[ \t]*(.+?)[ \t]*$/;

/** Multi-character separators first, or a bare `-` would split `10 -> 55`. */
const POSITION_RANGE = /^(.*?)\s*(?:->|→|–|—|~|-)\s*(.*)$/;

/** Trailing ` — [[...]]` or ` — [...](...)`: the session note this line indexes. */
const TRAILING_LINK = /[ \t]*(?:—|--|-)?[ \t]*(\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]+\))[ \t]*$/;

/** The block form written by 0.2.x, read so old notes keep working. */
const LEGACY_HEADING = /^###[ \t]+(\d{4}-\d{2}-\d{2})/;

/** One line of the reading index on a book note. */
export interface IndexEntry {
	date: string;
	/** Null when the line gives only an end position. */
	from: number | null;
	to: number;
	/** True when the line points at a session note, which holds the real record. */
	hasLink: boolean;
}

/**
 * The reading index on a book note — a plain Markdown list, one line per
 * sitting, in the form someone keeping a reading log would type by hand:
 *
 * ```
 * ## Reading History
 *
 * - 2026-10-04: 140-216 — [[2026-10-04 소년이 온다]]
 * - 2026-10-06: 216-260
 * ```
 *
 * A line with a link is a pointer to that sitting's session note, which is
 * where the positions, the time, the passage and the writing actually live. A
 * line without one is a sitting the reader logged by hand, and counts just the
 * same.
 *
 * Lines are only ever *appended*. Nothing already in the section is re-parsed
 * or rewritten, so hand edits always survive.
 */
export class ReadingIndex {
	/** Add a line to the end of the index, creating the section if needed. */
	static appendLine(
		body: string,
		line: string,
		heading: string = DEFAULT_READING_HISTORY_HEADING
	): string {
		const section = ReadingIndex.findSection(body, heading);

		if (section === null) {
			const trimmed = body.replace(/\s+$/, '');
			const block = `## ${heading}\n\n${line}\n`;
			return trimmed === '' ? block : `${trimmed}\n\n${block}`;
		}

		const existing = body.slice(section.contentStart, section.contentEnd).replace(/^\n+|\s+$/g, '');
		const tail = body.slice(section.contentEnd);
		const list = existing === '' ? line : `${existing}\n${line}`;

		return `${body.slice(0, section.contentStart)}\n\n${list}\n${tail ? `\n${tail}` : ''}`;
	}

	/**
	 * Read the index, oldest first. An entry giving only an end position starts
	 * where the one before it left off.
	 */
	static parse(
		body: string,
		heading: string = DEFAULT_READING_HISTORY_HEADING,
		unit: ReadingUnit = 'pages'
	): IndexEntry[] {
		const section = ReadingIndex.findSection(body, heading);
		if (section === null) {
			return [];
		}

		const content = body.slice(section.contentStart, section.contentEnd);
		const entries = [
			...ReadingIndex.parseLines(content, unit),
			...ReadingIndex.parseLegacy(content),
		];

		entries.sort((a, b) => a.date.localeCompare(b.date));

		let previousEnd = 0;
		for (const entry of entries) {
			if (entry.from === null) {
				entry.from = Math.min(previousEnd, entry.to);
			}
			previousEnd = Math.max(previousEnd, entry.to);
		}
		return entries;
	}

	private static parseLines(content: string, unit: ReadingUnit): IndexEntry[] {
		const entries: IndexEntry[] = [];

		for (const raw of content.split('\n')) {
			const match = ENTRY_LINE.exec(raw);
			if (!match?.[1] || !match[2]) {
				continue;
			}

			const linkMatch = TRAILING_LINK.exec(match[2]);
			const positions = ReadingIndex.parseRange(
				linkMatch ? match[2].slice(0, linkMatch.index) : match[2],
				unit
			);
			if (!positions) {
				continue;
			}

			entries.push({
				date: match[1],
				from: positions.from,
				to: positions.to,
				hasLink: linkMatch !== null,
			});
		}

		return entries;
	}

	private static parseLegacy(content: string): IndexEntry[] {
		const entries: IndexEntry[] = [];

		for (const chunk of content.split(/^(?=###[ \t]+\d{4}-\d{2}-\d{2})/m)) {
			const header = LEGACY_HEADING.exec(chunk);
			if (!header?.[1]) continue;

			const text = chunk.slice(header[0].length);
			const progress = text.match(/\*\*Progress\*\*:\s*(\d+)\s*→\s*(\d+)/);
			const from = progress?.[1] ?? text.match(/\*\*Start Page:\*\*\s*(\d+)/i)?.[1];
			const to = progress?.[2] ?? text.match(/\*\*End Page:\*\*\s*(\d+)/i)?.[1];
			if (to === undefined) continue;

			entries.push({
				date: header[1],
				from: from === undefined ? null : parseInt(from, 10),
				to: parseInt(to, 10),
				hasLink: false,
			});
		}

		return entries;
	}

	/** `180-244` → both ends; `244` → just the end. Null when neither parses. */
	private static parseRange(
		value: string,
		unit: ReadingUnit
	): { from: number | null; to: number } | null {
		const range = POSITION_RANGE.exec(value.trim());

		if (range?.[1] && range[2]) {
			const from = parsePosition(range[1], unit);
			const to = parsePosition(range[2], unit);
			if (from !== null && to !== null) {
				return { from, to };
			}
		}

		const single = parsePosition(value, unit);
		return single === null ? null : { from: null, to: single };
	}

	/** Locate the index section: where its content begins and where it ends. */
	private static findSection(
		body: string,
		heading: string
	): { contentStart: number; contentEnd: number } | null {
		const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// `[ \t]*` rather than `\s*`, which would swallow the newline after the
		// heading and leave a stray blank line on every insert.
		const match = new RegExp(`^##[ \t]+${escaped}[ \t]*$`, 'm').exec(body);
		if (!match) {
			return null;
		}

		const contentStart = match.index + match[0].length;
		const rest = body.slice(contentStart);
		// `###` sub-entries belong to this section; a `#` or `##` heading ends it.
		const next = rest.search(/^#{1,2}[ \t]+\S/m);

		return {
			contentStart,
			contentEnd: next === -1 ? body.length : contentStart + next,
		};
	}
}
