import { Notice } from 'obsidian';
import ReadingTrackerPlugin from '../main';

/**
 * Regenerate the default `.base` view files.
 *
 * The plugin only creates these once, so a vault set up with an older version
 * keeps its original filters and would miss shelves added since — abandoned
 * books, for one. This rewrites them on request.
 */
export function registerResetViewsCommand(plugin: ReadingTrackerPlugin): void {
	plugin.addCommand({
		id: 'reset-default-views',
		name: 'Reset default views',
		callback: () => {
			void (async () => {
				try {
					const count = await plugin.ensureDefaultBaseFiles(true);
					new Notice(
						count > 0
							? `Reset ${count} default ${count === 1 ? 'view' : 'views'}.`
							: 'No default views needed resetting.'
					);
				} catch (error) {
					console.error('[Reading Tracker] Failed to reset default views:', error);
					new Notice('Failed to reset default views. See the console for details.');
				}
			})();
		},
	});
}
