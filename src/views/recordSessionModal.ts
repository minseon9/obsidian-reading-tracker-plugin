import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import { Book } from '../models/book';
import { bookStatusLabel } from '../models/bookStatus';
import { QuoteDraft, SessionDraft, sessionAmount } from '../models/readingSession';
import {
	ReadingUnit,
	calculateProgressPercent,
	effectiveTotal,
	formatAmount,
	formatPosition,
	parsePosition,
	positionPlaceholder,
	readingUnitLabel,
	toReadingUnit,
} from '../models/readingUnit';
import { BookFileReader } from '../services/bookFileService/bookFileReader';
import { BookFileUpdater } from '../services/bookFileService/bookFileUpdater';
import { NoteAccess } from '../services/frontmatterService/noteAccess';
import { formatDate } from '../utils/dateUtils';
import { MessageBanner } from './components/MessageBanner';
import ReadingTrackerPlugin from '../main';

interface QuoteRowElements {
	root: HTMLElement;
	text: HTMLTextAreaElement;
	page: HTMLInputElement;
	line: HTMLInputElement;
}

type SessionOutcome = 'reading' | 'finished' | 'abandoned';

/**
 * Records one sitting with a book: date, positions, duration, copied passages,
 * and reflections.
 *
 * Every sitting becomes a note of its own, which opens once it is written.
 */
export class RecordSessionModal extends Modal {
	private plugin: ReadingTrackerPlugin;
	private bookFileReader: BookFileReader;
	private bookFileUpdater: BookFileUpdater;
	private availableBooks: Array<{ book: Book; file: TFile }> = [];
	private showBookSelector = false;
	private book: Book | null = null;
	private file: TFile | null;
	private unit: ReadingUnit = 'pages';

	private dateInput: HTMLInputElement | null = null;
	private fromInput: HTMLInputElement | null = null;
	private toInput: HTMLInputElement | null = null;
	private minutesInput: HTMLInputElement | null = null;
	private outcomeSelect: HTMLSelectElement | null = null;
	private quotesContainer: HTMLElement | null = null;
	/** One entry per passage row on screen, read back when the dialog is saved. */
	private quoteRows: QuoteRowElements[] = [];
	private thoughtsInput: HTMLTextAreaElement | null = null;
	private amountDisplay: HTMLElement | null = null;
	private progressDisplay: HTMLElement | null = null;
	private rating: number | null = null;
	private ratingTouched = false;
	private outcome: SessionOutcome = 'reading';
	private outcomeTouched = false;

	constructor(app: App, plugin: ReadingTrackerPlugin, file?: TFile) {
		super(app);
		this.plugin = plugin;
		this.bookFileReader = new BookFileReader(app);
		this.bookFileUpdater = new BookFileUpdater(app, plugin.settings);
		const candidate = file ?? this.app.workspace.getActiveFile();
		this.file = candidate && this.plugin.isBookNote(candidate) ? candidate : null;
	}

	onOpen() {
		this.modalEl.addClass('reading-tracker-session-modal');
		this.setTitle('Record reading');
		this.contentEl.empty();
		void this.load();
	}

	onClose() {
		this.contentEl.empty();
	}

	private async load(): Promise<void> {
		if (!this.file) {
			this.availableBooks = this.bookFileReader.listBooksInFolder(this.plugin.settings.bookFolder);
			this.showBookSelector = this.availableBooks.length > 0;
			this.file = this.availableBooks[0]?.file ?? null;
		}

		if (!this.file) {
			this.renderMissingBook();
			return;
		}

		await this.loadSelectedBook(this.file);
	}

	private async loadSelectedBook(file: TFile): Promise<void> {
		let lastPosition = 0;
		try {
			const { book, frontmatter } = this.bookFileReader.readWithFrontmatter(file);
			if (!book.title) {
				this.renderMissingBook();
				return;
			}
			this.file = file;
			this.book = book as Book;
			this.unit = toReadingUnit(book.readingUnit);
			this.rating = book.rating ?? null;
			this.ratingTouched = false;
			this.outcome = book.status === 'finished' ? 'finished' : 'reading';
			this.outcomeTouched = false;

			const body = await NoteAccess.body(this.app, file);
			lastPosition = BookFileUpdater.lastPosition(
				frontmatter,
				body,
				this.plugin.settings.readingHistoryHeading
			);
		} catch (error) {
			console.error('[Reading Tracker] Failed to load book note:', error);
			this.renderMissingBook();
			return;
		}

		this.renderForm(lastPosition);
	}

