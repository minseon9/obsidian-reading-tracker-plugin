/**
 * Statistic Card Component
 * Displays a single statistic with label and value
 */
export class StatCard {
	/**
	 * Create a stat card element
	 */
	static create(
		_doc: Document,
		label: string,
		value: string | number,
		color: string
	): HTMLElement {
		const cardEl = createDiv({ cls: 'reading-tracker-stat-card' });

		cardEl.createDiv({
			cls: 'reading-tracker-stat-label',
			text: label,
		});

		const valueEl = cardEl.createDiv({
			cls: 'reading-tracker-stat-value',
			text: value.toString(),
		});
		valueEl.setCssProps({ color });

		return cardEl;
	}

	/**
	 * Create a detailed stat card with description
	 */
	static createDetailed(
		_doc: Document,
		title: string,
		description: string,
		value: string | number,
		color: string
	): HTMLElement {
		const cardEl = createDiv({ cls: 'reading-tracker-stat-card' });

		cardEl.createDiv({
			cls: 'reading-tracker-stat-title',
			text: title,
		});

		cardEl.createDiv({
			cls: 'reading-tracker-stat-desc',
			text: description,
		});

		const valueEl = cardEl.createDiv({
			cls: 'reading-tracker-stat-value',
			text: value.toString(),
		});
		valueEl.setCssProps({ color });

		return cardEl;
	}
}
