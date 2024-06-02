import StatusBarOrganizer from "../main";
import { getStatusBarElements, parseElementId } from "./parser";
import { initializePresets } from "./presets";
import { initializeRows } from "./rows";

export async function showSettings(plugin: StatusBarOrganizer, topContainer: HTMLElement): Promise<void> {
  topContainer.empty();

  const presetsContainer = document.createElement("div");
  presetsContainer.addClass("statusbar-organizer-presets-container");
  topContainer.appendChild(presetsContainer);

  const settingsContainer = document.createElement("div");
  settingsContainer.addClass("statusbar-organizer-rows-container-wrapper");
  topContainer.appendChild(settingsContainer);

  await initializePresets(plugin, presetsContainer, settingsContainer);
  await initializeRows(plugin, settingsContainer);
}

export async function savePreset(plugin: StatusBarOrganizer, currentBarStatus: BarStatus) {
  plugin.settings.presets[plugin.settings.activePreset] = currentBarStatus;
  await plugin.saveSettings();
}

/**
 * Merge information about status bar elements based on
 * the saved settings and the state of the actual status bar.
 * 
 * @param plugin 
 * @returns 
 */
export async function consolidateSettingsAndElements(plugin: StatusBarOrganizer): Promise<{
  rows: StatusBarElement[],
  barStatus: BarStatus
}> {
  // Initialize status from settings
  const loadedElementStatus: { [key: string]: StatusBarElementStatus } = plugin.settings.presets[plugin.settings.activePreset] || {};

  // Aggregate all HTML status bar elements and provisionally assign them default status
  const unorderedStatusBarElements = getStatusBarElements(plugin.statusBar);
  const defaultElementStatus: { [key: string]: StatusBarElementStatus } = {};
  for (const [index, statusBarElement] of unorderedStatusBarElements.entries()) {
    defaultElementStatus[statusBarElement.id] = {
      position: index,
      visible: true,
      exists: true
    };
  }

  // Check which known elements are missing from the current status bar
  const barStatus: BarStatus = {};
  for (const [index, status] of Object.entries(loadedElementStatus)) {
    status.exists = index in defaultElementStatus;
    barStatus[index] = status; 
  }

  // Append all previously unknown elements to the end of the list
  let insertPosition = Object.keys(barStatus).length + 1;
  for (const element of unorderedStatusBarElements) {
    if (element.id in barStatus) continue;
    const status = defaultElementStatus[element.id];
    status.position = insertPosition++;
    barStatus[element.id] = status;
  }

  // Serialize elements missing from the status bar
  const disabledStatusBarElements: StatusBarElement[] = Object.keys(loadedElementStatus)
    .filter(x => !barStatus[x].exists)
    .map(x => {
      const parsed = parseElementId(x);
      return {
        name: parsed.name,
        index: parsed.index,
        id: x
      };
    });

  // Generate menu entries with correct order of elements
  const rows: StatusBarElement[] = unorderedStatusBarElements
    .concat(disabledStatusBarElements)
    .map(x => [x, barStatus[x.id].position])
    .sort((a: [any, number], b: [any, number]) => a[1] - b[1])
    .map((x: [StatusBarElement, any]) => x[0]);

  // Save new order of elements (in particular of the previously unknown ones)
  savePreset(plugin, barStatus);
  plugin.spooler.spoolFix(0);

  return {
    rows: rows,
    barStatus: barStatus
  }
}