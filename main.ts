import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon
} from 'obsidian';

const ignoredClasses = [
  "mod-clickable",
  "status-bar-item",
  "statusbar-organizer-hidden"
];

type StatusBarElement = {
  name: string;
  index: number;
  id: string;
  element?: Element;
  entry?: HTMLDivElement;
};

type StatusBarElementStatus = {
  position: number;
  visible: boolean;
  exists: boolean;
}

function generateId(name: string, index: number): string {
  return `${name};${index}`;
}

function parseId(id: string): { name: string, index: number } {
  const parts = id.split(';');
  const index = Number.parseInt(parts.pop() as string);
  const name = parts.join(';');

  return {
    name: name,
    index: index
  };
}

function getStatusBarElements(): StatusBarElement[] {
  const statusBar = document.getElementsByClassName("status-bar")[0];
  const elements: StatusBarElement[] = [];
  const pluginElementCount: { [key: string]: number } = {};

  Array.from(statusBar.children).forEach(element => {
    let id = element.getAttribute("data-statusbar-organizer-id");
    let name, index;
    if (id == null) {
      name = Array
        .from(element.classList)
        .filter(x => !ignoredClasses.contains(x))
        .join('-');

      index =
        (name in pluginElementCount)
          ? pluginElementCount[name] + 1
          : 1;

      id = generateId(name, index);
      element.setAttribute("data-statusbar-organizer-id", id);
    } else {
      const parsed = parseId(id);
      name = parsed.name;
      index = parsed.index;
    }

    pluginElementCount[name] = Math.max(
      index,
      name in pluginElementCount
        ? pluginElementCount[name]
        : 0
    );

    elements.push({
      name: name,
      index: index,
      id: id,
      element: element
    });
  });

  return elements;
}

function fixOrder(status: { [key: string]: StatusBarElementStatus }) {
  const elements = getStatusBarElements();
  const statusBar = document.getElementsByClassName("status-bar")[0];

  const known = [];
  const orphans = [];

  for (const element of elements) {
    if (element.id in status) {
      const myStatus = status[element.id];
      known.push([element, myStatus.position]);
      if (myStatus.visible)
        (element.element as HTMLDivElement).removeClass("statusbar-organizer-hidden");
      else
        (element.element as HTMLDivElement).addClass("statusbar-organizer-hidden");
    } else {
      orphans.push(element.element);
    }
  }

  const orderedElements = known
    .sort((a: [any, number], b: [any, number]) => a[1] - b[1])
    .map((x: [StatusBarElement, any]) => x[0].element);

  const allElements = orderedElements.concat(orphans);

  statusBar.innerHTML = "";
  for (const element of allElements) statusBar.appendChild(element as HTMLElement);
}

function disableObserver(plugin: StatusBarOrganizer) {
  plugin.observer.disconnect();
}

function enableObserver(plugin: StatusBarOrganizer) {
  plugin.observer.observe(plugin.statusBar, { childList: true });
}

function spoolFix(plugin: StatusBarOrganizer, timeout: number = 1000) {
  clearTimeout(plugin.spooler);

  plugin.spooler =
    window.setTimeout(() => {
      if (this.mutex) {
        spoolFix(plugin);
      } else {
        plugin.mutex = true;
        disableObserver(plugin);
        fixOrder(plugin.settings.status);
        enableObserver(plugin);
        plugin.mutex = false;
      }
    }, timeout);
}

interface StatusBarOrganizerSettings {
  status: { [key: string]: StatusBarElementStatus };
}

const DEFAULT_SETTINGS: StatusBarOrganizerSettings = {
  status: {}
}

export default class StatusBarOrganizer extends Plugin {
	settings: StatusBarOrganizerSettings;

  observer: MutationObserver;
  spooler: number;
  mutex: boolean;

