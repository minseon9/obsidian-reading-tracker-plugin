import type { ReadingTrackerSettings } from "../../../settings/types";
import { PathManager } from "../../pathService/pathManager";

/**
 * Every sitting, newest first — the reading log across all books.
 *
 * Session notes keep their facts in properties, so this needs no custom view:
 * Obsidian's own table renders it.
 */
export class SessionsBaseFileGenerator {
	static generate(settings: ReadingTrackerSettings): string {
		const sessionsFolder = PathManager.getSessionsFolderPath(settings.bookFolder);

		return `filters:
  and:
    - file.path.startsWith("${sessionsFolder}/")
    - file.path.endsWith(".md")

order:
  - note.date

columns:
  - id: note.date
    display-name: Date
    type: date
  - id: note.book
    display-name: Book
    type: text
  - id: note.from
    display-name: From
    type: number
  - id: note.to
    display-name: To
    type: number
  - id: note.amount
    display-name: Read
    type: number
  - id: note.minutes
    display-name: Minutes
    type: number
  - id: note.quotes
    display-name: Quotes
    type: number

views:
  - type: table
    name: Sessions
`;
	}
}
