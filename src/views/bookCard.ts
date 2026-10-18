import { App, TFile, setIcon } from 'obsidian';
import { Book, formatSeriesLabel } from '../models/book';
import { BookWithReadingHistory } from '../models/bookWithReadingHistory';
import {
	ReadingUnit,
	calculateProgressPercent,
	effectiveTotal,
	formatAmount,
	formatPosition,
	toReadingUnit,
} from '../models/readingUnit';
import { dayOf, formatDurationMinutes } from '../utils/dateUtils';
import ReadingTrackerPlugin from '../main';
import { RecordSessionModal } from './recordSessionModal';

type BookCardModel = Book & Partial<Pick<BookWithReadingHistory, 'lastReadDate' | 'sessionCount' | 'minutesRead' | 'quoteCount'>>;

/**
 * Compact desktop card for a book currently being read on the shelf.
 */
export class BookCard {
	private app: App;
	private book: BookCardModel;
	private file: TFile | null;
	private plugin: ReadingTrackerPlugin | null;

	constructor(app: App, book: BookCardModel, file: TFile | null = null, plugin?: ReadingTrackerPlugin) {
		this.app = app;
		this.book = book;
		this.file = file;
		this.plugin = plugin || null;
	}

	render(): HTMLElement {
		const card = document.createElement('div');
		card.className = 'reading-tracker-book-card reading-tracker-book-reading';

		const bodyRow = card.createEl('div', { cls: 'reading-tracker-card-body' });
		this.renderCover(bodyRow);

		const infoContainer = bodyRow.createEl('div', {
			cls: 'reading-tracker-book-info',
		});

		this.renderHeader(infoContainer);
		this.renderProgressSection(infoContainer);
		this.renderReadingMeta(infoContainer);
		this.renderActions(infoContainer);

		this.attachCardOpenHandler(card);

		return card;
	}

	private renderCover(parent: HTMLElement): void {
		const coverContainer = parent.createEl('div', {
			cls: 'reading-tracker-book-cover',
		});

		if (this.book.coverUrl) {
			const coverImg = coverContainer.createEl('img', {
				attr: {
					src: this.book.coverUrl,
					alt: this.book.title || 'Book cover',
				},
			});
			coverImg.addEventListener('error', () => {
				coverImg.remove();
				this.renderCoverPlaceholder(coverContainer);
			});
		} else {
			this.renderCoverPlaceholder(coverContainer);
		}
	}

	private renderCoverPlaceholder(container: HTMLElement): void {
		const placeholder = container.createEl('div', {
			cls: 'reading-tracker-cover-placeholder',
		});
		const iconEl = placeholder.createEl('span', {
			cls: 'reading-tracker-cover-placeholder-icon',
		});
		setIcon(iconEl, 'book-open');
	}

	private renderHeader(infoContainer: HTMLElement): void {
		const titleRow = infoContainer.createEl('div', {
			cls: 'reading-tracker-book-title-row',
		});

		titleRow.createEl('div', {
			cls: 'reading-tracker-book-title',
			text: this.book.title,
		});

		const seriesLabel = formatSeriesLabel(this.book);
		if (seriesLabel) {
			titleRow.createEl('span', {
				cls: 'reading-tracker-series-pill',
				text: seriesLabel,
			});
		}

		if (this.book.author && this.book.author.length > 0) {
			infoContainer.createEl('div', {
				cls: 'reading-tracker-book-author',
				text: this.book.author.join(', '),
			});
		}
	}

	private renderProgressSection(infoContainer: HTMLElement): void {
		const unit: ReadingUnit = toReadingUnit(this.book.readingUnit);
		const total = effectiveTotal(this.book.totalPages, unit);
		const current = this.book.readPage ?? 0;
		const progress = calculateProgressPercent(current, total, unit);

		const progressContainer = infoContainer.createEl('div', {
			cls: 'reading-tracker-progress-container',
		});

		if (total === undefined || progress === null) {
			const fallbackText = current > 0
				? `Position: ${formatAmount(current, unit)} · Set total in properties for %`
				: 'Set total in note properties to track progress';
			progressContainer.createEl('div', {
				cls: 'reading-tracker-no-total-hint',
				text: fallbackText,
			});
			return;
		}

		const remaining = Math.max(0, total - current);
		const progressHeader = progressContainer.createEl('div', {
			cls: 'reading-tracker-progress-header',
		});

		progressHeader.createEl('span', {
			cls: 'reading-tracker-progress-position',
			text: `${formatPosition(current, unit)} / ${formatAmount(total, unit)}`,
		});

		progressHeader.createEl('span', {
			cls: 'reading-tracker-progress-percent',
			text: `${Math.round(progress)}%`,
		});

		const progressBar = progressContainer.createEl('div', {
			cls: 'reading-tracker-progress-bar',
		});

		const progressFill = progressBar.createEl('div', {
			cls: 'reading-tracker-progress-fill',
		});
		progressFill.setCssProps({ width: `${progress}%` });

		const progressSub = progressContainer.createEl('div', {
			cls: 'reading-tracker-progress-sub',
			text: remaining > 0 ? `${formatAmount(remaining, unit)} left` : 'Completed',
		});
		void progressSub;
	}

	private renderReadingMeta(infoContainer: HTMLElement): void {
		const metaRow = infoContainer.createEl('div', {
			cls: 'reading-tracker-card-meta',
		});

		const startedDate = dayOf(this.book.readStarted);
		if (this.book.lastReadDate) {
			metaRow.createEl('span', {
				cls: 'reading-tracker-meta-item is-accent',
				text: `Last read ${this.book.lastReadDate}`,
			});
		} else if (startedDate) {
			metaRow.createEl('span', {
				cls: 'reading-tracker-meta-item',
				text: `Started ${startedDate}`,
			});
		}

		const sessions = this.book.sessionCount ?? 0;
		if (sessions > 0) {
			metaRow.createEl('span', {
				cls: 'reading-tracker-meta-item',
				text: `${sessions} ${sessions === 1 ? 'sitting' : 'sittings'}`,
			});
		}

		const minutes = this.book.minutesRead ?? 0;
		if (minutes > 0) {
			metaRow.createEl('span', {
				cls: 'reading-tracker-meta-item',
				text: formatDurationMinutes(minutes),
			});
		}

		const quotes = this.book.quoteCount ?? 0;
		if (quotes > 0) {
			metaRow.createEl('span', {
				cls: 'reading-tracker-meta-item',
				text: `${quotes} ${quotes === 1 ? 'passage' : 'passages'}`,
			});
		}
	}

	private renderActions(infoContainer: HTMLElement): void {
		if (!this.plugin || !this.file) {
			return;
		}

		const plugin = this.plugin;
		const file = this.file;
		const buttonContainer = infoContainer.createEl('div', {
			cls: 'reading-tracker-card-actions',
		});

		const recordButton = buttonContainer.createEl('button', {
			cls: 'mod-cta reading-tracker-record-button',
			text: 'Record reading',
		});

		recordButton.addEventListener('click', (e) => {
			e.stopPropagation();
			new RecordSessionModal(this.app, plugin, file).open();
		});
	}

	private attachCardOpenHandler(card: HTMLElement): void {
		if (!this.file) {
			return;
		}
		const file = this.file;
		card.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).closest('button')) {
				return;
			}
			void this.app.workspace.openLinkText(file.path, '', false);
		});
	}
}
