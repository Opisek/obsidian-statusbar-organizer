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
    presetEntry.id = `statusbar-organizer-preset-${generatePresetId(presetName)}`;
    if (presetName == plugin.settings.activePreset) presetEntry.addClass("statusbar-organizer-preset-active");
    presetsContainer.appendChild(presetEntry);

    const nameField = document.createElement("input");
    nameField.addClass("statusbar-organizer-preset-name");
    nameField.value = presetName;
    nameField.setAttribute("size", nameField.value.length.toString());
    nameField.maxLength = 25;
    presetEntry.appendChild(nameField);

    const renameButton = document.createElement("span");
    renameButton.addClass("statusbar-organizer-preset-delete");
    setIcon(renameButton, "pencil");
    presetEntry.appendChild(renameButton);

    const deleteButton = document.createElement("span");
    deleteButton.addClass("statusbar-organizer-preset-delete");
    setIcon(deleteButton, "x");
    presetEntry.appendChild(deleteButton);

    // Handle preset selection
    const switchPreset = async () => {
      document.getElementById(`statusbar-organizer-preset-${generatePresetId(plugin.settings.activePreset)}`)?.removeClass("statusbar-organizer-preset-active");
      presetEntry.addClass("statusbar-organizer-preset-active");
      plugin.settings.activePreset = presetName;
      await plugin.saveSettings();
      initializeRows(plugin, settingsContainer);
    }
    presetEntry.addEventListener("click", switchPreset);

    // Handle preset renaming
    renameButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      switchPreset();
      nameField.focus();
    });

    const finishedRenaming = async () => {
      let newName = nameField.value.substring(0, 25).trim();
      if (newName == presetName) return;
      if (newName in plugin.settings.presets) {
        let i = 2;
        while (`${newName} ${i}` in plugin.settings.presets) i++;
        newName = `${newName} ${i}`;
      }
      nameField.value = newName;
      if (presetName == plugin.settings.activePreset) plugin.settings.activePreset = newName;
      presetEntry.id = `statusbar-organizer-preset-${generatePresetId(newName)}`;
      plugin.settings.presets[newName] = plugin.settings.presets[presetName];
      delete plugin.settings.presets[presetName];
      plugin.settings.presetsOrder = plugin.settings.presetsOrder.map(x => x == presetName ? newName : x);
      plugin.settings.activePreset = newName;
      presetName = newName;
      await plugin.saveSettings();
    }
    nameField.addEventListener("change", finishedRenaming);
    nameField.addEventListener("focusout", finishedRenaming);
    nameField.addEventListener("input", () => {
      nameField.setAttribute("size", nameField.value.length.toString());
    });

    // Handle preset deletion
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      delete plugin.settings.presets[presetName];
      plugin.settings.presetsOrder = plugin.settings.presetsOrder.filter(x => x != presetName);
      await plugin.saveSettings();
      await initializePresets(plugin, presetsContainer, settingsContainer);
      await initializeRows(plugin, settingsContainer);
    });
  }

  // Create a button for adding a new preset
  const newPresetEntry = document.createElement("div");
  newPresetEntry.addClass("statusbar-organizer-preset");
  setIcon(newPresetEntry, "plus");
  newPresetEntry.onclick = async () => {
    let i = 1;
    while (`New Preset ${i}` in plugin.settings.presets) i++;
    plugin.settings.presets[`New Preset ${i}`] = JSON.parse(JSON.stringify(plugin.settings.presets[plugin.settings.activePreset]));
    plugin.settings.presetsOrder.push(`New Preset ${i}`);
    await plugin.saveSettings();
    await initializePresets(plugin, presetsContainer, settingsContainer);
  }
  presetsContainer.appendChild(newPresetEntry);
}