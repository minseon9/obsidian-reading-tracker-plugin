import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { Book } from '../models/book';
import { BookStatus } from '../models/bookStatus';
import {
	READING_UNITS,
	ReadingUnit,
	defaultTotalFor,
	parsePosition,
	readingUnitLabel,
} from '../models/readingUnit';
import { OpenLibraryClient } from '../apis/openLibrary';
import { createBookFromData } from '../models/bookFactory';
import { BookFileCreator } from '../services/bookFileService/bookFileCreator';
import { BookFileReader } from '../services/bookFileService/bookFileReader';
import { BookSearchResult } from '../models/bookSearchResult';
import { PathManager } from '../services/pathService/pathManager';
import { refreshBasesViews } from '../services/obsidian/bases/basesPluginClient';
import { formatDateTime } from '../utils/dateUtils';
import { MessageBanner } from './components/MessageBanner';
import ReadingTrackerPlugin from '../main';

/** Enough results to find the book without turning the dialog into a catalogue. */
const SEARCH_RESULT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 2;

export class SearchModal extends Modal {
	private plugin: ReadingTrackerPlugin;
	private searchInput: HTMLInputElement;
	private resultsContainer: HTMLElement;
	private loadingIndicator: HTMLElement;
	private openLibraryClient: OpenLibraryClient;
	private bookFileCreator: BookFileCreator;
	private bookFileReader: BookFileReader;
	private searchTimeout: ReturnType<typeof setTimeout> | null = null;
	private currentResults: BookSearchResult[] = [];
	private currentOffset = 0;
	private hasMoreResults = false;
	private isLoadingMore = false;
	private activeSearchSequence = 0;

	constructor(app: App, plugin: ReadingTrackerPlugin) {
		super(app);
		this.plugin = plugin;
		this.openLibraryClient = new OpenLibraryClient();
		this.bookFileCreator = new BookFileCreator(app);
		this.bookFileReader = new BookFileReader(app);
	}

	onOpen() {
		this.modalEl.addClass('reading-tracker-search-modal');
		const { contentEl } = this;
		contentEl.empty();

		this.setTitle('Search and add book');

		new Setting(contentEl)
			.setName('Search query')
			.setDesc('Enter book title, author or ISBN')
			.addText((text) => {
				this.searchInput = text.inputEl;
				this.searchInput.placeholder = 'Search catalogue or type a title to add by hand...';
				this.searchInput.addEventListener('input', () => {
					this.handleSearchInput();
				});
			});

		this.loadingIndicator = contentEl.createEl('div', {
			cls: 'reading-tracker-loading is-hidden',
			text: 'Searching catalogue...',
		});

		this.resultsContainer = contentEl.createEl('div', {
			cls: 'reading-tracker-search-results',
		});

		this.resultsContainer.addEventListener('scroll', () => {
			this.handleScroll();
		});

		this.renderManualAdd(this.resultsContainer, '');
		this.searchInput.focus();
	}

