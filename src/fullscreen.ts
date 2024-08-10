import StatusBarOrganizer from "main";
import { getActivePreset } from "./presets";
import { fixOrder } from "./organizer";

export function moniterFullscreen(plugin: StatusBarOrganizer) {
    document.addEventListener("fullscreenchange", fullscreenChange(plugin));
}

function fullscreenChange(plugin: StatusBarOrganizer) {
    console.log("full screen change!");

    const settings = plugin.settings;

    return () => {
        if (!settings.separateFullscreenPreset || !(getActivePreset(plugin) in settings.presets)) {
            if (isFullscreen()) settings.activeFullscreenPreset = settings.activePreset;
            else settings.activePreset = settings.activeFullscreenPreset;

            fixOrder(plugin);
            plugin.saveSettings();
        }
    }
}

export function isFullscreen(): boolean {
    return document.fullscreenElement !== null;
}