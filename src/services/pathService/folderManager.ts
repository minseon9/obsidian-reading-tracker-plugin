import { App, normalizePath } from 'obsidian';

export class FolderManager {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Create a folder unless it is already there.
	 *
	 * Idempotent on purpose: the vault index can lag behind what is on disk —
	 * right after startup, or while Sync is catching up — so `createFolder` can
	 * fail with "already exists" even though the lookup just said there was
	 * nothing. That is not an error; there is simply nothing to do.
	 */
	async ensureFolder(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);

		if (this.app.vault.getFolderByPath(normalizedPath)) {
			return;
		}
		if (this.app.vault.getFileByPath(normalizedPath)) {
			throw new Error(`Path exists but is not a folder: ${normalizedPath}`);
		}

		try {
			await this.app.vault.createFolder(normalizedPath);
		} catch (error) {
			if (!FolderManager.isAlreadyExists(error) && !this.app.vault.getFolderByPath(normalizedPath)) {
				throw error;
			}
		}
	}

	/** Obsidian reports a collision by message, so that is what there is to go on. */
	static isAlreadyExists(error: unknown): boolean {
		return error instanceof Error && /already exists/i.test(error.message);
	}
}
