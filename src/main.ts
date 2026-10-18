import { Plugin, MarkdownView, TFile, TAbstractFile, normalizePath } from 'obsidian';
import { DEFAULT_SETTINGS, ReadingTrackerSettings } from "./settings/types";
import { ReadingTrackerSettingTab } from "./settings/settingTab";
import { registerCommands } from "./commands";
import { PathManager } from "./services/pathService/pathManager";
import { VaultStructureManager } from "./services/pathService/vaultStructureManager";
import { NoteAccess } from "./services/frontmatterService/noteAccess";
import { SearchModal } from "./views/bookSearchModal";
import { RecordSessionModal } from "./views/recordSessionModal";
import { registerBasesViews, unregisterBasesViews } from "./services/obsidian/bases/basesViewRegistrar";

const PROGRESS_ACTION_CLASS = 'reading-tracker-progress-action';

export default class ReadingTrackerPlugin extends Plugin {
	settings: ReadingTrackerSettings;
	private vaultStructureManager: VaultStructureManager;

	async onload() {
		await this.loadSettings();
		this.vaultStructureManager = new VaultStructureManager(this.app);

		// The vault index is not populated during onload, so anything that looks
		// at or creates files waits for the workspace to be ready. Doing it here
		// would make every reload after the first fail on folders that already
		// exist but have not been indexed yet.
		this.app.workspace.onLayoutReady(() => {
			void this.vaultStructureManager.ensureVaultStructure(this.settings);
			this.syncProgressAction();
		});

		this.addSettingTab(new ReadingTrackerSettingTab(this.app, this));
		registerCommands(this.app, this);
		await registerBasesViews(this);

		this.addRibbonIcon('book-open-text', 'Open shelf', () => {
			void this.openShelf();
		});

		this.addRibbonIcon('book-plus', 'Search and add book', () => {
			new SearchModal(this.app, this).open();
		});

		// Put the "record a session" action on book notes as they are opened.
		this.registerEvent(
			this.app.workspace.on('file-open', () => this.syncProgressAction())
		);
	}

	onunload(): void {
		void unregisterBasesViews(this);
	}

	/**
	 * Is this file one of the plugin's book notes?
	 *
	 * Being in the book folder is not enough — a note there also has to carry
	 * book properties, so an index or a scratch note in the same folder doesn't
	 * get a progress button. The check reads the metadata cache, not the file.
	 */
	isBookNote(file: TAbstractFile | null): file is TFile {
		if (!(file instanceof TFile) || file.extension !== 'md') {
			return false;
		}

		const booksFolder = PathManager.getBooksFolderPath(this.settings.bookFolder);
		if (!file.path.startsWith(`${booksFolder}/`)) {
			return false;
		}

		const frontmatter = NoteAccess.frontmatter(this.app, file);
		return !!frontmatter && (!!frontmatter.title || !!frontmatter.status);
	}

	/**
	 * Put a "Record reading" action in the header of the active note when it is
	 * a book note, and take it away again when it is not.
	 */
	private syncProgressAction(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const existing = view.containerEl.querySelector(`.${PROGRESS_ACTION_CLASS}`);
		if (!this.isBookNote(view.file)) {
			existing?.remove();
			return;
		}
		if (existing) return;

		const action = view.addAction('book-open-check', 'Record reading', () => {
			const file = this.app.workspace.getActiveFile();
			if (file) {
				new RecordSessionModal(this.app, this, file).open();
			}
		});
		action.addClass(PROGRESS_ACTION_CLASS);
	}

	async openShelf(): Promise<void> {
		const { workspace } = this.app;
		const viewsFolder = PathManager.getViewsFolderPath(this.settings.bookFolder);
		const shelfPath = normalizePath(`${viewsFolder}/shelf.base`);
		let baseFile = this.app.vault.getFileByPath(shelfPath);
		if (!baseFile) {
			await this.vaultStructureManager.ensureVaultStructure(this.settings);
			baseFile = this.app.vault.getFileByPath(shelfPath);
		}
		if (!baseFile) {
			return;
		}

		const leaf = workspace.getRightLeaf(false) || workspace.getLeaf(true);
		await leaf.openFile(baseFile);
		await workspace.revealLeaf(leaf);
	}

	async ensureDefaultBaseFiles(overwrite = false): Promise<number> {
		return this.vaultStructureManager.ensureDefaultBaseFiles(this.settings, overwrite);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ReadingTrackerSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
