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

		const doc = this.rootElement.ownerDocument;

		const sections: Array<{ title: string; books: Array<{ book: Book; file: TFile }>; type: ShelfSection }> = [
			{ title: 'Unread books', books: this.unreadBooks, type: 'unread' },
			{ title: 'Finished books', books: this.finishedBooks, type: 'finished' },
			{ title: 'Abandoned books', books: this.abandonedBooks, type: 'abandoned' },
		];

		const header = doc.createElement('div');
		header.className = 'reading-tracker-header';
		header.setCssProps({
			padding: "12px",
			"border-bottom": "1px solid var(--background-modifier-border)"
		});

		const summary = sections
			.map(({ title: name, books }) => `${books.length} ${name.split(' ')[0]?.toLowerCase() ?? ''}`)
			.join(', ');
		const title = doc.createElement('h2');
		title.textContent = `Library (${summary})`;
		title.setCssProps({
			margin: "0",
			"font-size": "1.2em"
		});
		header.appendChild(title);

		this.rootElement.appendChild(header);

		const contentContainer = doc.createElement('div');
		contentContainer.setCssProps({
			flex: "1",
			"overflow-y": "auto",
			padding: "12px"
		});

		for (const section of sections) {
			this.renderSection(contentContainer, doc, section.title, section.books, section.type);
		}

		this.rootElement.appendChild(contentContainer);
	}

	private renderSection(
		container: HTMLElement,
		doc: Document,
		title: string,
		books: Array<{ book: Book; file: TFile }>,
		type: ShelfSection
	): void {
		const sectionHeader = doc.createElement('div');
		sectionHeader.setCssProps({
			"margin-top": "24px",
			"margin-bottom": "12px",
			"padding-bottom": "8px",
			"border-bottom": "2px solid var(--background-modifier-border)"
		});

		const titleEl = doc.createElement('h3');
		titleEl.textContent = `${title} (${books.length})`;
		titleEl.setCssProps({
			margin: "0",
			"font-size": "1.2em",
			"font-weight": "600"
		});
		sectionHeader.appendChild(titleEl);
		container.appendChild(sectionHeader);

		if (books.length === 0) {
			this.renderEmptyState(container);
			return;
		}

		const list = doc.createElement('ul');
		list.setCssProps({
			"list-style": "none",
			padding: "0",
			margin: "0"
		});

		for (const { book, file } of books) {
			list.appendChild(this.renderBookListItem(doc, book, file, type));
		}

		container.appendChild(list);
	}

	private renderBookListItem(
		doc: Document,
		book: Book,
		file: TFile,
		type: ShelfSection
	): HTMLLIElement {
		const listItem = doc.createElement('li');
		listItem.setCssProps({
			padding: "12px",
			"border-bottom": "1px solid var(--background-modifier-border)",
			cursor: "pointer"
		});
		listItem.addEventListener('click', (e) => {
			if (e.defaultPrevented) return;
			void this.appInstance.workspace.openLinkText(file.path, '', true);
		});

		const titleEl = doc.createElement('div');
		titleEl.textContent = formatBookTitleWithSeries(book);
		titleEl.setCssProps({
			"font-weight": "600",
			"font-size": "14px",
			"margin-bottom": "4px"
		});
		listItem.appendChild(titleEl);

		if (book.author && book.author.length > 0) {
			const authorEl = doc.createElement('div');
			authorEl.textContent = book.author.join(', ');
			authorEl.setCssProps({
				"font-size": "12px",
				color: "var(--text-muted)",
				"margin-bottom": "4px"
			});
			listItem.appendChild(authorEl);
		}

		listItem.appendChild(this.renderBookMeta(doc, book, file, type));
		return listItem;
	}

	private renderBookMeta(
		doc: Document,
		book: Book,
		file: TFile,
		type: ShelfSection
	): HTMLElement {
		const metaEl = doc.createElement('div');
		metaEl.setCssProps({
			"font-size": "11px",
			color: "var(--text-faint)",
			display: "flex",
			gap: "12px"
		});

		const unit = toReadingUnit(book.readingUnit);
		const finishedDate = dayOf(book.readFinished) ?? book.readFinished;

		if (type === 'finished' && finishedDate) {
			const finishedEl = doc.createElement('span');
			finishedEl.textContent = `Finished: ${finishedDate}`;
			metaEl.appendChild(finishedEl);
		} else if (type !== 'finished') {
			const createdEl = doc.createElement('span');
			createdEl.textContent = `Added: ${formatDate(new Date(file.stat.ctime))}`;
			metaEl.appendChild(createdEl);
		}

		if (type === 'abandoned' && book.readPage) {
			const stoppedEl = doc.createElement('span');
			stoppedEl.textContent = `Stopped at ${formatPosition(book.readPage, unit)}`;
			metaEl.appendChild(stoppedEl);
		}

		if (book.rating !== undefined && book.rating > 0) {
			const ratingEl = doc.createElement('span');
			ratingEl.textContent = '★'.repeat(book.rating);
			metaEl.appendChild(ratingEl);
		}

		if (book.totalPages) {
			const pagesEl = doc.createElement('span');
			pagesEl.textContent = formatAmount(book.totalPages, unit);
			metaEl.appendChild(pagesEl);
		}

		return metaEl;
	}

	private renderEmptyState(container: HTMLElement): void {
		const doc = container.ownerDocument;
		const emptyState = doc.createElement('div');
		emptyState.className = 'reading-tracker-empty-state';
		emptyState.setCssProps({
			display: "flex",
			"flex-direction": "column",
			"align-items": "center",
			"justify-content": "center",
			padding: "40px 20px",
			"text-align": "center"
		});

		const icon = doc.createElement('div');
		icon.className = 'reading-tracker-empty-icon';
		icon.textContent = '📚';
		icon.setCssProps({
			"font-size": "3em",
			"margin-bottom": "12px"
		});
		emptyState.appendChild(icon);

		const title = doc.createElement('div');
		title.textContent = 'No books';
		title.setCssProps({
			margin: "0",
			"font-size": "1.1em",
			color: "var(--text-muted)"
		});
		emptyState.appendChild(title);

		container.appendChild(emptyState);
	}
}

