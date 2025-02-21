import StatusBarOrganizer from "../main";
import { consolidateSettingsAndElements, savePreset } from "./menu";
import { setIcon } from "obsidian";

let dragging: boolean;

/**
 * Set up the rows in the settings menu.
 * 
 * @param plugin 
 * @param settingsContainer 
 * @returns 
 */
export async function initializeRows(plugin: StatusBarOrganizer, settingsContainer: HTMLDivElement) {
  settingsContainer.empty();
  dragging = false;

  // Get a definite list of menu row entries
  const { rows, barStatus, existsStatus } = await consolidateSettingsAndElements(plugin);

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
    const currentExists = existsStatus[row.id];

    const entry = document.createElement("div");
    entry.addClass("statusbar-organizer-row");
    if (!currentExists) entry.addClass("statusbar-organizer-row-disabled");
    if (!currentStatus.visible) entry.addClass("statusbar-organizer-row-hidden");
    entry.setAttribute("data-statusbar-organizer-id", row.id);
    row.entry = entry;
    rowsContainer.appendChild(entry);
    
    const handle = document.createElement("span");
    handle.addClass("statusbar-organizer-row-handle");
    handle.addEventListener("mousedown", (event) => 
      handleMouseDown(event, plugin, barStatus, existsStatus, settingsContainer, rowsContainer, rows, row)
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
    titleSpan.addClass("statusbar-organizer-row-title");
    titleSpan.textContent = formattedName;
    entry.appendChild(titleSpan);

    const previewSpan = document.createElement("span");
    previewSpan.addClass("statusbar-organizer-row-preview");
    if (currentExists) {
      previewSpan.innerHTML = (row.element as Element).innerHTML;
    }
    entry.appendChild(previewSpan);

    const visibilitySpan = document.createElement("span");
    visibilitySpan.addClass("statusbar-organizer-row-visibility");
    visibilitySpan.onclick = (() => {
      if (currentExists) toggleVisibility(plugin, barStatus, row);
      else removeOrphan(plugin, rowsContainer, barStatus, row);
    });
    setIcon(visibilitySpan, currentExists ? (currentStatus.visible ? "eye" : "eye-off") : "trash-2");
    entry.appendChild(visibilitySpan);
  }

  return {
    rows: rows,
    barStatus: barStatus,
    rowsContainer: rowsContainer
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
function cloneRow(
  settingsContainer: HTMLDivElement,
  barStatus: BarStatus,
  existsStatus: ExistsStatus,
  rowsContainer: HTMLDivElement,
  event: MouseEvent,
  row: StatusBarElement
):{
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
  if (!existsStatus[row.id]) fauxEntry.addClass("statusbar-organizer-row-disabled");
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
function handlePositionChange(
  barStatus: BarStatus,
  existsStatus: ExistsStatus,
  rowsContainer: HTMLDivElement,
  rows: StatusBarElement[],
  row: StatusBarElement,
  stationaryRow: HTMLDivElement,
  newIndex: number
) {
  // Determine which other row was passed through dragging
  const passedEntry = rowsContainer.children[newIndex];
  const passedId = passedEntry.getAttribute("data-statusbar-organizer-id");
  const statusBarChangeRequired =
    existsStatus[row.id] &&
    existsStatus[passedId as string];

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
function handleMouseDown(
  event: MouseEvent,
  plugin: StatusBarOrganizer,
  barStatus: BarStatus,
  existsStatus: ExistsStatus,
  settingsContainer: HTMLDivElement,
  rowsContainer: HTMLDivElement,
  rows: StatusBarElement[],
  row: StatusBarElement
) {
  if (dragging) return;
  dragging = true;

  // Generate a draggable clone of the row
  let { stationaryRow, movableRow, offsetX, offsetY, index } = cloneRow(settingsContainer, barStatus, existsStatus, rowsContainer, event, row);

  //  Handle dragging
  function handleMouseMove(event: MouseEvent) {
    plugin.spooler.disableObserver();

    const newIndex = calculateRowIndex(event, rowsContainer, movableRow, stationaryRow, offsetX, offsetY, index);
    if (newIndex != index) {
      handlePositionChange(barStatus, existsStatus, rowsContainer, rows, row, stationaryRow, newIndex);
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