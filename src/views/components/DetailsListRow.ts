/**
 * Details List Row Component
 * Single row for time-based stats (year/month label, books/pages, reading days)
 */
export class DetailsListRow {
	static create(
		_doc: Document,
		options: {
			label: string;
			rightPrimary: string;
			rightSecondary: string;
		}
	): HTMLElement {
		const item = createDiv({ cls: 'reading-tracker-details-row' });

		item.createSpan({
			cls: 'reading-tracker-details-label',
			text: options.label,
		});

		const rightContainer = item.createDiv({
			cls: 'reading-tracker-details-right',
		});

		rightContainer.createSpan({
			cls: 'reading-tracker-details-primary',
			text: options.rightPrimary,
		});

		rightContainer.createSpan({
			cls: 'reading-tracker-details-secondary',
			text: options.rightSecondary,
		});

		return item;
	}
}
