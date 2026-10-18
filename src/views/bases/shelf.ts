import { TFile, setIcon } from 'obsidian';
import { Book, formatSeriesLabel } from '../../models/book';
import { formatAmount, toReadingUnit } from '../../models/readingUnit';
import { BasesViewBase } from './base';
import { BookCard } from '../bookCard';
import { BookWithReadingHistory } from '../../models/bookWithReadingHistory';

const BOOK_DRAG_MIME = 'application/reading-tracker-book';

/**
 * Shelf Bases view — shows books currently being read and books queued to read.
 */
export class ShelfBasesView extends BasesViewBase {
	type = "reading-tracker-shelf";

	private books: Array<{ book: BookWithReadingHistory; file: TFile }> = [];

	async render(): Promise<void> {
		if (!this.rootElement || !this.data?.data) {
			return;
		}

		try {
			const dataItems = this.extractDataItems();
			this.books = await this.extractBooksFromBasesData(dataItems);

			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Reading Tracker][BasesView] Render error:', error);
			this.renderError(error as Error);
		}
	}

	/**
	 * Render the main content: Reading books (grid) and To read books (collapsible list).
	 */
	private renderContent(): void {
		if (!this.rootElement) return;

		const contentContainer = this.rootElement.createDiv({
			cls: 'reading-tracker-shelf-content',
		});

		const readingBooks = this.books
			.filter(({ book }) => book.status === 'reading')
			.sort((a, b) => this.sortBooks(a, b));
		const unreadBooks = this.books
			.filter(({ book }) => book.status === 'unread')
			.sort((a, b) => this.sortBooks(a, b));

		if (readingBooks.length === 0 && unreadBooks.length === 0) {
			this.renderEmptyState(contentContainer);
			return;
		}

		this.renderReadingSection(contentContainer, readingBooks);
		this.renderUnreadSubSection(contentContainer, unreadBooks);
	}

	/**
	 * Render the "Reading" section (cards grid when populated, drop target prompt when empty).
	 */
	private renderReadingSection(
		container: HTMLElement,
		books: Array<{ book: BookWithReadingHistory; file: TFile }>
	): void {
		const sectionHeader = container.createDiv({
			cls: 'reading-tracker-section-header',
		});
		sectionHeader.createEl('h2', {
			text: `Reading (${books.length})`,
		});

		const dropZone = books.length > 0
			? this.createReadingBooksGrid(container, books)
			: this.createEmptyReadingDropZone(container);

		this.attachDropZoneHandlers(dropZone);
	}

	private createReadingBooksGrid(
		container: HTMLElement,
		books: Array<{ book: BookWithReadingHistory; file: TFile }>
	): HTMLElement {
		const booksGrid = container.createDiv({
			cls: 'reading-tracker-section-books reading-tracker-drop-zone',
		});

		for (const { book, file } of books) {
			const bookCard = new BookCard(this.appInstance, book, file, this.plugin);
			booksGrid.appendChild(bookCard.render());
		}

		return booksGrid;
	}

	private createEmptyReadingDropZone(container: HTMLElement): HTMLElement {
		const dropZone = container.createDiv({
			cls: 'reading-tracker-empty-drop-zone reading-tracker-drop-zone',
		});

		dropZone.createEl('p', {
			cls: 'reading-tracker-empty-drop-title',
			text: 'Drag a book from "to read" here, or click "start reading" to begin.',
		});

		dropZone.createEl('p', {
			cls: 'reading-tracker-empty-drop-hint',
			text: 'Use "new book" in the toolbar to add a new title.',
		});

		return dropZone;
	}

	private attachDropZoneHandlers(dropZone: HTMLElement): void {
		const activateDragOver = (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}
			dropZone.classList.add('drag-over');
		};

		dropZone.addEventListener('dragover', activateDragOver, false);
		dropZone.addEventListener('dragenter', activateDragOver, false);

		dropZone.addEventListener('dragleave', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const rect = dropZone.getBoundingClientRect();
			if (
				e.clientX < rect.left ||
				e.clientX > rect.right ||
				e.clientY < rect.top ||
				e.clientY > rect.bottom
			) {
				dropZone.classList.remove('drag-over');
			}
		}, false);

		dropZone.addEventListener('drop', (e: DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			dropZone.classList.remove('drag-over');

			const filePath = ShelfBasesView.extractDroppedFilePath(e);
			if (filePath) {
				void this.startReadingBook(filePath);
			}
		}, false);
	}

	private static extractDroppedFilePath(e: DragEvent): string | null {
		const dataTransfer = e.dataTransfer;
		if (!dataTransfer) {
			return null;
		}

		try {
			const bookData = dataTransfer.getData(BOOK_DRAG_MIME);
			if (bookData && bookData.trim()) {
				const parsed = JSON.parse(bookData) as { path?: string };
				if (parsed.path) {
					return parsed.path;
				}
			}
		} catch {
			// Fall back to text/plain below
		}

		try {
			const textData = dataTransfer.getData('text/plain');
			if (textData && textData.trim()) {
				return textData.trim();
			}
		} catch {
			// Ignore dataTransfer read errors
		}

		return null;
	}

	/**
	 * Transition a book to the `'reading'` status and re-render the shelf.
	 */
	private async startReadingBook(filePath: string): Promise<void> {
		try {
			const file = this.appInstance.vault.getFileByPath(filePath);
			if (!file) {
				return;
			}

			await this.bookFileUpdater.startReading(file);
			window.setTimeout(() => {
				void this.render();
			}, 300);
		} catch (error) {
			console.error('[Reading Tracker] Error starting book:', error);
		}
	}

	/**
	 * Render the "To read" collapsible sub-section.
	 */
	private renderUnreadSubSection(
		container: HTMLElement,
		books: Array<{ book: Book; file: TFile }>
	): void {
		const doc = container.ownerDocument;
		const hasBooks = books.length > 0;

		const section = container.createDiv({
			cls: 'reading-tracker-unread-subsection',
		});

		const header = section.createDiv({
			cls: `reading-tracker-subsection-header${hasBooks ? ' is-collapsible' : ''}`,
		});

		header.createEl('h3', {
			text: `To read (${books.length})`,
		});

		if (!hasBooks) {
			section.createDiv({
				cls: 'reading-tracker-unread-empty',
				text: 'No books waiting to be read.',
			});
			return;
		}

		const chevron = header.createSpan({
			cls: 'reading-tracker-subsection-chevron',
		});
		setIcon(chevron, 'chevron-down');

		const content = section.createDiv({
			cls: 'reading-tracker-unread-list',
		});

		let isExpanded = true;
		header.addEventListener('click', () => {
			isExpanded = !isExpanded;
			content.classList.toggle('is-collapsed', !isExpanded);
			chevron.classList.toggle('is-collapsed', !isExpanded);
		});

		const list = content.createEl('ul', {
			cls: 'reading-tracker-unread-ul',
		});

		for (const { book, file } of books) {
			this.renderUnreadBookItem(list, doc, book, file);
		}
	}

	private renderUnreadBookItem(
		list: HTMLUListElement,
		doc: Document,
		book: Book,
		file: TFile
	): void {
		const listItem = list.createEl('li', {
			cls: 'reading-tracker-unread-item',
		});
		listItem.draggable = true;
		listItem.dataset.bookPath = file.path;

		let isDragging = false;

		listItem.addEventListener('dragstart', (e: DragEvent) => {
			isDragging = true;
			listItem.classList.add('dragging');

			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/plain', file.path);
				e.dataTransfer.setData(BOOK_DRAG_MIME, JSON.stringify({ path: file.path, status: 'unread' }));
			}
		}, false);

		listItem.addEventListener('dragend', () => {
			isDragging = false;
			listItem.classList.remove('dragging');
			doc.querySelectorAll('.reading-tracker-drop-zone').forEach((zone: Element) => {
				zone.classList.remove('drag-over');
			});
		});

		listItem.addEventListener('click', (e) => {
			if (isDragging) {
				e.preventDefault();
				e.stopPropagation();
				window.setTimeout(() => {
					isDragging = false;
				}, 100);
				return;
			}
			if (!e.defaultPrevented) {
				void this.appInstance.workspace.openLinkText(file.path, '', true);
			}
		});

		const info = listItem.createDiv({
			cls: 'reading-tracker-unread-info',
		});

		const titleRow = info.createDiv({
			cls: 'reading-tracker-unread-title-row',
		});

		titleRow.createSpan({
			cls: 'reading-tracker-unread-title',
			text: book.title,
		});

		const seriesLabel = formatSeriesLabel(book);
		if (seriesLabel) {
			titleRow.createSpan({
				cls: 'reading-tracker-series-pill',
				text: seriesLabel,
			});
		}

		const metaParts: string[] = [];
		if (book.author && book.author.length > 0) {
			metaParts.push(book.author.join(', '));
		}
		if (book.totalPages) {
			metaParts.push(formatAmount(book.totalPages, toReadingUnit(book.readingUnit)));
		}

		if (metaParts.length > 0) {
			info.createDiv({
				cls: 'reading-tracker-unread-author',
				text: metaParts.join(' · '),
			});
		}

		const startButton = listItem.createEl('button', {
			cls: 'reading-tracker-start-reading',
			text: 'Start reading',
		});
		startButton.title = 'Move this book to the reading section';
		startButton.addEventListener('mousedown', (e) => {
			e.stopPropagation();
		});
		startButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.startReadingBook(file.path);
		});
	}

	/**
	 * Most recently touched first: the book you read last night should be the
	 * one at hand. Books never opened fall back to when they were added.
	 */
	private sortBooks(
		a: { book: BookWithReadingHistory; file: TFile },
		b: { book: BookWithReadingHistory; file: TFile }
	): number {
		const key = ({ book, file }: { book: BookWithReadingHistory; file: TFile }) =>
			book.lastReadDate ?? book.readStarted ?? new Date(file.stat.ctime).toISOString();
		return key(b).localeCompare(key(a));
	}

	/**
	 * Render empty state when no books are added
	 */
	private renderEmptyState(container: HTMLElement): void {
		const emptyState = container.createDiv({
			cls: 'reading-tracker-empty-state',
		});

		emptyState.createEl('h2', {
			cls: 'reading-tracker-empty-title',
			text: 'No books on your shelf yet',
		});

		emptyState.createEl('p', {
			cls: 'reading-tracker-empty-description',
			text: 'Search the catalogue or add a book by hand to start keeping reading notes.',
		});

		const addButton = emptyState.createEl('button', {
			cls: 'mod-cta',
			text: 'Search and add book',
		});
		addButton.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			this.openSearchModal();
		});
	}
}
