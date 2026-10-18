import ReadingTrackerPlugin from "../../../main";
import {requireApiVersion} from "obsidian";
import {refreshBasesViews, registerBasesView, unregisterBasesView} from "./basesPluginClient";
import { ShelfBasesView } from "../../../views/bases/shelf";
import { LibraryBasesView } from "../../../views/bases/library";
import { StatisticsBasesView } from "../../../views/bases/statistics";

/**
 * Register Reading Tracker views with the Bases plugin
 * Requires Obsidian 1.10.1+ (public Bases API with groupBy support)
 */
export async function registerBasesViews(plugin: ReadingTrackerPlugin): Promise<void> {
	// All views now require Obsidian 1.10.1+ (public Bases API with groupBy support)
	if (!requireApiVersion("1.10.1")) {
		console.debug("[Reading Tracker][Bases] Obsidian 1.10.1+ required for Bases integration");
		return;
	}

	const attemptRegistration = (): boolean => {
		try {
			// Register the shelf view (books to read and in progress)
			const shelfSuccess = registerBasesView(plugin, "reading-tracker-shelf", {
				name: "Shelf",
				icon: "book-open",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new ShelfBasesView(controller, containerEl, plugin);
				},
			});

			// Register Library View
			const librarySuccess = registerBasesView(plugin, "reading-tracker-library", {
				name: "Library",
				icon: "library",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new LibraryBasesView(controller, containerEl, plugin);
				},
			});

			// Register Statistics View
			const statisticsSuccess = registerBasesView(plugin, "reading-tracker-statistics", {
				name: "Reading statistics",
				icon: "bar-chart",
				factory: (controller: unknown, containerEl: HTMLElement) => {
					return new StatisticsBasesView(controller, containerEl, plugin);
				},
			});

			if (!shelfSuccess && !librarySuccess && !statisticsSuccess) {
				console.debug("[Reading Tracker][Bases] Bases plugin not available for registration");
				return false;
			}

			refreshBasesViews(plugin.app);
			return true;
		} catch (error) {
			console.debug("[Reading Tracker][Bases] Registration attempt failed:", error);
			return false;
		}
	};

	// Try immediate registration
	if (attemptRegistration()) {
		return;
	}

	// If that fails, try a few more times with short delays
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => window.setTimeout(r, 200));
		if (attemptRegistration()) {
			return;
		}
	}

	console.debug("[Reading Tracker][Bases] Failed to register views after multiple attempts");
}

/**
 * Unregister Reading Tracker views from the Bases plugin
 */
export function unregisterBasesViews(plugin: ReadingTrackerPlugin): void {
	try {
		// Unregister all views
		unregisterBasesView(plugin, "reading-tracker-shelf");
		unregisterBasesView(plugin, "reading-tracker-library");
		unregisterBasesView(plugin, "reading-tracker-statistics");
	} catch (error) {
		console.error("[Reading Tracker][Bases] Error during view unregistration:", error);
	}
}

