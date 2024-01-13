import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

const ignoredClasses = [
  "mod-clickable",
  "status-bar-item"
];

type StatusBarElement = {
    name: string;
    index: number;
    element: Element;
};

function getStatusBarElements(): StatusBarElement[] {
  console.log("getting");
  const statusBar = document.getElementsByClassName("status-bar")[0];
  const elements: StatusBarElement[] = [];
  const pluginElementCount: { [key: string]: number } = {};

  Array.from(statusBar.children).forEach(element => {
    console.log(element.className);
    const name = Array
      .from(element.classList)
      .filter(x => !ignoredClasses.contains(x))
      .join('-');

    let index =
      (name in pluginElementCount)
        ? pluginElementCount[name] + 1
        : 1;

    pluginElementCount[name] = index;

    elements.push({
      name: name,
      index: index,
      element: element
    });
  });

  return elements;
}

interface StatusBarOrganizerSettings {
}

const DEFAULT_SETTINGS: StatusBarOrganizerSettings = {
}

export default class StatusBarOrganizer extends Plugin {
	settings: StatusBarOrganizerSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new StatusBarSettingTab(this.app, this));

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

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

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

    const entriesContainer = document.createElement("div");
    entriesContainer.addClass("statusbarOrganizerEntriesContainer");
    containerEl.appendChild(entriesContainer);

    //const statusBarElementObjects =  
    const entries = [];
    for (const statusBarElement of getStatusBarElements()) {
      const entry = document.createElement("div");
      entry.addClass("statusbarOrganizerEntry");
      entries.push(entry);
      entriesContainer.appendChild(entry);
      
      const handle = document.createElement("span");
      handle.addClass("statusbarOrganizerHandle");
      entry.appendChild(handle);

      const titleSpan = document.createElement("span");
      titleSpan.innerHTML = `${statusBarElement.name} (${statusBarElement.index})`;
      entry.appendChild(titleSpan);

      const visibilitySpan = document.createElement("span");
      visibilitySpan.addClass("statusbarOrganizerVisibility");
      visibilitySpan.innerHTML = "👁";
      entry.appendChild(visibilitySpan);
    }

		// new Setting(containerEl)
		// 	.setName('Setting #1')
		// 	.setDesc('It\'s a secret')
		// 	.addText(text => text
		// 		.setPlaceholder('Enter your secret')
		// 		.setValue('test')
		// 		.onChange(async (value) => {
		// 			//this.plugin.settings.mySetting = value;
		// 			await this.plugin.saveSettings();
		// 		}));
	}
}
