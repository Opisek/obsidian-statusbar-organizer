import StatusBarOrganizer from "main";
import { getActivePreset } from "./presets";
import { fixOrder } from "./organizer";

declare let electronWindow: ElectronWindow;

let menuListener: () => void;

export function monitorFullscreen(plugin: StatusBarOrganizer) {
    (electronWindow as ElectronWindow).addListener("enter-full-screen", fullscreenChange(plugin));
    (electronWindow as ElectronWindow).addListener("leave-full-screen", fullscreenChange(plugin));
    fullscreenChange(plugin)();
}

function fullscreenChange(plugin: StatusBarOrganizer) {
    return async () => {
        const settings = plugin.settings;
        if (!settings.separateFullscreenPreset || !(getActivePreset(plugin) in settings.presets)) {
            if (isFullscreen()) settings.activeFullscreenPreset = settings.activePreset;
            else settings.activePreset = settings.activeFullscreenPreset;
            await plugin.saveSettings();
        }
        fixOrder(plugin);
        menuListener?.();
    }
}

export function isFullscreen(): boolean {
    // @ts-ignore
    return (electronWindow as ElectronWindow).isFullScreen();
}

export function setFullscreenListener(callback: () => void) {
    menuListener = callback;
}