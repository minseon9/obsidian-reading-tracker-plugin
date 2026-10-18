/**
 * Toggle Button Group Component
 * Two-button toggle (e.g. Yearly / Monthly)
 */
export class ToggleButtonGroup {
	/**
	 * Create a two-option toggle. Returns { container, yearButton, monthButton }.
	 * Call setActive('year'|'month') to update styles.
	 */
	static create(
		_doc: Document,
		yearLabel: string,
		monthLabel: string
	): {
		container: HTMLElement;
		yearButton: HTMLButtonElement;
		monthButton: HTMLButtonElement;
		setActive: (which: 'year' | 'month') => void;
	} {
		const container = createDiv({
			cls: 'reading-tracker-toggle-group',
		});

		const yearButton = container.createEl('button', {
			cls: 'reading-tracker-toggle-btn is-active',
			text: yearLabel,
		});

		const monthButton = container.createEl('button', {
			cls: 'reading-tracker-toggle-btn',
			text: monthLabel,
		});

		const setActive = (which: 'year' | 'month') => {
			yearButton.classList.toggle('is-active', which === 'year');
			monthButton.classList.toggle('is-active', which === 'month');
		};

		return { container, yearButton, monthButton, setActive };
	}
}