	onClose() {
		this.contentEl.empty();
		this.activeSearchSequence++;

		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
			this.searchTimeout = null;
		}
	}

	private handleSearchInput() {
		const query = this.searchInput.value.trim();

		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
			this.searchTimeout = null;
		}

		this.activeSearchSequence++;
		this.resetPaginationState();
		MessageBanner.clearError(this.contentEl);

		if (query.length < MIN_QUERY_LENGTH) {
			this.resultsContainer.empty();
			this.hideLoading();
			this.renderManualAdd(this.resultsContainer, query);
			return;
		}

		this.showLoading();
		const sequence = this.activeSearchSequence;

		this.searchTimeout = setTimeout(() => {
			void this.performSearch(query, 0, sequence);
		}, SEARCH_DEBOUNCE_MS);
	}

	private resetPaginationState(): void {
		this.currentResults = [];
		this.currentOffset = 0;
		this.hasMoreResults = false;
		this.isLoadingMore = false;
	}

	private async performSearch(query: string, offset: number, sequence: number): Promise<void> {
		try {
			const batch = await this.openLibraryClient.searchBooks(query, SEARCH_RESULT_LIMIT, offset);
			if (sequence !== this.activeSearchSequence) {
				return;
			}

			const isFirstPage = offset === 0;
			this.currentResults = isFirstPage ? batch : [...this.currentResults, ...batch];
			this.hasMoreResults = batch.length === SEARCH_RESULT_LIMIT;
			this.currentOffset = offset + batch.length;
			this.isLoadingMore = false;

			this.hideLoading();
			this.removeLoadingMoreIndicator();
			this.renderResultsBatch(batch, isFirstPage, query);
		} catch {
			if (sequence !== this.activeSearchSequence) {
				return;
			}
			this.isLoadingMore = false;
			this.hideLoading();
			this.removeLoadingMoreIndicator();
			MessageBanner.showError(this.contentEl, 'Failed to search books. You can still add the book by hand below.');
			if (offset === 0) {
				this.resultsContainer.empty();
				this.renderManualAdd(this.resultsContainer, query);
			}
		}
	}

	/**
	 * Handle scroll for infinite scroll
	 */
	private handleScroll(): void {
		if (this.isLoadingMore || !this.hasMoreResults) return;

		const { scrollTop, scrollHeight, clientHeight } = this.resultsContainer;
		if (scrollTop + clientHeight >= scrollHeight * 0.8) {
			this.loadMoreResults();
		}
	}

	private loadMoreResults(): void {
		if (this.isLoadingMore || !this.hasMoreResults) return;

		const query = this.searchInput.value.trim();
		if (!query) return;

		this.isLoadingMore = true;
		this.renderLoadingMoreIndicator();
		void this.performSearch(query, this.currentOffset, this.activeSearchSequence);
	}

	private renderResultsBatch(
		batch: BookSearchResult[],
		isFirstPage: boolean,
		query: string
	): void {
		if (isFirstPage) {
			this.resultsContainer.empty();
		} else {
			this.resultsContainer.querySelector('.reading-tracker-manual-add')?.remove();
		}

		if (this.currentResults.length === 0) {
			this.resultsContainer.createEl('div', {
				cls: 'reading-tracker-no-results',
				text: 'No matching books found in the catalogue.',
			});
			this.renderManualAdd(this.resultsContainer, query);
			return;
		}

		for (const book of batch) {
			this.renderResultItem(book);
		}

		if (!this.hasMoreResults) {
			this.renderManualAdd(this.resultsContainer, query);
		}
	}

	private renderResultItem(book: BookSearchResult): void {
		const resultItem = this.resultsContainer.createEl('div', {
			cls: 'reading-tracker-result-item',
		});

		if (book.coverUrl) {
			const coverContainer = resultItem.createEl('div', {
				cls: 'reading-tracker-result-cover',
			});
			const coverImg = coverContainer.createEl('img', {
				attr: {
					src: book.coverUrl,
					alt: book.title,
				},
			});
			coverImg.addEventListener('error', () => {
				coverContainer.remove();
			});
		}

		const infoContainer = resultItem.createEl('div', {
			cls: 'reading-tracker-result-info',
		});

		infoContainer.createEl('div', {
			cls: 'reading-tracker-result-title',
			text: book.title,
		});

		if (book.author && book.author.length > 0) {
			infoContainer.createEl('div', {
				cls: 'reading-tracker-result-author',
				text: `by ${book.author.join(', ')}`,
			});
		}

		const metaParts: string[] = [];
		if (book.publishDate) metaParts.push(book.publishDate);
		if (book.publisher) metaParts.push(book.publisher);
		if (book.totalPages) metaParts.push(`${book.totalPages} pages`);

		if (metaParts.length > 0) {
			infoContainer.createEl('div', {
				cls: 'reading-tracker-result-meta',
				text: metaParts.join(' · '),
			});
		}

		const actions = infoContainer.createEl('div', {
			cls: 'reading-tracker-result-actions',
		});

		const startButton = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Start reading',
		});
		startButton.addEventListener('click', () => {
			void this.addBookFromSearch(book, 'reading');
		});

		const shelfButton = actions.createEl('button', {
			text: 'Add to shelf',
		});
		shelfButton.addEventListener('click', () => {
			void this.addBookFromSearch(book, 'unread');
		});
	}

	private renderLoadingMoreIndicator(): void {
		this.removeLoadingMoreIndicator();
		this.resultsContainer.createEl('div', {
			cls: 'reading-tracker-loading-more',
			text: 'Loading more...',
		});
	}

	private removeLoadingMoreIndicator(): void {
		this.resultsContainer.querySelector('.reading-tracker-loading-more')?.remove();
	}

	/**
	 * Inline form to create a book note by hand with title, author, total, and unit.
	 */
	private renderManualAdd(container: HTMLElement, defaultTitle: string): void {
		container.querySelector('.reading-tracker-manual-add')?.remove();

		const section = container.createEl('div', { cls: 'reading-tracker-manual-add' });
		section.createEl('div', {
			cls: 'reading-tracker-manual-add-title',
			text: 'Add a book by hand',
		});
		section.createEl('div', {
			cls: 'reading-tracker-manual-add-hint',
			text: 'Not in the catalogue? Fill in what you know now; you can always edit properties on the note later.',
		});

		const grid = section.createEl('div', { cls: 'reading-tracker-manual-form-grid' });

		const titleField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		titleField.createEl('span', { cls: 'reading-tracker-metric-label', text: 'Title' });
		const titleInput = titleField.createEl('input', {
			type: 'text',
			placeholder: 'Book title',
			value: defaultTitle,
		});

		const authorField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		authorField.createEl('span', { cls: 'reading-tracker-metric-label', text: 'Author (optional)' });
		const authorInput = authorField.createEl('input', {
			type: 'text',
			placeholder: 'Han Kang',
		});

		const totalField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		const totalLabel = totalField.createEl('span', {
			cls: 'reading-tracker-metric-label',
			text: 'Total pages (optional)',
		});
		const totalInput = totalField.createEl('input', {
			type: 'text',
			placeholder: '216',
		});

		const unitField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		unitField.createEl('span', { cls: 'reading-tracker-metric-label', text: 'Unit' });
		const unitSelect = unitField.createEl('select', { cls: 'dropdown' });
		for (const unit of READING_UNITS) {
			unitSelect.createEl('option', { value: unit, text: readingUnitLabel(unit) });
		}
		unitSelect.addEventListener('change', () => {
			const unit = unitSelect.value as ReadingUnit;
			if (unit === 'percent') {
				totalLabel.textContent = 'Total percent';
				totalInput.placeholder = '100';
			} else if (unit === 'time') {
				totalLabel.textContent = 'Total duration (optional)';
				totalInput.placeholder = '8:30';
			} else {
				totalLabel.textContent = 'Total pages (optional)';
				totalInput.placeholder = '216';
			}
		});

		const actions = section.createEl('div', { cls: 'reading-tracker-result-actions' });

		const submitManual = async (status: BookStatus) => {
			const title = titleInput.value.trim();
			if (!title) {
				MessageBanner.showError(this.contentEl, 'Enter a book title first.');
				titleInput.focus();
				return;
			}

			const unit = unitSelect.value as ReadingUnit;
			const rawTotal = totalInput.value.trim();
			const parsedTotal = rawTotal ? parsePosition(rawTotal, unit) : defaultTotalFor(unit);
			if (rawTotal && (parsedTotal === null || parsedTotal === undefined || parsedTotal <= 0)) {
				MessageBanner.showError(this.contentEl, 'Enter a valid total for the selected reading unit.');
				totalInput.focus();
				return;
			}

			const authors = authorInput.value
				.split(',')
				.map((a) => a.trim())
				.filter((a) => a.length > 0);

			await this.createManualBook({
				title,
				author: authors,
				totalPages: parsedTotal ?? undefined,
				readingUnit: unit,
				status,
				readStarted: status === 'reading' ? formatDateTime() : undefined,
			});
		};

		const startReadingBtn = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Start reading',
		});
		startReadingBtn.addEventListener('click', () => void submitManual('reading'));

		const addUnreadBtn = actions.createEl('button', {
			text: 'Add to shelf',
		});
		addUnreadBtn.addEventListener('click', () => void submitManual('unread'));
	}

	private async createManualBook(data: Partial<Book>): Promise<void> {
		try {
			this.setButtonsState(true, 'Adding...');
			const book = createBookFromData(data);
			this.validateBookNotExists(book);

			const createdFile = await this.bookFileCreator.create(book, this.plugin.settings.bookFolder);
			this.triggerViewRefresh(createdFile);
			new Notice(`Added "${book.title}".`);
			this.close();
			await this.app.workspace.getLeaf(true).openFile(createdFile);
		} catch (error) {
			MessageBanner.showError(
				this.contentEl,
				`Failed to add book: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			this.setButtonsState(false, '');
		}
	}

	private async addBookFromSearch(book: BookSearchResult, status: BookStatus): Promise<void> {
		try {
			this.setButtonsState(true, 'Adding...');
			const detailedBook = await this.fetchDetailedBookInfo(book);
			const bookWithStatus: Book = {
				...detailedBook,
				status,
				readStarted: status === 'reading' ? formatDateTime() : undefined,
			};
			this.validateBookNotExists(bookWithStatus);
			const createdFile = await this.bookFileCreator.create(
				bookWithStatus,
				this.plugin.settings.bookFolder
			);
			this.triggerViewRefresh(createdFile);
			new Notice(`Added "${bookWithStatus.title}".`);
			this.close();
			if (status === 'reading') {
				await this.app.workspace.getLeaf(true).openFile(createdFile);
			}
		} catch (error) {
			MessageBanner.showError(
				this.contentEl,
				`Failed to add book: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			this.setButtonsState(false, '');
		}
	}

	private async fetchDetailedBookInfo(book: BookSearchResult): Promise<Book> {
		if (!book.editionKey) {
			return book;
		}

		const booksApiBook = await this.openLibraryClient.getBookByOLID(book.editionKey);
		if (!booksApiBook) {
			return book;
		}

		return {
			...book,
			...booksApiBook,
			totalPages: booksApiBook.totalPages || book.totalPages,
			coverUrl: booksApiBook.coverUrl || book.coverUrl,
			title: booksApiBook.title || book.title,
			author: booksApiBook.author.length > 0 ? booksApiBook.author : book.author,
			publisher: booksApiBook.publisher || book.publisher,
			publishDate: booksApiBook.publishDate || book.publishDate,
		};
	}

	private validateBookNotExists(book: Book): void {
		const booksFolder = PathManager.getBooksFolderPath(this.plugin.settings.bookFolder);
		const existingFile = this.bookFileReader.findExisting(booksFolder, book.title);
		if (existingFile) {
			throw new Error(`Book "${book.title}" already exists.`);
		}
	}

	private setButtonsState(disabled: boolean, loadingText: string): void {
		const buttons = this.resultsContainer.querySelectorAll<HTMLButtonElement>('button');
		buttons.forEach((btn) => {
			if (disabled) {
				btn.dataset.originalText = btn.textContent ?? 'Add book';
				btn.textContent = loadingText;
			} else if (btn.dataset.originalText) {
				btn.textContent = btn.dataset.originalText;
			}
			btn.disabled = disabled;
		});
	}

	private triggerViewRefresh(file: TFile): void {
		try {
			this.app.vault.trigger('modify', file);
			refreshBasesViews(this.app);
		} catch (e) {
			console.debug('[Reading Tracker] Error triggering Bases refresh:', e);
		}
	}

	private showLoading() {
		this.loadingIndicator.removeClass('is-hidden');
	}

	private hideLoading() {
		this.loadingIndicator.addClass('is-hidden');
	}
}