  statusBar: Element;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new StatusBarSettingTab(this.app, this));

    this.spooler = 0;
    this.mutex = false;
    this.statusBar = document.getElementsByClassName("status-bar")[0];

    this.observer = new MutationObserver((list, _) => {
      if (
        !this.mutex
        && list.some(
          mutation => mutation.type == "childList"
          && mutation.addedNodes.length > 0
        )
      ) {
        spoolFix(this, 0);
      }
    });

    spoolFix(this, 5000);
	}

	onunload() {
    disableObserver(this);
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

	async display(): Promise<void> {
    // Set up layout
		const {containerEl} = this;

		containerEl.empty();

    const entriesContainer = document.createElement("div");
    entriesContainer.addClass("statusbar-organizer-container");
    containerEl.appendChild(entriesContainer);

    // Initialize status
    const loadedElementStatus: { [key: string]: StatusBarElementStatus } = this.plugin.settings.status;

    const unorderedStatusBarElements = getStatusBarElements();
    const defaultElementStatus: { [key: string]: StatusBarElementStatus } = {};
    for (const [index, statusBarElement] of unorderedStatusBarElements.entries()) {
      defaultElementStatus[statusBarElement.id] = {
        position: index,
        visible: true,
        exists: true
      };
    }

    const elementStatus: { [key: string]: StatusBarElementStatus } = {};
    for (const [index, status] of Object.entries(loadedElementStatus)) {
      status.exists = index in defaultElementStatus;
      elementStatus[index] = status; 
    }
    let insertPosition = Object.keys(elementStatus).length + 1;
    for (const element of unorderedStatusBarElements) {
      if (element.id in elementStatus) continue;
      const status = defaultElementStatus[element.id];
      status.position = insertPosition++;
      elementStatus[element.id] = status;
    }

    const disabledStatusBarElements: StatusBarElement[] = Object.keys(loadedElementStatus)
      .filter(x => !elementStatus[x].exists)
      .map(x => {
        const parsed = parseId(x);
        return {
          name: parsed.name,
          index: parsed.index,
          id: x
        };
      });

    const statusBarElements: StatusBarElement[] = unorderedStatusBarElements
      .concat(disabledStatusBarElements)
      .map(x => [x, elementStatus[x.id].position])
      .sort((a: [any, number], b: [any, number]) => a[1] - b[1])
      .map((x: [StatusBarElement, any]) => x[0]);

    this.plugin.settings.status = elementStatus;
    await this.plugin.saveSettings();
    spoolFix(this.plugin, 0);

    // Functions
    async function toggleVisibility(statusBarElement: StatusBarElement, plugin: StatusBarOrganizer) {
      const status = elementStatus[statusBarElement.id];

      if (statusBarElement.element) {
        if (status.visible = !status.visible) {
          statusBarElement.element.removeClass("statusbar-organizer-hidden");
          setIcon((statusBarElement.entry as HTMLDivElement).children[3] as HTMLElement, "eye");
        } else {
          statusBarElement.element.addClass("statusbar-organizer-hidden");
          setIcon((statusBarElement.entry as HTMLDivElement).children[3] as HTMLElement, "eye-off");
        }
      }
      
      plugin.settings.status = elementStatus;
      await plugin.saveSettings();
    }

    async function removeOrphan(statusBarElement: StatusBarElement, plugin: StatusBarOrganizer) {
      entriesContainer.removeChild(statusBarElement.entry as HTMLDivElement);      
      delete elementStatus[statusBarElement.id];

      for (const [entryIndex, entry] of Array.from(entriesContainer.children).entries())
        elementStatus[entry.getAttribute("data-statusbar-organizer-id") as string].position = entryIndex;

      plugin.settings.status = elementStatus;
      await plugin.saveSettings();
    }

    let dragging = false;

    function handleMouseDown(statusBarElement: StatusBarElement, event: MouseEvent, plugin: StatusBarOrganizer) {
      if (dragging) return;
      dragging = true;

      // Modify real element
      const realEntry = statusBarElement.entry as HTMLDivElement;
      realEntry.addClass("statusbar-organizer-clone");

      // Create faux element
      const fauxEntry = document.createElement("div");

      fauxEntry.addClass("statusbar-organizer-entry");
      fauxEntry.addClass("statusbar-organizer-drag");
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
        disableObserver(plugin);

        fauxEntry.style.left = event.clientX - offsetX + 'px';
        fauxEntry.style.top = event.clientY - offsetY + 'px';

				const dist = fauxEntry.getBoundingClientRect().top - realEntry.getBoundingClientRect().top;

				if (Math.abs(dist) > realEntry.offsetHeight * 0.75) {
					const dir = dist / Math.abs(dist);

					const newIndex = Math.max(0, Math.min(index + dir, entriesContainer.children.length - 1));
					if (newIndex != index) {
            const passedEntry = entriesContainer.children[newIndex];
            const passedId = passedEntry.getAttribute("data-statusbar-organizer-id");
            const statusBarChangeRequired =
              elementStatus[statusBarElement.id].exists &&
              elementStatus[passedId as string].exists;

            const statusBar = document.getElementsByClassName("status-bar")[0];
            if (statusBarChangeRequired) {
              statusBar.removeChild(statusBarElement.element as HTMLDivElement)
              const passedElement = statusBarElements.filter(x => x.id == passedId)[0].element;
              if (dir > 0)
                statusBar.insertAfter(statusBarElement.element as HTMLDivElement, passedElement as HTMLDivElement);
              else
                statusBar.insertBefore(statusBarElement.element as HTMLDivElement, passedElement as HTMLDivElement);
            }

						entriesContainer.removeChild(realEntry);
						if (newIndex != entriesContainer.children.length)
              entriesContainer.insertBefore(realEntry, entriesContainer.children[newIndex]);
            else
              entriesContainer.appendChild(realEntry);

						index = newIndex;

            for (const [entryIndex, entry] of Array.from(entriesContainer.children).entries())
              elementStatus[entry.getAttribute("data-statusbar-organizer-id") as string].position = entryIndex;
					}
				}

        enableObserver(plugin);
      }

      window.addEventListener('mousemove', handleMouseMove); 

      // Handle release
      async function handleMouseUp(event: MouseEvent) {
        realEntry.removeClass("statusbar-organizer-clone");
        containerEl.removeChild(fauxEntry);

        dragging = false;

        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);

		    plugin.settings.status = elementStatus;
        await plugin.saveSettings();
      }
      window.addEventListener('mouseup', handleMouseUp);
    }

    // Check name collisions
    const nameCollisions: { [key: string]: number } = {};
    for (const element of statusBarElements) {
      if (element.name in nameCollisions)
        nameCollisions[element.name]++;
      else
        nameCollisions[element.name] = 0;
    }
    
    // Generate entries
    for (const statusBarElement of statusBarElements) {
      const currentStatus = elementStatus[statusBarElement.id];

      const entry = document.createElement("div");
      entry.addClass("statusbar-organizer-entry");
      if (!currentStatus.exists) entry.addClass("statusbar-organizer-disabled");
      entry.setAttribute("data-statusbar-organizer-id", statusBarElement.id);
      statusBarElement.entry = entry;
      entriesContainer.appendChild(entry);
      
      const handle = document.createElement("span");
      handle.addClass("statusbar-organizer-handle");
      handle.addEventListener("mousedown", (event) => handleMouseDown(statusBarElement, event, this.plugin));
      entry.appendChild(handle);

      const formattedName = statusBarElement.name
        .replace(/^plugin-(obsidian-)?/,'')
        .split('-')
        .map(x => x.charAt(0).toUpperCase() + x.slice(1))
        .join(' ')
        + (
          nameCollisions[statusBarElement.name]
            ? ` (${statusBarElement.index})`
            : ''
        );

      const titleSpan = document.createElement("span");
      titleSpan.textContent = formattedName;
      entry.appendChild(titleSpan);

      const previewSpan = document.createElement("span");
      previewSpan.addClass("statusbar-organizer-preview");
      if (currentStatus.exists) {
        previewSpan.innerHTML = (statusBarElement.element as Element).innerHTML;
      }
      entry.appendChild(previewSpan);

      const visibilitySpan = document.createElement("span");
      visibilitySpan.addClass("statusbar-organizer-visibility");
      visibilitySpan.onclick = (() => {
        if (currentStatus.exists) toggleVisibility(statusBarElement, this.plugin);
        else removeOrphan(statusBarElement, this.plugin);
      });
      setIcon(visibilitySpan, currentStatus.exists ? (currentStatus.visible ? "eye" : "eye-off") : "trash-2");
      entry.appendChild(visibilitySpan);
    }
	}
}
