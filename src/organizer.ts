import StatusBarOrganizer from "../main";
import { getStatusBarElements } from "./parser";

export function fixOrder(plugin: StatusBarOrganizer) {
  const elements = getStatusBarElements(plugin.statusBar);
  const status = plugin.settings.presets[plugin.settings.activePreset];

  // Elements with known position
  const known = [];

  // Elements which were not seen before
  const orphans = [];

  // Split elements into known and unknown
  for (const element of elements) {
    if (element.id in status) {
      const myStatus = status[element.id];
      known.push([element, myStatus.position]);
      if (myStatus.visible)
        (element.element as HTMLDivElement).removeClass("statusbar-organizer-element-hidden");
      else
        (element.element as HTMLDivElement).addClass("statusbar-organizer-element-hidden");
    } else {
      orphans.push(element.element);
    }
  }

  // Sort known elements by position set in the settings and extract their HTML elements
  const orderedElements = known
    .sort((a: [any, number], b: [any, number]) => a[1] - b[1])
    .map((x: [StatusBarElement, any]) => x[0].element);

  // Append orphans to the end
  const allElements = orderedElements.concat(orphans);

  // Reorder elements according to their position in the list
  for (const [i, element] of allElements.entries()) (element as HTMLElement).style.order = (i + 1).toString();
}