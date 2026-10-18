import { setIcon } from 'obsidian';

/**
 * Section Header Component
 * Creates consistent section headers with optional toggle functionality
 */
export class SectionHeader {
	/**
	 * Create a simple section header
	 */
	static create(_doc: Document, text: string): HTMLElement {
		return createEl('h2', {
			cls: 'reading-tracker-stats-section-heading',
			text,
		});
	}

	/**
	 * Create a toggleable section header
	 */
	static createToggleable(
		_doc: Document,
		text: string,
		onToggle: (isExpanded: boolean) => void
	): { header: HTMLElement; isExpanded: boolean } {
		let isExpanded = true;

		const header = createDiv({
			cls: 'reading-tracker-toggleable-section-header',
		});

		header.createEl('h2', {
			cls: 'reading-tracker-toggleable-section-title',
			text,
		});

		const chevron = header.createSpan({
			cls: 'reading-tracker-subsection-chevron',
		});
		setIcon(chevron, 'chevron-down');

		header.addEventListener('click', () => {
			isExpanded = !isExpanded;
			chevron.classList.toggle('is-collapsed', !isExpanded);
			onToggle(isExpanded);
		});

		return { header, isExpanded };
	}
}
