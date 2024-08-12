let upgrades: Upgrades = new Map();

function ver(major: number, minor: number, patch: number) {
    return { major, minor, patch };
}
function parseVersion(version: string): Version {
    const [major, minor, patch] = version.split('.').map(x => Number.parseInt(x));
    return { major, minor, patch };
}

function registerUpdate(version: Version, upgrade: (settings: StatusBarOrganizerSettings) => void) {
    let majorCollection = upgrades.get(version.major);
    if (!majorCollection) {
        majorCollection = new Map();
        upgrades.set(version.major, majorCollection);
    }

    let minorCollection = majorCollection.get(version.minor);
    if (!minorCollection) {
        minorCollection = new Map();
        majorCollection.set(version.minor, minorCollection);
    }

    minorCollection.set(version.patch, upgrade);
}

function filterCollections(collection: Map<number, any>, threshold: number) {
    return [...collection.entries()].filter(x => x[0] >= threshold).sort((a, b) => a[0] - b[0]);
}

function getUpgradeList(upgrades: Upgrades, version: Version): VersionUpgrade[] {
    const upgradesList: VersionUpgrade[] = [];

    for (let majorUpgrades of filterCollections(upgrades, version.major)) {
        for (let minorUpgrades of filterCollections(majorUpgrades[1], version.minor)) {
            for (let [patch, upgrade] of filterCollections(minorUpgrades[1], version.patch)) {
                if (majorUpgrades[0] === version.major && minorUpgrades[0] === version.minor && patch === version.patch) {
                    continue;
                }
                upgradesList.push({ version: { major: majorUpgrades[0], minor: minorUpgrades[0], patch }, upgrade });
            }
        }
    }

    return upgradesList;
}

export function upgrade(settings: StatusBarOrganizerSettings) {
    const oldSettings = settings as any;
    let version;
    if ("version" in oldSettings) {
        version = parseVersion(oldSettings.version);
    } else {
        version = ver(0,0,0);
    }

    getUpgradeList(upgrades, version).forEach(x => x.upgrade(settings));
    settings.version = "CURRENT_VERSION";
}

// Backwards compatibility with versions < 2.0.0
// Add presets to settings
registerUpdate(ver(2,0,0), (settings: StatusBarOrganizerSettings) => {
    const oldSettings = settings as any;
    if ("status" in oldSettings) {
        oldSettings.presets.default = oldSettings.status;
        delete oldSettings.status;
        settings = oldSettings as StatusBarOrganizerSettings;
    }
});

// Backwards compatibility with versions < 2.1.1
// Remove exists property from elements
registerUpdate(ver(2,1,1), (settings: StatusBarOrganizerSettings) => {
    Object.entries(settings.presets).forEach(([preset, presetSettings]) => {
        Object.entries(presetSettings).forEach(([element, elementSettings]) => {
            delete (elementSettings as any)["exists"];
        });
    });
});