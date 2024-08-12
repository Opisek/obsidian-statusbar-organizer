type StatusBarElement = {
  name: string;
  index: number;
  id: string;
  element?: HTMLElement;
  entry?: HTMLDivElement;
};

type StatusBarElementStatus = {
  position: number;
  visible: boolean;
}

type BarStatus = {
  [key: string]: StatusBarElementStatus
}

type ExistsStatus = {
  [key: string]: boolean
}

interface StatusBarOrganizerSettings {
  activePreset: string;
	activeFullscreenPreset: string,
	separateFullscreenPreset: boolean,
  presets: { [key: string]: BarStatus }
  presetsOrder: string[];
}

type ElectronWindow = {
  addListener: (event: string, callback: () => void) => void;
  isFullScreen: () => boolean;
}