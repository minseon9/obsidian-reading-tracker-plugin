import { Component, App, TFile, setIcon } from "obsidian";
import ReadingTrackerPlugin from "../../main";
import { BasesDataItem, BasesEntryData } from "./basesDataItem";
import { BookWithReadingHistory } from "../../models/bookWithReadingHistory";
import { BookFileReader } from "../../services/bookFileService/bookFileReader";
import { BookFileUpdater } from "../../services/bookFileService/bookFileUpdater";
import { SearchModal } from "../bookSearchModal";

/**
 * Minimal interface for Bases view configuration
 */
interface BasesViewConfig {
	getSort?: () => unknown;
	getOrder?: () => string[];
	getDisplayName?: (propertyId: string) => string;
}

/**
 * Minimal interface for Bases query result
 */
interface BasesQueryResult {
	data?: unknown;
	groupedData?: unknown[];
}

/**
 * Abstract base class for all Reading Tracker Bases views.
 * Properly extends Component to leverage lifecycle, and implements BasesView interface.
 */
export abstract class BasesViewBase extends Component {
	// BasesView properties (provided by Bases when factory returns this instance)
	app!: App;
	config!: BasesViewConfig;
	data!: BasesQueryResult;
	protected plugin: ReadingTrackerPlugin;
	protected containerEl: HTMLElement;
	protected rootElement: HTMLElement | null = null;
	protected bookFileReader: BookFileReader;
	protected bookFileUpdater: BookFileUpdater;
	protected dataUpdateDebounceTimer: number | null = null;

	constructor(controller: unknown, containerEl: HTMLElement, plugin: ReadingTrackerPlugin) {
		super();
		this.plugin = plugin;
		this.containerEl = containerEl;
		// Use plugin.app since this.app may not be set yet (Bases sets it later)
		this.bookFileReader = new BookFileReader(plugin.app);
		this.bookFileUpdater = new BookFileUpdater(plugin.app, plugin.settings);
	}

	protected get appInstance(): App {
		return this.app || this.plugin.app;
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		this.setupContainer();

		// Wait a bit for Bases to populate data
		window.requestAnimationFrame(() => {
			window.setTimeout(() => {
				if (this.rootElement?.isConnected) {
					void this.render();
				}
			}, 100);
		});
	}

	/**
	 * BasesView lifecycle: Called when Bases data changes.
	 * Required abstract method implementation.
	 * Debounced to prevent excessive re-renders during rapid file saves.
	 */
	onDataUpdated(): void {
		if (!this.rootElement?.isConnected) {
			return;
		}

		if (this.dataUpdateDebounceTimer) {
			window.clearTimeout(this.dataUpdateDebounceTimer);
		}

		const win = this.containerEl.ownerDocument.defaultView || window;
		this.dataUpdateDebounceTimer = win.setTimeout(() => {
			this.dataUpdateDebounceTimer = null;
			try {
				void this.render();
			} catch (error) {
				console.error(`[Reading Tracker][${this.type}] Render error:`, error);
				this.renderError(error as Error);
			}
		}, 500);
	}

	/**
	 * Component lifecycle: Called when view is unloaded.
	 */
	onunload(): void {
		if (this.dataUpdateDebounceTimer) {
			window.clearTimeout(this.dataUpdateDebounceTimer);
		}
		super.onunload();
	}

	/**
	 * Setup the container element
	 */
	protected setupContainer(): void {
		// Don't clear containerEl - Bases manages it
		const rootEl = this.containerEl.createDiv({
			cls: "reading-tracker-bases-view",
		});
		rootEl.tabIndex = -1;
		this.rootElement = rootEl;

		this.setupNewBookButton();
	}

	/**
	 * Setup custom "New Book" button that opens the book search modal.
	 * Injects the button into the Bases toolbar and hides the default "New" button.
	 */
	protected setupNewBookButton(): void {
		let attempts = 0;
		const maxAttempts = 10;

		const tryInject = () => {
			attempts++;
			this.injectNewBookButton();

			const basesViewEl = this.containerEl.closest(".bases-view");
			const toolbarEl = basesViewEl?.parentElement?.querySelector(".bases-toolbar");
			const buttonExists = toolbarEl?.querySelector(".reading-tracker-bases-new-book-btn");

			if (!buttonExists && attempts < maxAttempts) {
				window.setTimeout(tryInject, 200);
			}
		};

		window.setTimeout(tryInject, 100);
		this.register(() => this.cleanupNewBookButton());
	}

	/**
	 * Clean up: just remove the "active" class, keep the button for reuse.
	 */
	private cleanupNewBookButton(): void {
		const basesViewEl = this.containerEl.closest(".bases-view");
		basesViewEl?.parentElement?.classList.remove("reading-tracker-view-active");
	}

