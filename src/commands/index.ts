import {App} from 'obsidian';
import ReadingTrackerPlugin from '../main';
import {registerSearchBookCommand} from './searchBook';
import {registerRecordSessionCommand} from './recordSession';
import {registerResetViewsCommand} from './resetViews';
import {registerOpenShelfCommand} from './openShelf';

/**
 * Register all commands
 */
export function registerCommands(app: App, plugin: ReadingTrackerPlugin): void {
	registerSearchBookCommand(app, plugin);
	registerRecordSessionCommand(app, plugin);
	registerResetViewsCommand(plugin);
	registerOpenShelfCommand(plugin);
}
