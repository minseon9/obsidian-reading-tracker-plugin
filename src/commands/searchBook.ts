import { App } from 'obsidian';
import { SearchModal } from '../views/bookSearchModal';
import ReadingTrackerPlugin from '../main';

/**
 * Search book command
 */
export function registerSearchBookCommand(app: App, plugin: ReadingTrackerPlugin): void {
	plugin.addCommand({
		id: 'search-book',
		name: 'Search book',
		callback: () => {
			const modal = new SearchModal(app, plugin);
			modal.open();
		},
	});
}
