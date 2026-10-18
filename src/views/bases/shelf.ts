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

		const doc = this.rootElement.ownerDocument;
		const contentContainer = doc.createElement('div');
		contentContainer.className = 'reading-tracker-shelf-content';

		const readingBooks = this.books
			.filter(({ book }) => book.status === 'reading')
			.sort((a, b) => this.sortBooks(a, b));
		const unreadBooks = this.books
			.filter(({ book }) => book.status === 'unread')
			.sort((a, b) => this.sortBooks(a, b));

		if (readingBooks.length === 0 && unreadBooks.length === 0) {
			this.renderEmptyState(contentContainer);
			this.rootElement.appendChild(contentContainer);
			return;
		}

		this.renderReadingSection(contentContainer, readingBooks);
		this.renderUnreadSubSection(contentContainer, unreadBooks);

		this.rootElement.appendChild(contentContainer);
	}

	/**
	 * Render the "Reading" section (cards grid when populated, drop target prompt when empty).
	 */
	private renderReadingSection(
		container: HTMLElement,
		books: Array<{ book: BookWithReadingHistory; file: TFile }>
	): void {
		const doc = container.ownerDocument;

		const sectionHeader = doc.createElement('div');
		sectionHeader.className = 'reading-tracker-section-header';

		const titleEl = doc.createElement('h2');
		titleEl.textContent = `Reading (${books.length})`;
		sectionHeader.appendChild(titleEl);
		container.appendChild(sectionHeader);

		const dropZone = books.length > 0
			? this.createReadingBooksGrid(doc, books)
			: this.createEmptyReadingDropZone(doc);

		this.attachDropZoneHandlers(dropZone);
		container.appendChild(dropZone);
	}

	private createReadingBooksGrid(
		doc: Document,
		books: Array<{ book: BookWithReadingHistory; file: TFile }>
	): HTMLElement {
		const booksGrid = doc.createElement('div');
		booksGrid.className = 'reading-tracker-section-books reading-tracker-drop-zone';

		for (const { book, file } of books) {
			const bookCard = new BookCard(this.appInstance, book, file, this.plugin);
			booksGrid.appendChild(bookCard.render());
		}

		return booksGrid;
	}

	private createEmptyReadingDropZone(doc: Document): HTMLElement {
		const dropZone = doc.createElement('div');
		dropZone.className = 'reading-tracker-empty-drop-zone reading-tracker-drop-zone';

		const description = doc.createElement('p');
		description.className = 'reading-tracker-empty-drop-title';
		description.textContent = 'Drag a book from "to read" here, or click "start reading" to begin.';
		dropZone.appendChild(description);

		const hint = doc.createElement('p');
		hint.className = 'reading-tracker-empty-drop-hint';
		hint.textContent = 'Use "new book" in the toolbar to add a new title.';
		dropZone.appendChild(hint);

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
			setTimeout(() => {
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

		const section = doc.createElement('div');
		section.className = 'reading-tracker-unread-subsection';

		const header = doc.createElement('div');
		header.className = `reading-tracker-subsection-header${hasBooks ? ' is-collapsible' : ''}`;

		const titleEl = doc.createElement('h3');
		titleEl.textContent = `To read (${books.length})`;
		header.appendChild(titleEl);
		section.appendChild(header);

		if (!hasBooks) {
			const emptyContent = doc.createElement('div');
			emptyContent.className = 'reading-tracker-unread-empty';
			emptyContent.textContent = 'No books waiting to be read.';
			section.appendChild(emptyContent);
			container.appendChild(section);
			return;
		}

		const chevron = doc.createElement('span');
		chevron.className = 'reading-tracker-subsection-chevron';
		setIcon(chevron, 'chevron-down');
		header.appendChild(chevron);

		const content = doc.createElement('div');
		content.className = 'reading-tracker-unread-list';

		let isExpanded = true;
		header.addEventListener('click', () => {
			isExpanded = !isExpanded;
			content.classList.toggle('is-collapsed', !isExpanded);
			chevron.classList.toggle('is-collapsed', !isExpanded);
		});

		const list = doc.createElement('ul');
		list.className = 'reading-tracker-unread-ul';

		for (const { book, file } of books) {
			list.appendChild(this.renderUnreadBookItem(doc, book, file));
		}

		content.appendChild(list);
		section.appendChild(content);
		container.appendChild(section);
	}

	private renderUnreadBookItem(doc: Document, book: Book, file: TFile): HTMLLIElement {
		const listItem = doc.createElement('li');
		listItem.className = 'reading-tracker-unread-item';
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
				setTimeout(() => {
					isDragging = false;
				}, 100);
				return;
			}
			if (!e.defaultPrevented) {
				void this.appInstance.workspace.openLinkText(file.path, '', true);
			}
		});

		const info = doc.createElement('div');
		info.className = 'reading-tracker-unread-info';

		const titleRow = doc.createElement('div');
		titleRow.className = 'reading-tracker-unread-title-row';

		const title = doc.createElement('span');
		title.className = 'reading-tracker-unread-title';
		title.textContent = book.title;
		titleRow.appendChild(title);

		const seriesLabel = formatSeriesLabel(book);
		if (seriesLabel) {
			const seriesPill = doc.createElement('span');
			seriesPill.className = 'reading-tracker-series-pill';
			seriesPill.textContent = seriesLabel;
			titleRow.appendChild(seriesPill);
		}

		info.appendChild(titleRow);

		const metaParts: string[] = [];
		if (book.author && book.author.length > 0) {
			metaParts.push(book.author.join(', '));
		}
		if (book.totalPages) {
			metaParts.push(formatAmount(book.totalPages, toReadingUnit(book.readingUnit)));
		}

		if (metaParts.length > 0) {
			const author = doc.createElement('div');
			author.className = 'reading-tracker-unread-author';
			author.textContent = metaParts.join(' · ');
			info.appendChild(author);
		}

		listItem.appendChild(info);

		const startButton = doc.createElement('button');
		startButton.className = 'reading-tracker-start-reading';
		startButton.textContent = 'Start reading';
		startButton.title = 'Move this book to the reading section';
		startButton.addEventListener('mousedown', (e) => {
			e.stopPropagation();
		});
		startButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.startReadingBook(file.path);
		});
		listItem.appendChild(startButton);

		return listItem;
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
		const doc = container.ownerDocument;
		const emptyState = doc.createElement('div');
		emptyState.className = 'reading-tracker-empty-state';

		const title = doc.createElement('h2');
		title.className = 'reading-tracker-empty-title';
		title.textContent = 'No books on your shelf yet';
		emptyState.appendChild(title);

		const description = doc.createElement('p');
		description.className = 'reading-tracker-empty-description';
		description.textContent = 'Search the catalogue or add a book by hand to start keeping reading notes.';
		emptyState.appendChild(description);

		const addButton = doc.createElement('button');
		addButton.className = 'mod-cta';
		addButton.textContent = 'Search and add book';
		addButton.addEventListener('click', (e) => {
			e.stopPropagation();
			e.preventDefault();
			this.openSearchModal();
		});
		emptyState.appendChild(addButton);

		container.appendChild(emptyState);
	}
}
