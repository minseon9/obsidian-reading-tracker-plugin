import { App, PluginSettingTab, Setting } from "obsidian";
import ReadingTrackerPlugin from "../main";
import { DEFAULT_READING_HISTORY_HEADING } from "../services/bookFileService/readingIndex";

export class ReadingTrackerSettingTab extends PluginSettingTab {
	plugin: ReadingTrackerPlugin;

	constructor(app: App, plugin: ReadingTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Reading tracker folder')
			.setDesc('Where book notes, session notes and the generated views are kept')
			.addText(text => text
				.setPlaceholder('Reading tracker')
				.setValue(this.plugin.settings.bookFolder)
				.onChange(async (value) => {
					this.plugin.settings.bookFolder = value.trim() || 'Reading Tracker';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reading index heading')
			.setDesc("Heading on a book note that its list of sittings is kept under")
			.addText(text => text
				.setPlaceholder(DEFAULT_READING_HISTORY_HEADING)
				.setValue(this.plugin.settings.readingHistoryHeading)
				.onChange(async (value) => {
					this.plugin.settings.readingHistoryHeading = value.trim() || DEFAULT_READING_HISTORY_HEADING;
					await this.plugin.saveSettings();
				}));
	}
}
