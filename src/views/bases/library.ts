import { TFile } from 'obsidian';
import { Book, formatBookTitleWithSeries } from '../../models/book';
import { formatAmount, formatPosition, toReadingUnit } from '../../models/readingUnit';
import { BasesViewBase } from './base';
import { dayOf, formatDate } from '../../utils/dateUtils';
import ReadingTrackerPlugin from '../../main';

/** The shelves the library view groups books into — everything except books in progress. */
type ShelfSection = 'unread' | 'finished' | 'abandoned';

/**
 * Library View - Displays unread, finished, and abandoned books in list format
 */
export class LibraryBasesView extends BasesViewBase {
	type = "reading-tracker-library";

	private unreadBooks: Array<{ book: Book; file: TFile }> = [];
	private finishedBooks: Array<{ book: Book; file: TFile }> = [];
	private abandonedBooks: Array<{ book: Book; file: TFile }> = [];

	constructor(controller: unknown, containerEl: HTMLElement, plugin: ReadingTrackerPlugin) {
		super(controller, containerEl, plugin);
	}

	async render(): Promise<void> {
		if (!this.rootElement || !this.data?.data) return;

		try {
			const dataItems = this.extractDataItems();
			const allBooks = await this.extractBooksFromBasesData(dataItems);

			this.unreadBooks = allBooks.filter(({ book }) => book.status === 'unread');
			this.finishedBooks = allBooks.filter(({ book }) => book.status === 'finished');
			this.abandonedBooks = allBooks.filter(({ book }) => book.status === 'abandoned');

			// Sort unread by when the note was added (newest first)
			this.unreadBooks.sort((a, b) => b.file.stat.ctime - a.file.stat.ctime);

			// Sort finished by finished date (newest first)
			this.finishedBooks.sort((a, b) => {
				const dateA = a.book.readFinished ?? '';
				const dateB = b.book.readFinished ?? '';
				return dateB.localeCompare(dateA);
			});

			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Reading Tracker][LibraryView] Render error:', error);
			this.renderError(error as Error);
		}
	}

	private renderContent(): void {
		if (!this.rootElement) return;

		const sections: Array<{ title: string; books: Array<{ book: Book; file: TFile }>; type: ShelfSection }> = [
			{ title: 'Unread books', books: this.unreadBooks, type: 'unread' },
			{ title: 'Finished books', books: this.finishedBooks, type: 'finished' },
			{ title: 'Abandoned books', books: this.abandonedBooks, type: 'abandoned' },
		];

		const header = this.rootElement.createDiv({
			cls: 'reading-tracker-header',
		});

		const summary = sections
			.map(({ title: name, books }) => `${books.length} ${name.split(' ')[0]?.toLowerCase() ?? ''}`)
			.join(', ');
		header.createEl('h2', {
			cls: 'reading-tracker-library-header-title',
			text: `Library (${summary})`,
		});

		const contentContainer = this.rootElement.createDiv({
			cls: 'reading-tracker-shelf-content',
		});

		for (const section of sections) {
			this.renderSection(contentContainer, section.title, section.books, section.type);
		}
	}

	private renderSection(
		container: HTMLElement,
		title: string,
		books: Array<{ book: Book; file: TFile }>,
		type: ShelfSection
	): void {
		const sectionHeader = container.createDiv({
			cls: 'reading-tracker-library-section-header',
		});

		sectionHeader.createEl('h3', {
			cls: 'reading-tracker-library-section-title',
			text: `${title} (${books.length})`,
		});

		if (books.length === 0) {
			this.renderEmptyState(container);
			return;
		}

		const list = container.createEl('ul', {
			cls: 'reading-tracker-unread-ul',
		});

		for (const { book, file } of books) {
			this.renderBookListItem(list, book, file, type);
		}
	}

	private renderBookListItem(
		list: HTMLUListElement,
		book: Book,
		file: TFile,
		type: ShelfSection
	): void {
		const listItem = list.createEl('li', {
			cls: 'reading-tracker-library-item',
		});
		listItem.addEventListener('click', (e) => {
			if (e.defaultPrevented) return;
			void this.appInstance.workspace.openLinkText(file.path, '', true);
		});

		listItem.createDiv({
			cls: 'reading-tracker-library-item-title',
			text: formatBookTitleWithSeries(book),
		});

		if (book.author && book.author.length > 0) {
			listItem.createDiv({
				cls: 'reading-tracker-library-item-author',
				text: book.author.join(', '),
			});
		}

		this.renderBookMeta(listItem, book, file, type);
	}

	private renderBookMeta(
		parent: HTMLElement,
		book: Book,
		file: TFile,
		type: ShelfSection
	): void {
		const metaEl = parent.createDiv({
			cls: 'reading-tracker-library-item-meta',
		});

		const unit = toReadingUnit(book.readingUnit);
		const finishedDate = dayOf(book.readFinished) ?? book.readFinished;

		if (type === 'finished' && finishedDate) {
			metaEl.createSpan({ text: `Finished: ${finishedDate}` });
		} else if (type !== 'finished') {
			metaEl.createSpan({ text: `Added: ${formatDate(new Date(file.stat.ctime))}` });
		}

		if (type === 'abandoned' && book.readPage) {
			metaEl.createSpan({ text: `Stopped at ${formatPosition(book.readPage, unit)}` });
		}

		if (book.rating !== undefined && book.rating > 0) {
			metaEl.createSpan({ text: '★'.repeat(book.rating) });
		}

		if (book.totalPages) {
			metaEl.createSpan({ text: formatAmount(book.totalPages, unit) });
		}
	}

	private renderEmptyState(container: HTMLElement): void {
		const emptyState = container.createDiv({
			cls: 'reading-tracker-library-empty-state',
		});
		emptyState.createDiv({
			cls: 'reading-tracker-library-empty-text',
			text: 'No books in this section.',
		});
	}
}