	private renderMissingBook(): void {
		this.contentEl.empty();
		this.contentEl.createDiv({
			cls: 'reading-tracker-error',
			text: 'No books found in your vault yet. Search and add a book first.',
		});
	}

	private renderForm(lastPosition: number): void {
		const book = this.book;
		const container = this.contentEl;
		if (!book) return;

		container.empty();

		this.renderBookHeader(container, book);
		this.renderMetricsGrid(container, Math.max(lastPosition, book.readPage ?? 0));
		this.renderProgressSummary(container, book);
		this.renderPassagesSection(container);
		this.renderThoughtsSection(container);
		this.renderOutcomeAndRatingRow(container);
		this.renderSubmitButton(container);

		this.updateCalculations();
		this.toInput?.focus();
		this.toInput?.select();
	}

	private renderBookHeader(container: HTMLElement, book: Book): void {
		if (this.showBookSelector && this.availableBooks.length > 0) {
			new Setting(container)
				.setName('Book')
				.setDesc('Choose which book this sitting belongs to')
				.addDropdown((dropdown) => {
					for (const item of this.availableBooks) {
						const statusBadge = bookStatusLabel(item.book.status);
						dropdown.addOption(item.file.path, `${item.book.title} (${statusBadge})`);
					}
					if (this.file) {
						dropdown.setValue(this.file.path);
					}
					dropdown.onChange((path) => {
						const selected = this.availableBooks.find((item) => item.file.path === path);
						if (selected) {
							void this.loadSelectedBook(selected.file);
						}
					});
				});
		}

		const bookInfo = container.createDiv({ cls: 'reading-tracker-progress-book-info' });
		bookInfo.createDiv({ cls: 'reading-tracker-progress-title', text: book.title });
		if (book.author && book.author.length > 0) {
			bookInfo.createDiv({
				cls: 'reading-tracker-progress-author',
				text: `by ${book.author.join(', ')}`,
			});
		}
	}

	private renderMetricsGrid(container: HTMLElement, initialPosition: number): void {
		const unitName = readingUnitLabel(this.unit).toLowerCase();
		const initialValue = formatPosition(initialPosition, this.unit);
		const placeholder = positionPlaceholder(this.unit);

		const grid = container.createDiv({ cls: 'reading-tracker-session-metrics-grid' });

		const dateField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		dateField.createSpan({ cls: 'reading-tracker-metric-label', text: 'Date' });
		this.dateInput = dateField.createEl('input', {
			cls: 'reading-tracker-metric-input',
			type: 'date',
		});
		this.dateInput.value = formatDate();

		const fromField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		fromField.createSpan({
			cls: 'reading-tracker-metric-label',
			text: `From (${unitName})`,
		});
		this.fromInput = fromField.createEl('input', {
			cls: 'reading-tracker-metric-input',
			type: 'text',
			placeholder,
		});
		this.fromInput.value = initialValue;
		this.fromInput.addEventListener('input', () => this.updateCalculations());

		const toField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		toField.createSpan({
			cls: 'reading-tracker-metric-label',
			text: `To (${unitName})`,
		});
		this.toInput = toField.createEl('input', {
			cls: 'reading-tracker-metric-input',
			type: 'text',
			placeholder,
		});
		this.toInput.value = initialValue;
		this.toInput.addEventListener('input', () => this.updateCalculations());

		const minutesField = grid.createEl('label', { cls: 'reading-tracker-metric-field' });
		minutesField.createSpan({
			cls: 'reading-tracker-metric-label',
			text: 'Minutes (optional)',
		});
		this.minutesInput = minutesField.createEl('input', {
			cls: 'reading-tracker-metric-input',
			type: 'number',
			placeholder: '45',
		});
		this.minutesInput.min = '0';
	}

	private renderProgressSummary(container: HTMLElement, book: Book): void {
		const summaryBar = container.createDiv({ cls: 'reading-tracker-progress-summary-bar' });

		const amountGroup = summaryBar.createDiv({ cls: 'reading-tracker-progress-calc' });
		amountGroup.createSpan({ cls: 'reading-tracker-progress-label', text: 'This sitting:' });
		this.amountDisplay = amountGroup.createSpan({
			cls: 'reading-tracker-progress-value',
			text: '-',
		});

		const total = effectiveTotal(book.totalPages, this.unit);
		if (total !== undefined) {
			const progressGroup = summaryBar.createDiv({ cls: 'reading-tracker-progress-calc' });
			progressGroup.createSpan({ cls: 'reading-tracker-progress-label', text: 'Progress:' });
			this.progressDisplay = progressGroup.createSpan({
				cls: 'reading-tracker-progress-value',
				text: '0%',
			});
		} else {
			this.progressDisplay = null;
		}
	}

