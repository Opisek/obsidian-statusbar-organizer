import StatusBarOrganizer from "main";
import { fixOrder } from "./organizer";
import { switchPreset } from "./presets";

function commandCallback(plugin: StatusBarOrganizer, index: number) {
    return (checking: boolean) => {
        const presets = plugin.settings.presetsOrder;

        if (presets.length <= index) return false;
        if (!checking) {
            switchPreset(plugin, presets[index]);
            fixOrder(plugin);
        }
    }
}

export async function registerHotkeys(plugin: StatusBarOrganizer, presetNames: string[]) {
    for (const [i, preset] of presetNames.entries()) {
        plugin.addCommand({
            id: `statusbar-organizer-preset-${i}`,
            name: `Switch to preset "${preset}"`,
            checkCallback: commandCallback(plugin, i)
        });
    }
}