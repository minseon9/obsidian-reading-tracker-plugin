import { normalizePath } from 'obsidian';

export class PathManager {
	static getBooksFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/Books`);
	}

	/** One note per sitting lives here. */
	static getSessionsFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/Sessions`);
	}

	static getViewsFolderPath(baseFolder: string): string {
		return normalizePath(`${baseFolder}/Views`);
	}
}