	private renderPassagesSection(container: HTMLElement): void {
		new Setting(container)
			.setName('Passages')
			.setDesc('Sentences you copied out, each with its page and line')
			.addButton((button) => {
				button.setButtonText('Add passage');
				button.onClick(() => this.addQuoteRow(true));
			});

		this.quotesContainer = container.createDiv({ cls: 'reading-tracker-quotes' });
		this.quoteRows = [];
		this.addQuoteRow(false);
	}

	private renderThoughtsSection(container: HTMLElement): void {
		const thoughtsSection = container.createDiv({ cls: 'reading-tracker-thoughts-section' });
		const header = thoughtsSection.createDiv({ cls: 'reading-tracker-thoughts-header' });
		header.createDiv({ cls: 'setting-item-name', text: 'Thoughts' });
		header.createDiv({
			cls: 'setting-item-description',
			text: 'What you made of it. The session note opens after saving so you can keep writing.',
		});

		this.thoughtsInput = thoughtsSection.createEl('textarea', {
			cls: 'reading-tracker-notes-input',
		});
		this.thoughtsInput.placeholder = 'Write your reflections from this sitting...';
	}

	private renderOutcomeAndRatingRow(container: HTMLElement): void {
		const footerGrid = container.createDiv({ cls: 'reading-tracker-session-footer-grid' });

		const outcomeField = footerGrid.createEl('label', { cls: 'reading-tracker-metric-field' });
		outcomeField.createSpan({
			cls: 'reading-tracker-metric-label',
			text: 'Book status after sitting',
		});
		const outcomeSelect = outcomeField.createEl('select', { cls: 'dropdown' });
		outcomeSelect.createEl('option', { value: 'reading', text: 'Keep reading' });
		outcomeSelect.createEl('option', { value: 'finished', text: 'Mark as finished' });
		outcomeSelect.createEl('option', { value: 'abandoned', text: 'Mark as abandoned' });
		outcomeSelect.value = this.outcome;
		outcomeSelect.addEventListener('change', () => {
			this.outcome = outcomeSelect.value as SessionOutcome;
			this.outcomeTouched = true;
		});
		this.outcomeSelect = outcomeSelect;

		const ratingField = footerGrid.createEl('label', { cls: 'reading-tracker-metric-field' });
		ratingField.createSpan({
			cls: 'reading-tracker-metric-label',
			text: 'Rating',
		});
		const ratingSelect = ratingField.createEl('select', { cls: 'dropdown' });
		ratingSelect.createEl('option', { value: '', text: 'Not rated' });
		for (let stars = 1; stars <= 5; stars++) {
			ratingSelect.createEl('option', { value: stars.toString(), text: '★'.repeat(stars) });
		}
		ratingSelect.value = this.rating !== null ? this.rating.toString() : '';
		ratingSelect.addEventListener('change', () => {
			this.rating = ratingSelect.value === '' ? null : parseInt(ratingSelect.value, 10);
			this.ratingTouched = true;
		});
	}

