import {
  App,
  Plugin,
  PluginSettingTab,
} from 'obsidian';
import Spooler from './src/spooler';
import { fixOrder } from './src/organizer';
import { monitorFullscreen } from 'src/fullscreen';
import { registerHotkeys } from 'src/hotkeys';
import { showSettings } from './src/menu';
import { upgrade } from 'src/upgrade';

const DEFAULT_SETTINGS: StatusBarOrganizerSettings = {
	activePreset: "Default",
	activeFullscreenPreset: "Default",
	separateFullscreenPreset: false,
	presets: {
		"Default": {}
	},
	presetsOrder: ["Default"],
	version: "CURRENT_VERSION"
}

export default class StatusBarOrganizer extends Plugin {
	settings: StatusBarOrganizerSettings;
	statusBar: Element;
	spooler: Spooler;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StatusBarSettingTab(this.app, this));
		registerHotkeys(this, this.settings.presetsOrder);

		this.statusBar = document.getElementsByClassName("status-bar")[0];
		this.spooler = new Spooler(this, fixOrder);

    monitorFullscreen(this);
	}

	onunload() {
    this.spooler.disableObserver();
	}

	async loadSettings() {
		const savedData = await this.loadData();
		if (Object.keys(savedData).length != 0 && !("version" in savedData)) savedData["version"] = "0.0.0";
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);

		upgrade(this.settings);
		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class StatusBarSettingTab extends PluginSettingTab {
	plugin: StatusBarOrganizer;

	constructor(app: App, plugin: StatusBarOrganizer) {
		super(app, plugin);
		this.plugin = plugin;
	}

  async display() {
		const {containerEl} = this;
    return showSettings(this.plugin, containerEl);
  }
}
