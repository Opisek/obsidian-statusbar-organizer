import StatusBarOrganizer from "../main";
import { Setting } from "obsidian";
import { deepCopy } from "./util";
import { getActivePreset, initializePresets } from "./presets";
import { getStatusBarElements, parseElementId } from "./parser";
import { initializeRows } from "./rows";
import { setFullscreenListener } from "./fullscreen";

export async function showSettings(plugin: StatusBarOrganizer, topContainer: HTMLElement): Promise<void> {
  topContainer.empty();

  // Dummy input used to fix automatically focusing on the first preset's name field
  const dummyInput = document.createElement("input");
  dummyInput.setAttribute("autofocus", "autofocus");
  dummyInput.setAttribute("type", "hidden");
  topContainer.appendChild(dummyInput);

  // Container for buttons to switch between presets
  const presetsContainer = document.createElement("div");
  presetsContainer.addClass("statusbar-organizer-presets-container");
  topContainer.appendChild(presetsContainer);

  // Container for rows of status bar elements
  const settingsContainer = document.createElement("div");
  settingsContainer.addClass("statusbar-organizer-rows-container-wrapper");
  topContainer.appendChild(settingsContainer);

  await initializePresets(plugin, presetsContainer, settingsContainer);
  await initializeRows(plugin, settingsContainer);

  new Setting(topContainer)
    .setName("Separate fullscreen and windowed mode")
    .setDesc("When enabled, the plugin will remember which preset was active for fullscreen mode and which for windowed mode and switch correspondingly. This is useful for example when you want to display more information in fullscreen mode, like a clock.")
    .addToggle(toggle => toggle
      .setValue(plugin.settings.separateFullscreenPreset)
      .onChange(async value => {
        plugin.settings.separateFullscreenPreset = value;
        plugin.saveSettings();
      })
    )

  setFullscreenListener(async () => {
    await initializePresets(plugin, presetsContainer, settingsContainer);
    await initializeRows(plugin, settingsContainer);
  });
}

export async function savePreset(plugin: StatusBarOrganizer, currentBarStatus: BarStatus) {
  plugin.settings.presets[getActivePreset(plugin)] = deepCopy(currentBarStatus);
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
  const loadedElementStatus: { [key: string]: StatusBarElementStatus } = plugin.settings.presets[getActivePreset(plugin)] || {};

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