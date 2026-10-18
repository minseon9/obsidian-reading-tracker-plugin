import ReadingTrackerPlugin from '../main';

/** Open the reading shelf view. */
export function registerOpenShelfCommand(plugin: ReadingTrackerPlugin): void {
	plugin.addCommand({
		id: 'open-shelf',
		name: 'Open shelf',
		callback: () => {
			void plugin.openShelf();
		},
	});
}
