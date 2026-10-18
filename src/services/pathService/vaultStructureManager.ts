import { App, normalizePath } from 'obsidian';
import { ReadingTrackerSettings } from '../../settings/types';
import { FolderManager } from './folderManager';
import { PathManager } from './pathManager';
import { ShelfBaseFileGenerator } from '../obsidian/baseFileGenerators/shelfBaseFileGenerator';
import { LibraryBaseFileGenerator } from '../obsidian/baseFileGenerators/libraryBaseFileGenerator';
import { SessionsBaseFileGenerator } from '../obsidian/baseFileGenerators/sessionsBaseFileGenerator';
import { StatisticsBaseFileGenerator } from '../obsidian/baseFileGenerators/statisticsBaseFileGenerator';

interface BaseFileSpec {
	name: string;
	generator: { generate(settings: ReadingTrackerSettings): string };
}

const DEFAULT_BASE_FILES: readonly BaseFileSpec[] = [
	{ name: 'shelf.base', generator: ShelfBaseFileGenerator },
	{ name: 'library.base', generator: LibraryBaseFileGenerator },
	{ name: 'sessions.base', generator: SessionsBaseFileGenerator },
	{ name: 'statistics.base', generator: StatisticsBaseFileGenerator },
];

/**
 * Ensures the plugin's folder structure and default `.base` view files exist.
 */
export class VaultStructureManager {
	private app: App;
	private folderManager: FolderManager;

	constructor(app: App) {
		this.app = app;
		this.folderManager = new FolderManager(app);
	}

	/**
	 * Make sure the folders and default views exist.
	 *
	 * Each folder is handled on its own, so one that cannot be created does not
	 * stop the others — or the views — from being set up.
	 */
	async ensureVaultStructure(settings: ReadingTrackerSettings): Promise<void> {
		const folders = [
			settings.bookFolder,
			PathManager.getBooksFolderPath(settings.bookFolder),
			PathManager.getSessionsFolderPath(settings.bookFolder),
			PathManager.getViewsFolderPath(settings.bookFolder),
		];

		for (const folder of folders) {
			try {
				await this.folderManager.ensureFolder(folder);
			} catch (error) {
				console.error(`[Reading Tracker] Could not create ${folder}:`, error);
			}
		}

		await this.ensureDefaultBaseFiles(settings, false);
	}

	/**
	 * Create the default `.base` view files.
	 *
	 * Existing files are left alone unless `overwrite` is set, so a view the
	 * reader has customised is never silently replaced.
	 *
	 * Returns how many files were written.
	 */
	async ensureDefaultBaseFiles(
		settings: ReadingTrackerSettings,
		overwrite = false
	): Promise<number> {
		const viewsFolder = PathManager.getViewsFolderPath(settings.bookFolder);
		await this.folderManager.ensureFolder(viewsFolder);

		let written = 0;
		for (const { name, generator } of DEFAULT_BASE_FILES) {
			const filePath = normalizePath(`${viewsFolder}/${name}`);
			const existing = this.app.vault.getFileByPath(filePath);
			const content = generator.generate(settings);

			try {
				if (!existing) {
					await this.app.vault.create(filePath, content);
					written++;
				} else if (overwrite) {
					await this.app.vault.process(existing, () => content);
					written++;
				}
			} catch (error) {
				// The file can be on disk while the index has yet to see it.
				if (!FolderManager.isAlreadyExists(error)) {
					console.error(`[Reading Tracker] Failed to write ${filePath}:`, error);
				}
			}
		}
		return written;
	}
}
