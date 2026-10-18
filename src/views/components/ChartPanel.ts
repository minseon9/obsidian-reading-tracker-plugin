/**
 * Chart Panel Component
 * Wraps a chart with consistent padding, background and title
 */
export class ChartPanel {
	/**
	 * Create a chart panel: container with title and a child div for the chart
	 */
	static create(
		_doc: Document,
		title: string
	): { container: HTMLElement; chartEl: HTMLElement } {
		const container = createDiv({ cls: 'reading-tracker-chart-panel' });

		container.createEl('h3', {
			cls: 'reading-tracker-chart-panel-title',
			text: title,
		});

		const chartEl = container.createDiv({ cls: 'reading-tracker-chart-panel-body' });

		return { container, chartEl };
	}

	/**
	 * Create a details list panel with title
	 */
	static createDetailsPanel(
		_doc: Document,
		title: string
	): { container: HTMLElement; listEl: HTMLElement } {
		const container = createDiv({ cls: 'reading-tracker-chart-panel' });

		container.createEl('h3', {
			cls: 'reading-tracker-chart-panel-title',
			text: title,
		});

		const listEl = container.createDiv();

		return { container, listEl };
	}
}
