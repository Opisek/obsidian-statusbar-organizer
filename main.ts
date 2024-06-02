import {
  App,
  Plugin,
  PluginSettingTab,
} from 'obsidian';
import Spooler from './src/spooler';
import { showSettings } from './src/menu';
import { fixOrder } from './src/organizer';

const DEFAULT_SETTINGS: StatusBarOrganizerSettings = {
	activePreset: "default",
	presets: {
		"default": {}
	}
}

export default class StatusBarOrganizer extends Plugin {
	settings: StatusBarOrganizerSettings;
  statusBar: Element;
  spooler: Spooler;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StatusBarSettingTab(this.app, this));

    this.statusBar = document.getElementsByClassName("status-bar")[0];
    this.spooler = new Spooler(this, fixOrder);
	}

	onunload() {
    this.spooler.disableObserver();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// Backwards compatibility with versions < 2.0.0
		const oldSettings = this.settings as any;
		if ("status" in oldSettings) {
			oldSettings.presets.default = oldSettings.status;
			delete oldSettings.status;
			this.settings = oldSettings as StatusBarOrganizerSettings;
			console.log(JSON.stringify(this.settings));
			await this.saveSettings();
		}
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
