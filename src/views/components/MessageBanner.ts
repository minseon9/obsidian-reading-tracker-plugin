/**
 * Reusable dismissible error and success message banners for modals.
 */
export class MessageBanner {
	static showError(containerEl: HTMLElement, message: string): void {
		MessageBanner.clearError(containerEl);

		const messageContainer = containerEl.createDiv({
			cls: 'reading-tracker-message reading-tracker-message-error',
		});

		messageContainer.createDiv({ cls: 'reading-tracker-message-icon', text: '!' });
		messageContainer.createDiv({ cls: 'reading-tracker-message-text', text: message });

		const closeButton = messageContainer.createEl('button', {
			cls: 'reading-tracker-message-close',
			text: 'Dismiss',
		});
		closeButton.addEventListener('click', () => messageContainer.remove());
	}

	static clearError(containerEl: HTMLElement): void {
		containerEl.querySelector('.reading-tracker-message')?.remove();
	}

	static showSuccess(containerEl: HTMLElement, message: string): void {
		containerEl.querySelector('.reading-tracker-message-success')?.remove();

		const messageContainer = containerEl.createDiv({
			cls: 'reading-tracker-message-success',
		});
		messageContainer.createSpan({ text: message });
	}
}
