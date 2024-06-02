import {
  App,
  Plugin,
  PluginSettingTab,
} from 'obsidian';
import Spooler from './src/spooler';
import { showSettings } from './src/menu';
import { fixOrder } from './src/organizer';

const DEFAULT_SETTINGS: StatusBarOrganizerSettings = {
  status: {}
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
    return showSettings(this.plugin);
  }
}