	/**
	 * Inject the custom "New Book" button into the Bases toolbar.
	 */
	private injectNewBookButton(): void {
		const basesViewEl = this.containerEl.closest(".bases-view");
		const parentEl = basesViewEl?.parentElement;
		if (!parentEl) {
			return;
		}

		parentEl.classList.add("reading-tracker-view-active");

		const toolbarEl = parentEl.querySelector<HTMLElement>(".bases-toolbar");
		if (!toolbarEl || toolbarEl.querySelector(".reading-tracker-bases-new-book-btn")) {
			return;
		}

		const newBookBtn = this.createNewBookToolbarButton();

		const originalNewBtn = toolbarEl.querySelector(".bases-toolbar-new-item-menu");
		if (originalNewBtn) {
			originalNewBtn.before(newBookBtn);
		} else {
			toolbarEl.appendChild(newBookBtn);
		}
	}

	private createNewBookToolbarButton(): HTMLElement {
		const newBookBtn = createDiv({
			cls: "bases-toolbar-item reading-tracker-bases-new-book-btn",
		});

		const innerBtn = newBookBtn.createDiv({
			cls: "text-icon-button",
		});
		innerBtn.tabIndex = 0;

		const iconSpan = innerBtn.createSpan({
			cls: "text-button-icon",
		});
		setIcon(iconSpan, "book-plus");

		innerBtn.createSpan({
			cls: "text-button-label",
			text: "New book",
		});

		const openSearch = (e: Event) => {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
			this.openSearchModal();
		};

		innerBtn.addEventListener("click", openSearch, { capture: true });
		innerBtn.addEventListener("mousedown", (e: MouseEvent) => {
			if (e.button === 0) {
				openSearch(e);
			}
		}, { capture: true });
		innerBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				openSearch(e);
			}
		});

		return newBookBtn;
	}

	protected openSearchModal(): void {
		new SearchModal(this.appInstance, this.plugin).open();
	}

	/**
	 * Extract all data items from Bases query result.
	 */
	protected extractDataItems(): BasesDataItem[] {
		if (!this.data?.data) {
			return [];
		}

		const entries = this.data.data as unknown[];

		return entries
			.map((entry: unknown) => {
				const e = entry as BasesEntryData;
				if (!e?.file?.path) {
					return null;
				}

				return {
					key: e.file.path,
					data: e,
					file: e.file,
					path: e.file.path,
					properties: this.extractEntryProperties(e),
					basesData: e,
				};
			})
			.filter((item: BasesDataItem | null): item is BasesDataItem => item !== null);
	}

	/**
	 * Extract properties from a Bases entry
	 */
	private extractEntryProperties(entry: BasesEntryData): Record<string, unknown> {
		const properties: Record<string, unknown> = {};

		if (entry.note) {
			Object.assign(properties, entry.note);
		}

		if (entry.file) {
			properties['file.name'] = entry.file.name;
			properties['file.path'] = entry.file.path;
			properties['file.ctime'] = entry.file.ctime;
			properties['file.mtime'] = entry.file.mtime;
		}

		return properties;
	}

	/**
	 * Load the books behind a Bases query, together with their sittings.
	 */
	protected async extractBooksFromBasesData(
		dataItems: BasesDataItem[]
	): Promise<Array<{ book: BookWithReadingHistory; file: TFile }>> {
		const filePaths = dataItems
			.map((item) => item.file?.path)
			.filter((path): path is string => Boolean(path));

		return this.bookFileReader.readManyWithHistory(
			filePaths,
			this.plugin.settings.bookFolder,
			this.plugin.settings.readingHistoryHeading
		);
	}

	/**
	 * Render the view (abstract method to be implemented by subclasses)
	 */
	abstract render(): Promise<void> | void;

	/**
	 * Render error state
	 */
	protected renderError(error: Error): void {
		if (!this.rootElement) return;

		this.rootElement.empty();
		this.rootElement.createDiv({
			cls: "reading-tracker-error reading-tracker-view-error",
			text: `Error: ${error.message}`,
		});
	}

	/**
	 * Lifecycle: Save ephemeral state (scroll position, etc).
	 */
	getEphemeralState(): unknown {
		return {
			scrollTop: this.rootElement?.scrollTop || 0,
		};
	}

	/**
	 * Lifecycle: Restore ephemeral state.
	 */
	setEphemeralState(state: unknown): void {
		if (!state || !this.rootElement || !this.rootElement.isConnected) return;

		try {
			const s = state as { scrollTop?: number };
			if (s.scrollTop !== undefined) {
				this.rootElement.scrollTop = s.scrollTop;
			}
		} catch (e) {
			console.debug("[Reading Tracker][Bases] Failed to restore ephemeral state:", e);
		}
	}

	/**
	 * Lifecycle: Focus this view.
	 */
	focus(): void {
		try {
			if (this.rootElement?.isConnected && typeof this.rootElement.focus === "function") {
				this.rootElement.focus();
			}
		} catch (e) {
			console.debug("[Reading Tracker][Bases] Failed to focus view:", e);
		}
	}

	/**
	 * Lifecycle: Refresh/re-render the view.
	 */
	refresh(): void {
		void this.render();
	}

	/**
	 * Lifecycle: Handle view resize.
	 */
	onResize(): void {
		// Default implementation does nothing
	}

	/**
	 * View type identifier (to be set by subclasses)
	 */
	abstract get type(): string;
}