	private renderSubmitButton(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: 'reading-tracker-progress-buttons' });
		const saveButton = buttonContainer.createEl('button', { cls: 'mod-cta', text: 'Record sitting' });
		saveButton.addEventListener('click', () => void this.submit());
	}

	/**
	 * Add an empty passage row. A sitting usually yields more than one, so they
	 * are added as needed rather than being a single fixed field.
	 */
	private addQuoteRow(shouldFocus = true): void {
		const container = this.quotesContainer;
		if (!container) return;

		const root = container.createDiv({ cls: 'reading-tracker-quote-row' });
		const header = root.createDiv({ cls: 'reading-tracker-quote-header' });

		const page = header.createEl('input', { cls: 'reading-tracker-citation-input' });
		page.type = 'number';
		page.min = '0';
		page.placeholder = 'Page';

		const line = header.createEl('input', { cls: 'reading-tracker-citation-input' });
		line.type = 'number';
		line.min = '0';
		line.placeholder = 'Line';

		const remove = header.createEl('button', { cls: 'reading-tracker-quote-remove', text: '✕' });
		remove.setAttr('aria-label', 'Remove this passage');
		remove.addEventListener('click', () => this.removeQuoteRow(root));

		const text = root.createEl('textarea', { cls: 'reading-tracker-notes-input' });
		text.placeholder = 'Copy the passage here...';

		this.quoteRows.push({ root, text, page, line });
		this.updateRemoveButtons();
		if (shouldFocus) {
			text.focus();
		}
	}

	private removeQuoteRow(root: HTMLElement): void {
		this.quoteRows = this.quoteRows.filter((row) => row.root !== root);
		root.remove();
		if (this.quoteRows.length === 0) {
			this.addQuoteRow(true);
		}
		this.updateRemoveButtons();
	}

	/** Removing the only row would leave nowhere to type, so hide its button. */
	private updateRemoveButtons(): void {
		const only = this.quoteRows.length === 1;
		for (const row of this.quoteRows) {
			row.root.querySelector('.reading-tracker-quote-remove')?.toggleClass('is-hidden', only);
		}
	}

	/** The passages the reader actually filled in, with their citations. */
	private readQuotes(): QuoteDraft[] {
		const quotes: QuoteDraft[] = [];

		for (const row of this.quoteRows) {
			const text = row.text.value.trim();
			if (text === '') continue;

			const page = RecordSessionModal.readNumber(row.page);
			quotes.push({
				text,
				page,
				line: page === undefined ? undefined : RecordSessionModal.readNumber(row.line),
			});
		}

		return quotes;
	}

	/** Read both position inputs, or null when either one is unusable. */
	private readPositions(): { from: number; to: number } | null {
		if (!this.fromInput || !this.toInput) return null;
		const from = parsePosition(this.fromInput.value, this.unit);
		const to = parsePosition(this.toInput.value, this.unit);
		if (from === null || to === null) return null;
		return { from, to };
	}

	private static readNumber(input: HTMLInputElement | null): number | undefined {
		const value = input?.value.trim();
		if (!value) return undefined;
		const parsed = parseInt(value, 10);
		return Number.isNaN(parsed) || parsed < 0 ? undefined : parsed;
	}

	private updateCalculations(): void {
		const positions = this.readPositions();

		if (this.amountDisplay) {
			this.amountDisplay.textContent = positions
				? formatAmount(Math.max(0, positions.to - positions.from), this.unit)
				: '-';
		}

		if (this.book) {
			const total = effectiveTotal(this.book.totalPages, this.unit);
			if (this.progressDisplay && total !== undefined) {
				const progress = positions
					? calculateProgressPercent(positions.to, total, this.unit)
					: 0;
				const rounded = Math.round(progress ?? 0);
				this.progressDisplay.textContent = positions
					? `${rounded}% (${formatPosition(positions.to, this.unit)} / ${formatPosition(total, this.unit)})`
					: `${rounded}%`;
			}

			// Auto-toggle outcome to 'finished' when reaching total, unless manually overridden
			if (!this.outcomeTouched && this.outcomeSelect && total !== undefined && positions) {
				const reachedEnd = positions.to >= total;
				this.outcome = reachedEnd ? 'finished' : 'reading';
				this.outcomeSelect.value = this.outcome;
			}
		}
	}

	private async submit(): Promise<void> {
		const file = this.file;
		if (!file || !this.book) return;

		const positions = this.readPositions();
		if (!positions) {
			MessageBanner.showError(
				this.contentEl,
				`Enter a valid position (for example ${positionPlaceholder(this.unit)}).`
			);
			return;
		}
		if (positions.to < positions.from) {
			MessageBanner.showError(
				this.contentEl,
				'The end position must not be before the start position.'
			);
			return;
		}

		const draft: SessionDraft = {
			date: this.dateInput?.value.trim() || formatDate(),
			from: positions.from,
			to: positions.to,
			minutes: RecordSessionModal.readNumber(this.minutesInput),
			quotes: this.readQuotes(),
			thoughts: this.thoughtsInput?.value.trim() || undefined,
			rating: this.ratingTouched ? this.rating : undefined,
			finished: this.outcome === 'finished',
			abandoned: this.outcome === 'abandoned',
		};

		try {
			const { session, sessionFile } = await this.bookFileUpdater.recordSession(file, draft);
			new Notice(`Recorded ${formatAmount(sessionAmount(session), this.unit)}.`);
			this.close();
			// Open the sitting's note so the reader can keep writing in it.
			await this.app.workspace.getLeaf(true).openFile(sessionFile);
		} catch (error) {
			MessageBanner.showError(
				this.contentEl,
				`Failed to record reading: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}
}
