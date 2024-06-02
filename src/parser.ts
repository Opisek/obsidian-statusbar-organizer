const ignoredClasses = [
  "mod-clickable",
  "status-bar-item",
  "statusbar-organizer-hidden"
];

/**
 * Return list of status bar elements.
 * 
 * @returns {StatusBarElement[]}
 */
export function getStatusBarElements(statusBar: Element): StatusBarElement[] {
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
      element: element as HTMLElement
    });
  });

  return elements;
}

/**
 * Generate an internal ID for a status bar element.
 * 
 * @param name 
 * @param index 
 * @returns 
 */
export function generateId(name: string, index: number): string {
  return `${name};${index}`;
}

/**
 * Deserialize an internal status bar ID into its parts.
 * 
 * @param id 
 * @returns 
 */
export function parseId(id: string): { name: string, index: number } {
  const parts = id.split(';');
  const index = Number.parseInt(parts.pop() as string);
  const name = parts.join(';');

  return {
    name: name,
    index: index
  };
}