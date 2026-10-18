import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import ReadingTrackerPlugin from "../main";
import { ReadingTrackerSettings } from "./types";
import { DEFAULT_READING_HISTORY_HEADING } from "../services/bookFileService/readingIndex";

export class ReadingTrackerSettingTab extends PluginSettingTab {
	plugin: ReadingTrackerPlugin;

	constructor(app: App, plugin: ReadingTrackerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<keyof ReadingTrackerSettings>[] {
		return [
			{
				name: 'Reading tracker folder',
				desc: 'Where book notes, session notes and the generated views are kept',
				control: {
					type: 'text',
					key: 'bookFolder',
					defaultValue: 'Reading Tracker',
					placeholder: 'Reading tracker',
				},
			},
			{
				name: 'Reading index heading',
				desc: 'Heading on a book note that its list of sittings is kept under',
				control: {
					type: 'text',
					key: 'readingHistoryHeading',
					defaultValue: DEFAULT_READING_HISTORY_HEADING,
					placeholder: DEFAULT_READING_HISTORY_HEADING,
				},
			},
		];
	}

	getControlValue(key: keyof ReadingTrackerSettings): unknown {
		return this.plugin.settings[key];
	}

	async setControlValue(key: keyof ReadingTrackerSettings, value: unknown): Promise<void> {
		const trimmed = typeof value === 'string' ? value.trim() : '';
		if (key === 'bookFolder') {
			this.plugin.settings.bookFolder = trimmed || 'Reading Tracker';
		} else if (key === 'readingHistoryHeading') {
			this.plugin.settings.readingHistoryHeading = trimmed || DEFAULT_READING_HISTORY_HEADING;
		}
		await this.plugin.saveSettings();
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
