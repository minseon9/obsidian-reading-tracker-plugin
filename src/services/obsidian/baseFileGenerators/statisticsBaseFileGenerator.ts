import type { ReadingTrackerSettings } from "../../../settings/types";
import { PathManager } from "../../pathService/pathManager";

export class StatisticsBaseFileGenerator {
	static generate(settings: ReadingTrackerSettings): string {
		const booksFolder = PathManager.getBooksFolderPath(settings.bookFolder);
		
		return `filters:
  and:
    - file.path.startsWith("${booksFolder}/")
    - file.path.endsWith(".md")

views:
  - type: reading-tracker-statistics
    name: Statistics
`;
	}
}
