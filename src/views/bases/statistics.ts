import { TFile } from 'obsidian';
import { BookWithReadingHistory } from '../../models/bookWithReadingHistory';
import { formatDurationMinutes, formatMonthLabel } from '../../utils/dateUtils';
import {
	BookStatistics,
	PeriodStatisticEntry,
	PeriodStatistics,
	ReadingStatisticsCalculator,
} from '../../services/statisticsService/readingStatisticsCalculator';
import { BasesViewBase } from './base';
import ReadingTrackerPlugin from '../../main';
import { StatCard } from '../components/StatCard';
import { SectionHeader } from '../components/SectionHeader';
import { ChartRenderer } from '../components/ChartRenderer';
import { ChartPanel } from '../components/ChartPanel';
import { ToggleButtonGroup } from '../components/ToggleButtonGroup';
import { DetailsListRow } from '../components/DetailsListRow';

interface PeriodRenderConfig {
	keys: string[];
	stats: PeriodStatistics;
	xAxisLabel: 'Year' | 'Month';
	titles: readonly [string, string, string];
	formatLabel: (key: string) => string;
}

/**
 * Statistics View - Displays reading statistics and graphs
 */
export class StatisticsBasesView extends BasesViewBase {
	type = "reading-tracker-statistics";

	private books: Array<{ book: BookWithReadingHistory; file: TFile }> = [];
	private stats: BookStatistics | null = null;

	constructor(controller: unknown, containerEl: HTMLElement, plugin: ReadingTrackerPlugin) {
		super(controller, containerEl, plugin);
	}

	async render(): Promise<void> {
		if (!this.rootElement || !this.data?.data) return;

		try {
			const dataItems = this.extractDataItems();
			this.books = await this.extractBooksFromBasesData(dataItems);
			this.stats = ReadingStatisticsCalculator.calculate(
				this.books.map(({ book }) => book)
			);

			this.rootElement.empty();
			this.renderContent();
		} catch (error) {
			console.error('[Reading Tracker][StatisticsView] Render error:', error);
			this.renderError(error as Error);
		}
	}

	private renderContent(): void {
		if (!this.rootElement || !this.stats) return;

		const doc = this.rootElement.ownerDocument;
		const container = doc.createElement('div');
		container.setCssProps({
			padding: "20px",
			"overflow-y": "auto",
			height: "100%"
		});

		const title = doc.createElement('h1');
		title.textContent = 'Reading statistics';
		title.setCssProps({
			margin: "0 0 32px 0",
			"font-size": "1.8em"
		});
		container.appendChild(title);

		this.renderActivitySection(container, doc, this.stats);
		this.renderOverallSection(container, doc, this.stats);
		this.renderTimeBasedSection(container, doc, this.stats);
		this.renderCategorySection(container, doc, this.stats);

		this.rootElement.appendChild(container);
	}

	private renderActivitySection(
		container: HTMLElement,
		doc: Document,
		stats: BookStatistics
	): void {
		const section = doc.createElement('div');
		section.setCssProps({ "margin-bottom": "40px" });

		section.appendChild(SectionHeader.create(doc, 'Reading activity (last 52 weeks)'));

		const heatmapCard = doc.createElement('div');
		heatmapCard.className = 'reading-tracker-heatmap-card';
		ChartRenderer.renderActivityHeatmap(heatmapCard, doc, stats.dailyActivity);
		section.appendChild(heatmapCard);

		container.appendChild(section);
	}

