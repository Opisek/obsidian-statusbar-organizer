import StatusBarOrganizer from "../main";
import { generatePresetId } from "./parser";
import { setIcon } from "obsidian";
import { initializeRows } from "./rows";

/**
 * Set up the presets in the settings menu.
 * 
 * @param plugin 
 * @param presetsContainer 
 * @param settingsContainer 
 */
export async function initializePresets(plugin: StatusBarOrganizer, presetsContainer: HTMLDivElement, settingsContainer: HTMLDivElement) {
  presetsContainer.empty();

  // Make sure there exists at least one preset and that the active preset is valid
  if (plugin.settings.presetsOrder.length == 0) {
    plugin.settings.presetsOrder.push("Default");
    plugin.settings.presets["Default"] = {};
    plugin.settings.activePreset = "Default";
    await plugin.saveSettings();
  }
  if (!(plugin.settings.activePreset in plugin.settings.presets)) {
    plugin.settings.activePreset = plugin.settings.presetsOrder[0];
    await plugin.saveSettings();
  }

  // Create a button for each preset
  for (let presetName of plugin.settings.presetsOrder) {
    // Create preset entry
    const presetEntry = document.createElement("div");
    presetEntry.addClass("statusbar-organizer-preset");
    presetEntry.id = getPresetId(presetName);
    if (presetName == plugin.settings.activePreset) presetEntry.addClass("statusbar-organizer-preset-active");
    presetsContainer.appendChild(presetEntry);

    const nameField = document.createElement("input");
    nameField.addClass("statusbar-organizer-preset-name");
    nameField.value = presetName;
    nameField.setAttribute("size", nameField.value.length.toString());
    nameField.maxLength = 25;
    presetEntry.appendChild(nameField);

    // Preset Renaming
    const renameButton = document.createElement("span");
    renameButton.addClass("statusbar-organizer-preset-delete");
    setIcon(renameButton, "pencil");
    renameButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      select();
      nameField.focus();
    });
    const rename = async () => {
      presetName = await renamePreset(plugin, presetEntry, nameField, presetName);
    }
    nameField.addEventListener("change", async () => rename());
    nameField.addEventListener("focusout", async () => rename());
    nameField.addEventListener("input", () => {
      nameField.setAttribute("size", Math.max(nameField.value.length, 1).toString());
    });
    presetEntry.appendChild(renameButton);

    // Preset Deletion
    const deleteButton = document.createElement("span");
    deleteButton.addClass("statusbar-organizer-preset-delete");
    setIcon(deleteButton, "x");
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deletePreset(plugin, presetsContainer, settingsContainer, presetName);
    });
    presetEntry.appendChild(deleteButton);

    // Preset Switching
    const select = async () => {
      await switchPreset(plugin, presetEntry, presetName, settingsContainer)
    }
    presetEntry.addEventListener("click", async () => select());
  }

  // Create a button for adding a new preset
  const newPresetEntry = document.createElement("div");
  newPresetEntry.addClass("statusbar-organizer-preset");
  setIcon(newPresetEntry, "plus");
  newPresetEntry.addEventListener("click", () => addPreset(plugin, presetsContainer, settingsContainer));
  presetsContainer.appendChild(newPresetEntry);
}

/**
 * Create a new preset cloning the current settings.
 * 
 * @param plugin 
 * @param presetsContainer 
 * @param settingsContainer 
 */
async function addPreset(plugin: StatusBarOrganizer, presetsContainer: HTMLDivElement, settingsContainer: HTMLDivElement) {
  const presetName = disambiguate("New Preset", plugin.settings.presetsOrder);
  plugin.settings.presets[presetName] = JSON.parse(JSON.stringify(plugin.settings.presets[plugin.settings.activePreset]));
  plugin.settings.presetsOrder.push(presetName);
  plugin.settings.activePreset = presetName;
  await plugin.saveSettings();
  await initializePresets(plugin, presetsContainer, settingsContainer);
}

/**
 * Delete a preset and switch to the next closest one.
 * 
 * @param plugin 
 * @param presetsContainer 
 * @param settingsContainer 
 * @param presetName 
 */
async function deletePreset(plugin: StatusBarOrganizer, presetsContainer: HTMLDivElement, settingsContainer: HTMLDivElement, presetName: string) {
  // Switch to the closest preset
  const currentIndex = plugin.settings.presetsOrder.indexOf(presetName);
  if (currentIndex > 0) plugin.settings.activePreset = plugin.settings.presetsOrder[currentIndex - 1];
  else if (currentIndex < plugin.settings.presetsOrder.length - 1) plugin.settings.activePreset = plugin.settings.presetsOrder[currentIndex + 1];
  else plugin.settings.activePreset = "Default";

  // Delete preset
  delete plugin.settings.presets[presetName];
  plugin.settings.presetsOrder = plugin.settings.presetsOrder.filter(x => x != presetName);

  await plugin.saveSettings();
  await initializePresets(plugin, presetsContainer, settingsContainer);
  await initializeRows(plugin, settingsContainer);
}

/**
 * Rename a preset.
 * 
 * @param plugin 
 * @param presetEntry 
 * @param nameField 
 * @param presetName 
 * @returns 
 */
async function renamePreset(plugin: StatusBarOrganizer, presetEntry: HTMLDivElement, nameField: HTMLInputElement, presetName: string) {
  // Make sure the name is legal
  let newName = nameField.value.substring(0, 25).trim();
  const otherPresets = plugin.settings.presetsOrder.filter(x => x != presetName);
  newName = (newName == "") ? disambiguate("New Preset", otherPresets) : disambiguate(newName, otherPresets, 2, true);
  nameField.value = newName;
  nameField.setAttribute("size", newName.length.toString());
  if (newName == presetName) return presetName;

  // Change the name
  if (presetName == plugin.settings.activePreset) plugin.settings.activePreset = newName;
  presetEntry.id = getPresetId(newName);
  plugin.settings.presets[newName] = plugin.settings.presets[presetName];
  delete plugin.settings.presets[presetName];
  plugin.settings.presetsOrder = plugin.settings.presetsOrder.map(x => x == presetName ? newName : x);
  plugin.settings.activePreset = newName;

  await plugin.saveSettings();
  return newName;
}

/**
 * Switch to a different preset.
*/
async function switchPreset(plugin: StatusBarOrganizer, presetEntry: HTMLDivElement, presetName: string, settingsContainer: HTMLDivElement) {
  document.getElementById(getPresetId(plugin.settings.activePreset))?.removeClass("statusbar-organizer-preset-active");
  presetEntry.addClass("statusbar-organizer-preset-active");
  plugin.settings.activePreset = presetName;
  await plugin.saveSettings();
  await initializeRows(plugin, settingsContainer);
}

/**
 * Disambiguate preset names by using numbers.
 * 
 * @param presetName 
 * @param presets 
 * @param start 
 * @param allowNoNumber 
 * @returns 
 */
function disambiguate(presetName: string, presets: string[], start: number = 1, allowNoNumber: boolean = false) {
  if (allowNoNumber && !presets.includes(presetName)) return presetName;
  while (presets.includes(`${presetName} ${start}`)) start++;
  return `${presetName} ${start}`;
}

/**
 * Generate a preset id as saved in the DOM.
 * 
 * @param presetName 
 * @returns 
 */
function getPresetId(presetName: string) {
  return `statusbar-organizer-preset-${generatePresetId(presetName)}`;
}