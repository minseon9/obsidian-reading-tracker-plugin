import type { ReadingTrackerSettings } from "../../../settings/types";
import { PathManager } from "../../pathService/pathManager";

export class LibraryBaseFileGenerator {
	static generate(settings: ReadingTrackerSettings): string {
		const booksFolder = PathManager.getBooksFolderPath(settings.bookFolder);
		
		return `filters:
  and:
    - file.path.startsWith("${booksFolder}/")
    - file.path.endsWith(".md")
    - note.status == "unread" || note.status == "finished" || note.status == "abandoned"

order:
  - note.status
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
  - id: note.total
    display-name: Total Pages
    type: number
  - id: file.ctime
    display-name: Added
    type: date
  - id: note.read_finished
    display-name: Finished
    type: date
  - id: note.rating
    display-name: Rating
    type: number
  - id: note.series
    display-name: Series
    type: text

views:
  - type: reading-tracker-library
    name: Library
`;
	}
}