	private renderOverallSection(
		container: HTMLElement,
		doc: Document,
		stats: BookStatistics
	): void {
		const section = doc.createElement('div');
		section.setCssProps({ "margin-bottom": "40px" });

		section.appendChild(SectionHeader.create(doc, 'Overview'));

		const cardsGrid = doc.createElement('div');
		cardsGrid.setCssProps({
			display: "grid",
			"grid-template-columns": "repeat(auto-fit, minmax(200px, 1fr))",
			gap: "16px",
			"margin-bottom": "16px"
		});

		const cards = [
			{ label: 'Finished books', value: stats.finished, color: 'var(--interactive-success)' },
			{ label: 'Reading days', value: stats.totalReadingDays, color: 'var(--text-accent)' },
			{
				label: 'Current streak',
				value: `${stats.currentStreak} ${stats.currentStreak === 1 ? 'day' : 'days'}`,
				color: 'var(--interactive-accent)',
			},
			{
				label: 'Longest streak',
				value: `${stats.longestStreak} ${stats.longestStreak === 1 ? 'day' : 'days'}`,
				color: 'var(--text-normal)',
			},
			{ label: 'Sittings recorded', value: stats.totalSessions, color: 'var(--interactive-accent)' },
			{ label: 'Passages copied', value: stats.totalQuotes, color: 'var(--text-accent)' },
			{ label: 'Pages read', value: stats.readPages.toLocaleString(), color: 'var(--interactive-accent)' },
			{
				label: 'Time spent reading',
				value: formatDurationMinutes(stats.totalMinutes),
				color: 'var(--interactive-accent)',
			},
			{
				label: 'Average rating',
				value: stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)} ★` : '-',
				color: 'var(--text-accent)',
			},
		];

		for (const card of cards) {
			cardsGrid.appendChild(StatCard.create(doc, card.label, card.value, card.color));
		}

		section.appendChild(cardsGrid);

		const avgValue = stats.averageTimeToFinish > 0
			? `${stats.averageTimeToFinish} ${stats.averageTimeToFinish === 1 ? 'day' : 'days'}`
			: 'No data yet';

		const avgTimeEl = StatCard.createDetailed(
			doc,
			'Average reading days per finished book',
			'Days you actually read on, averaged across finished books',
			avgValue,
			'var(--interactive-accent)'
		);
		section.appendChild(avgTimeEl);

		container.appendChild(section);
	}

	private renderTimeBasedSection(
		container: HTMLElement,
		doc: Document,
		stats: BookStatistics
	): void {
		const section = doc.createElement('div');
		section.setCssProps({ "margin-bottom": "40px" });

		const headerContainer = doc.createElement('div');
		headerContainer.setCssProps({
			display: "flex",
			"justify-content": "space-between",
			"align-items": "center",
			"margin-bottom": "16px",
			"padding-bottom": "8px",
			"border-bottom": "2px solid var(--background-modifier-border)"
		});

		const header = doc.createElement('h2');
		header.textContent = 'Time-based statistics';
		header.setCssProps({
			margin: "0",
			"font-size": "1.4em"
		});
		headerContainer.appendChild(header);

		const { container: toggleContainer, yearButton, monthButton, setActive } =
			ToggleButtonGroup.create(doc, 'Yearly', 'Monthly');
		headerContainer.appendChild(toggleContainer);
		section.appendChild(headerContainer);

		const contentContainer = doc.createElement('div');
		contentContainer.setCssProps({ position: "relative" });

		const yearlyConfig: PeriodRenderConfig = {
			keys: Object.keys(stats.yearlyStats).sort().reverse(),
			stats: stats.yearlyStats,
			xAxisLabel: 'Year',
			titles: ['Finished Books', 'Pages Read', 'Reading Days'],
			formatLabel: (year) => year,
		};

		const monthlyConfig: PeriodRenderConfig = {
			keys: Object.keys(stats.monthlyStats).sort().reverse().slice(0, 12),
			stats: stats.monthlyStats,
			xAxisLabel: 'Month',
			titles: ['Finished Books (Last 12)', 'Pages Read (Last 12)', 'Reading Days (Last 12)'],
			formatLabel: formatMonthLabel,
		};

		this.renderPeriodContent(contentContainer, doc, yearlyConfig);

		yearButton.addEventListener('click', () => {
			setActive('year');
			contentContainer.empty();
			this.renderPeriodContent(contentContainer, doc, yearlyConfig);
		});

		monthButton.addEventListener('click', () => {
			setActive('month');
			contentContainer.empty();
			this.renderPeriodContent(contentContainer, doc, monthlyConfig);
		});

		section.appendChild(contentContainer);
		container.appendChild(section);
	}

	private renderPeriodContent(
		container: HTMLElement,
		doc: Document,
		config: PeriodRenderConfig
	): void {
		const { keys, stats, xAxisLabel, titles, formatLabel } = config;
		const chartsGrid = doc.createElement('div');
		chartsGrid.setCssProps({
			display: "grid",
			"grid-template-columns": "repeat(auto-fit, minmax(300px, 1fr))",
			gap: "16px",
			"margin-bottom": "16px"
		});

		if (keys.length === 0) {
			for (const title of titles) {
				const { container: panelContainer, chartEl } = ChartPanel.create(doc, title);
				ChartRenderer.renderEmptyChart(chartEl, doc, xAxisLabel);
				chartsGrid.appendChild(panelContainer);
			}
			container.appendChild(chartsGrid);
			return;
		}

		const booksPanel = ChartPanel.create(doc, titles[0]);
		ChartRenderer.renderLineChart(
			booksPanel.chartEl,
			doc,
			keys.map((key) => ({
				label: formatLabel(key),
				value: stats[key]?.count ?? 0,
			})),
			xAxisLabel
		);
		chartsGrid.appendChild(booksPanel.container);

		const pagesPanel = ChartPanel.create(doc, titles[1]);
		ChartRenderer.renderLineChart(
			pagesPanel.chartEl,
			doc,
			keys.map((key) => ({
				label: formatLabel(key),
				value: stats[key]?.pages ?? 0,
			})),
			xAxisLabel
		);
		chartsGrid.appendChild(pagesPanel.container);

		const daysPanel = ChartPanel.create(doc, titles[2]);
		ChartRenderer.renderLineChart(
			daysPanel.chartEl,
			doc,
			keys.map((key) => ({
				label: formatLabel(key),
				value: stats[key]?.readingDays ?? 0,
			})),
			xAxisLabel
		);
		chartsGrid.appendChild(daysPanel.container);

		container.appendChild(chartsGrid);

		const { container: listContainer, listEl } = ChartPanel.createDetailsPanel(doc, 'Details');
		for (const key of keys) {
			const stat = stats[key];
			if (!stat) continue;
			listEl.appendChild(this.createPeriodDetailsRow(doc, formatLabel(key), stat));
		}
		container.appendChild(listContainer);
	}

	private createPeriodDetailsRow(
		doc: Document,
		label: string,
		stat: PeriodStatisticEntry
	): HTMLElement {
		return DetailsListRow.create(doc, {
			label,
			rightPrimary: `${stat.count} ${stat.count === 1 ? 'book' : 'books'} · ${stat.pages.toLocaleString()} pages`,
			rightSecondary: `${stat.readingDays} reading ${stat.readingDays === 1 ? 'day' : 'days'} · ${stat.averageTimeToFinish}d avg per book`,
		});
	}

	private renderCategorySection(
		container: HTMLElement,
		doc: Document,
		stats: BookStatistics
	): void {
		const section = doc.createElement('div');
		section.setCssProps({ "margin-bottom": "40px" });

		section.appendChild(SectionHeader.create(doc, 'Category Statistics'));

		const categories = Object.entries(stats.categoryCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10);

		const chartPanel = ChartPanel.create(doc, 'Books by Category (Top 10)');
		chartPanel.container.setCssProps({ "max-width": "600px" });

		ChartRenderer.renderBarChart(
			chartPanel.chartEl,
			doc,
			categories.map(([category, count]) => ({
				label: category,
				value: count,
			}))
		);

		section.appendChild(chartPanel.container);
		container.appendChild(section);
	}
}

