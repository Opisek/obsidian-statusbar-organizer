import { setIcon } from "obsidian";
import StatusBarOrganizer from "../main";
import { generatePresetId, getStatusBarElements, parseElementId } from "./parser";

let dragging: boolean;

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

  dragging = false;
}

async function savePreset(plugin: StatusBarOrganizer, currentBarStatus: BarStatus) {
  plugin.settings.presets[plugin.settings.activePreset] = currentBarStatus;
  await plugin.saveSettings();
}

/**
 * Set up the presets in the settings menu.
 * 
 * @param plugin 
 * @param presetsContainer 
 * @param settingsContainer 
 */
async function initializePresets(plugin: StatusBarOrganizer, presetsContainer: HTMLDivElement, settingsContainer: HTMLDivElement) {
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
      console.log(plugin.settings.activePreset);
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

/**
 * Set up the rows in the settings menu.
 * 
 * @param plugin 
 * @param settingsContainer 
 * @returns 
 */
async function initializeRows(plugin: StatusBarOrganizer, settingsContainer: HTMLDivElement) {
  settingsContainer.empty();

  // Get a definite list of menu row entries
  const { rows, barStatus } = await consolidateSettingsAndElements(plugin);

  // Initialize the container
  const rowsContainer = document.createElement("div");
  rowsContainer.addClass("statusbar-organizer-rows-container");
  settingsContainer.appendChild(rowsContainer);

  // Check name collisions
  const nameCollisions: { [key: string]: number } = {};
  for (const element of rows) {
    if (element.name in nameCollisions)
      nameCollisions[element.name]++;
    else
      nameCollisions[element.name] = 0;
  }

  // Generate visual rows
  for (const row of rows) {
    const currentStatus = barStatus[row.id];

    const entry = document.createElement("div");
    entry.addClass("statusbar-organizer-row");
    if (!currentStatus.exists) entry.addClass("statusbar-organizer-row-disabled");
    if (!currentStatus.visible) entry.addClass("statusbar-organizer-row-hidden");
    entry.setAttribute("data-statusbar-organizer-id", row.id);
    row.entry = entry;
    rowsContainer.appendChild(entry);
    
    const handle = document.createElement("span");
    handle.addClass("statusbar-organizer-row-handle");
    handle.addEventListener("mousedown", (event) => 
      handleMouseDown(event, plugin, barStatus, settingsContainer, rowsContainer, rows, row)
    );
    entry.appendChild(handle);

    const formattedName = row.name
      .replace(/^plugin-(obsidian-)?/,'')
      .split('-')
      .map(x => x.charAt(0).toUpperCase() + x.slice(1))
      .join(' ')
      + (
        nameCollisions[row.name]
          ? ` (${row.index})`
          : ''
      );

    const titleSpan = document.createElement("span");
    titleSpan.textContent = formattedName;
    entry.appendChild(titleSpan);

    const previewSpan = document.createElement("span");
    previewSpan.addClass("statusbar-organizer-row-preview");
    if (currentStatus.exists) {
      previewSpan.innerHTML = (row.element as Element).innerHTML;
    }
    entry.appendChild(previewSpan);

    const visibilitySpan = document.createElement("span");
    visibilitySpan.addClass("statusbar-organizer-row-visibility");
    visibilitySpan.onclick = (() => {
      if (currentStatus.exists) toggleVisibility(plugin, barStatus, row);
      else removeOrphan(plugin, rowsContainer, barStatus, row);
    });
    setIcon(visibilitySpan, currentStatus.exists ? (currentStatus.visible ? "eye" : "eye-off") : "trash-2");
    entry.appendChild(visibilitySpan);
  }

  return {
    rows: rows,
    barStatus: barStatus,
    rowsContainer: rowsContainer
  }
}

async function consolidateSettingsAndElements(plugin: StatusBarOrganizer) {
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

/**
 * Handle clicking the "eye icon" on a row in the settings menu.
 * 
 * Toggles the state of the row and the visibility of the corresponding status bar element.
 * 
 * @param plugin 
 * @param barStatus 
 * @param row 
 */
async function toggleVisibility(plugin: StatusBarOrganizer, barStatus: BarStatus, row: StatusBarElement) {
  const status = barStatus[row.id];

  if (status.visible = !status.visible) {
    row.element?.removeClass("statusbar-organizer-element-hidden");
    row.entry?.removeClass("statusbar-organizer-row-hidden");
    setIcon((row.entry as HTMLDivElement).children[3] as HTMLElement, "eye");
  } else {
    row.element?.addClass("statusbar-organizer-element-hidden");
    row.entry?.addClass("statusbar-organizer-row-hidden");
    setIcon((row.entry as HTMLDivElement).children[3] as HTMLElement, "eye-off");
  }
  
  savePreset(plugin, barStatus);
}

/**
 * Handle clicking the "trash icon" on a row in the settings menu.
 * 
 * Removes the row from the settings entirely.
 * 
 * @param plugin 
 * @param rowsContainer 
 * @param barStatus 
 * @param row 
 */
async function removeOrphan(plugin: StatusBarOrganizer, rowsContainer: HTMLDivElement, barStatus: BarStatus, row: StatusBarElement) {
  // Remove the orphan
  rowsContainer.removeChild(row.entry as HTMLDivElement);      
  delete barStatus[row.id];

  // Move all other elements up to fill the gap
  for (const [entryIndex, entry] of Array.from(rowsContainer.children).entries())
    barStatus[entry.getAttribute("data-statusbar-organizer-id") as string].position = entryIndex;

  // Save the settings
  savePreset(plugin, barStatus);
}

/**
 * Create a copy of a row to be dragged around.
 * 
 * @param settingsContainer 
 * @param barStatus
 * @param event 
 * @param rowsContainer 
 * @param row 
 */
function cloneRow(settingsContainer: HTMLDivElement, barStatus: BarStatus, rowsContainer: HTMLDivElement, event: MouseEvent, row: StatusBarElement): {
  stationaryRow: HTMLDivElement,
  movableRow: HTMLDivElement,
  offsetX: number,
  offsetY: number,
  index: number
} {
  // Modify real element
  const realEntry = row.entry as HTMLDivElement;
  realEntry.addClass("statusbar-organizer-row-clone");

  // Create faux element
  const fauxEntry = document.createElement("div");

  fauxEntry.addClass("statusbar-organizer-row");
  fauxEntry.addClass("statusbar-organizer-row-drag");
  if (!barStatus[row.id].exists) fauxEntry.addClass("statusbar-organizer-row-disabled");
  if (!barStatus[row.id].visible) fauxEntry.addClass("statusbar-organizer-row-hidden");

  //const fauxEntryBackground = document.createElement("div");
  //fauxEntryBackground.addClass("statusbar-organizer-row-background");
  //fauxEntry.appendChild(fauxEntryBackground);

  settingsContainer.appendChild(fauxEntry);

  // Position faux element beneath the mouse cursor 
  fauxEntry.style.left = realEntry.getBoundingClientRect().left + 'px';
  fauxEntry.style.top = realEntry.getBoundingClientRect().top + 'px';
  fauxEntry.style.width = realEntry.offsetWidth + 'px';

  // Copy all children over
  for (const child of Array.from(realEntry.children)) {
    const fauxSpan = document.createElement("span");
    fauxSpan.className = child.className;
    fauxSpan.innerHTML = child.innerHTML;
    fauxEntry.appendChild(fauxSpan);
  }

  // Determine offsets and initial row index
  let offsetX = event.clientX - fauxEntry.getBoundingClientRect().left;
  let offsetY = event.clientY - fauxEntry.getBoundingClientRect().top;
  let index = Array.from(rowsContainer.children).indexOf(realEntry);

  return {
    stationaryRow: realEntry,
    movableRow: fauxEntry,
    offsetX: offsetX,
    offsetY: offsetY,
    index: index
  }
}

/**
 * Remove the row clone after finished draggin.
 * 
 * @param settingsContainer 
 * @param stationaryRow 
 * @param movableRow 
 */
function deleteRowClone(settingsContainer: HTMLDivElement, stationaryRow: HTMLDivElement, movableRow: HTMLDivElement) {
  stationaryRow.removeClass("statusbar-organizer-row-clone");
  settingsContainer.removeChild(movableRow);
}

/**
 * Determine if a row was dragged far enough to warrant a change in position. 
 * 
 * @param event 
 * @param rowsContainer 
 * @param movableRow 
 * @param stationaryRow 
 * @param offsetX 
 * @param offsetY 
 * @param index 
 * @returns 
 */
function calculateRowIndex(event: MouseEvent, rowsContainer: HTMLDivElement, movableRow: HTMLDivElement, stationaryRow: HTMLDivElement, offsetX: number, offsetY: number, index: number): number {
  // Update the position
  movableRow.style.left = event.clientX - offsetX + 'px';
  movableRow.style.top = event.clientY - offsetY + 'px';

  // Determine the distance from the stationary position
  const dist = movableRow.getBoundingClientRect().top - stationaryRow.getBoundingClientRect().top;

  // If the distance is large enough, change the index
  if (Math.abs(dist) > stationaryRow.offsetHeight * 0.75) {
    const dir = dist / Math.abs(dist);
    const newIndex = Math.max(0, Math.min(index + dir, rowsContainer.children.length - 1));
    return newIndex;
  } return index;
}

/**
 * Handle position changes in the settings menu.
 *
 * @param barStatus 
 * @param rowsContainer 
 * @param rows 
 * @param row 
 * @param stationaryRow 
 * @param newIndex 
 */
function handlePositionChange(barStatus: BarStatus, rowsContainer: HTMLDivElement, rows: StatusBarElement[], row: StatusBarElement, stationaryRow: HTMLDivElement, newIndex: number) {
  // Determine which other row was passed through dragging
  const passedEntry = rowsContainer.children[newIndex];
  const passedId = passedEntry.getAttribute("data-statusbar-organizer-id");
  const statusBarChangeRequired =
    barStatus[row.id].exists &&
    barStatus[passedId as string].exists;

  // Swap the positions of the two status bar elements
  if (statusBarChangeRequired && row.element) {
    const passedElement: HTMLElement = rows.filter(x => x.id == passedId)[0].element as HTMLElement;
    const temp = passedElement.style.order;
    passedElement.style.order = row.element.style.order;
    row.element.style.order = temp;
  }

  // Swap the position of the two menu rows
  rowsContainer.removeChild(stationaryRow);
  if (newIndex != rowsContainer.children.length)
    rowsContainer.insertBefore(stationaryRow, rowsContainer.children[newIndex]);
  else
    rowsContainer.appendChild(stationaryRow);

  // Update the positions in the settings
  for (const [entryIndex, entry] of Array.from(rowsContainer.children).entries())
    barStatus[entry.getAttribute("data-statusbar-organizer-id") as string].position = entryIndex;
}

/**
 * Handle dragging of rows in the settings menu.
 *
 * @param event 
 * @param plugin 
 * @param barStatus 
 * @param settingsContainer 
 * @param rowsContainer 
 * @param rows 
 * @param row 
 * @returns 
 */
function handleMouseDown(event: MouseEvent, plugin: StatusBarOrganizer, barStatus: BarStatus, settingsContainer: HTMLDivElement, rowsContainer: HTMLDivElement, rows: StatusBarElement[], row: StatusBarElement) {
  if (dragging) return;
  dragging = true;

  // Generate a draggable clone of the row
  let { stationaryRow, movableRow, offsetX, offsetY, index } = cloneRow(settingsContainer, barStatus, rowsContainer, event, row);

  //  Handle dragging
  function handleMouseMove(event: MouseEvent) {
    plugin.spooler.disableObserver();

    const newIndex = calculateRowIndex(event, rowsContainer, movableRow, stationaryRow, offsetX, offsetY, index);
    if (newIndex != index) {
      handlePositionChange(barStatus, rowsContainer, rows, row, stationaryRow, newIndex);
      index = newIndex;
    }

    plugin.spooler.enableObserver();
  }

  window.addEventListener('mousemove', handleMouseMove); 

  // Handle release
  async function handleMouseUp() {
    deleteRowClone(settingsContainer, stationaryRow, movableRow);

    dragging = false;

    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleMouseMove);

    savePreset(plugin, barStatus);
  }
  window.addEventListener('mouseup', handleMouseUp);
}