import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

const ignoredClasses = [
  "mod-clickable",
  "status-bar-item",
  "statusBarOrganizerSettingsHidden"
];

type StatusBarElement = {
  name: string;
  index: number;
  element: Element;
  entry?: HTMLDivElement;
};

type StatusBarElementStatus = {
  position: number;
  visible: boolean;
}

function getStatusBarElements(): StatusBarElement[] {
  const statusBar = document.getElementsByClassName("status-bar")[0];
  const elements: StatusBarElement[] = [];
  const pluginElementCount: { [key: string]: number } = {};

  Array.from(statusBar.children).forEach(element => {
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
    // Set up layout
		const {containerEl} = this;

		containerEl.empty();

    const entriesContainer = document.createElement("div");
    entriesContainer.addClass("statusbarOrganizerEntriesContainer");
    containerEl.appendChild(entriesContainer);

    // Initialize status
    const statusBarElements = getStatusBarElements();
    const elementStatus: { [key: string]: StatusBarElementStatus } = {};
    for (const [index, statusBarElement] of statusBarElements.entries()) {
      elementStatus[statusBarElement.name] = {
        position: index,
        visible: true
      };
    }

    // Functions
    function toggleVisibility(statusBarElement: StatusBarElement) {
      const status = elementStatus[statusBarElement.name];

      if (status.visible = !status.visible)
        statusBarElement.element.removeClass("statusbarOrganizerHidden");
      else
        statusBarElement.element.addClass("statusbarOrganizerHidden");
    }

    let dragging = false;

    function handleMouseDown(statusBarElement: StatusBarElement, event: MouseEvent) {
      if (dragging) return;
      dragging = true;

      // Modify real element
      const realEntry = statusBarElement.entry as HTMLDivElement;
      realEntry.addClass("statusbarOrganizerClone");

      // Create faux element
      const fauxEntry = document.createElement("div");

      fauxEntry.addClass("statusbarOrganizerEntry");
      fauxEntry.addClass("statusbarOrganizerDrag");
      containerEl.appendChild(fauxEntry);

      fauxEntry.style.left = realEntry.getBoundingClientRect().left + 'px';
      fauxEntry.style.top = realEntry.getBoundingClientRect().top + 'px';
      fauxEntry.style.width = realEntry.offsetWidth + 'px';
      
      for (const child of Array.from(realEntry.children)) {
        const fauxSpan = document.createElement("span");
        fauxSpan.className = child.className;
        fauxSpan.innerHTML = child.innerHTML;
        fauxEntry.appendChild(fauxSpan);
      }

      // Take note of coordinates
      let offsetX = event.clientX - fauxEntry.getBoundingClientRect().left;
      let offsetY = event.clientY - fauxEntry.getBoundingClientRect().top;
      let index = Array.from(entriesContainer.children).indexOf(realEntry);

      //  Handle dragging
      function handleMouseMove(event: MouseEvent) {
        fauxEntry.style.left = event.clientX - offsetX + 'px';
        fauxEntry.style.top = event.clientY - offsetY + 'px';

				const dist = fauxEntry.getBoundingClientRect().top - realEntry.getBoundingClientRect().top;

				if (Math.abs(dist) > realEntry.offsetHeight * 0.75) {
					const dir = dist / Math.abs(dist);

					var newIndex = Math.max(0, Math.min(index + dir, entriesContainer.children.length - 1));
					if (newIndex != index) {
						entriesContainer.removeChild(realEntry);
						if (newIndex != entriesContainer.children.length)
              entriesContainer.insertBefore(realEntry, entriesContainer.children[newIndex]);
            else
              entriesContainer.appendChild(realEntry);

						index = newIndex;
					}
				}
      }

      window.addEventListener('mousemove', handleMouseMove); 

      // Handle release
      function handleMouseUp(event: MouseEvent) {
        realEntry.removeClass("statusbarOrganizerClone");
        containerEl.removeChild(fauxEntry);

        dragging = false;

        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);
      }
      window.addEventListener('mouseup', handleMouseUp);
    }

    // Generate entries
    for (const statusBarElement of statusBarElements) {
      const entry = document.createElement("div");
      entry.addClass("statusbarOrganizerEntry");
      statusBarElement.entry = entry;
      entriesContainer.appendChild(entry);
      
      const handle = document.createElement("span");
      handle.addClass("statusbarOrganizerHandle");
      handle.addEventListener("mousedown", (event) => handleMouseDown(statusBarElement, event));
      entry.appendChild(handle);

      const titleSpan = document.createElement("span");
      titleSpan.innerHTML = `${statusBarElement.name} (${statusBarElement.index})`;
      entry.appendChild(titleSpan);

      const visibilitySpan = document.createElement("span");
      visibilitySpan.addClass("statusbarOrganizerVisibility");
      visibilitySpan.innerHTML = "👁";
      visibilitySpan.onclick = (() => toggleVisibility(statusBarElement));
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
