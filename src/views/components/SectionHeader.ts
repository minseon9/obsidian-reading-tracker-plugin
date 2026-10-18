import { setIcon } from 'obsidian';

/**
 * Section Header Component
 * Creates consistent section headers with optional toggle functionality
 */
export class SectionHeader {
	/**
	 * Create a simple section header
	 */
	static create(doc: Document, text: string): HTMLElement {
		const header = doc.createElement('h2');
		header.textContent = text;
		header.setCssProps({
			margin: "0 0 16px 0",
			"font-size": "1.4em",
			"padding-bottom": "8px",
			"border-bottom": "2px solid var(--background-modifier-border)"
		});
		return header;
	}

	/**
	 * Create a toggleable section header
	 */
	static createToggleable(
		doc: Document,
		text: string,
		onToggle: (isExpanded: boolean) => void
	): { header: HTMLElement; isExpanded: boolean } {
		let isExpanded = true;

		const header = doc.createElement('div');
		header.setCssProps({
			display: "flex",
			"align-items": "center",
			"justify-content": "space-between",
			cursor: "pointer",
			margin: "0 0 16px 0",
			"padding-bottom": "8px",
			"border-bottom": "2px solid var(--background-modifier-border)"
		});

		const titleEl = doc.createElement('h2');
		titleEl.textContent = text;
		titleEl.setCssProps({
			margin: "0",
			"font-size": "1.4em"
		});

		const chevron = doc.createElement('span');
		setIcon(chevron, 'chevron-down');
		chevron.setCssProps({
			display: "inline-flex",
			"align-items": "center",
			color: "var(--text-muted)",
			transition: "transform 0.2s"
		});

		header.appendChild(titleEl);
		header.appendChild(chevron);

		header.addEventListener('click', () => {
			isExpanded = !isExpanded;
			chevron.setCssProps({
				transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)"
			});
			onToggle(isExpanded);
		});

		return { header, isExpanded };
	}
}
