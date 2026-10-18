import type { ReadingTrackerSettings } from "../../../settings/types";
import { PathManager } from "../../pathService/pathManager";

export class ShelfBaseFileGenerator {
	static generate(settings: ReadingTrackerSettings): string {
		const booksFolder = PathManager.getBooksFolderPath(settings.bookFolder);
		
		return `filters:
  and:
    - file.path.startsWith("${booksFolder}/")
    - file.path.endsWith(".md")
    - note.status == "reading" || note.status == "unread"

order:
  - note.status
  - note.read_page
  - file.ctime

columns:
  - id: file.name
    display-name: Title
    type: text
  - id: note.author
    display-name: Author
    type: list
  - id: note.status
    display-name: Status
    type: text
  - id: note.read_page
    display-name: Progress
    type: number
  - id: note.total
    display-name: Total Pages
    type: number

views:
  - type: reading-tracker-shelf
    name: Shelf
`;
	}
}
