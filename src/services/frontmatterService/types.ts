/**
 * A book note's properties.
 *
 * These are exactly the properties a reader would write by hand — there is no
 * plugin-private bookkeeping among them. Reading sessions live in the note
 * body, where they can be read and edited like any other note content.
 */
export interface Frontmatter {
	title?: string;
	subtitle?: string;
	author?: string[] | string;
	category?: string[] | string;
	publisher?: string;
	publish?: string;
	isbn?: string;
	cover?: string;
	series?: string;
	series_position?: number;
	total?: number;
	status?: string;
	reading_unit?: string;
	rating?: number;
	read_page?: number;
	read_started?: string;
	read_finished?: string | null;
	[key: string]: unknown;
}
