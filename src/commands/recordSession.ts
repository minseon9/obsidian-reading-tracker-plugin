import { App } from 'obsidian';
import { RecordSessionModal } from '../views/recordSessionModal';
import ReadingTrackerPlugin from '../main';

/** Record a sitting with the book note that is open. */
export function registerRecordSessionCommand(app: App, plugin: ReadingTrackerPlugin): void {
	plugin.addCommand({
		id: 'record-reading',
		name: 'Record reading',
		callback: () => {
			new RecordSessionModal(app, plugin, app.workspace.getActiveFile() ?? undefined).open();
		},
	});
}
