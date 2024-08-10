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
  exists: boolean;
}

type BarStatus = {
  [key: string]: StatusBarElementStatus
}

interface StatusBarOrganizerSettings {
  activePreset: string;
	activeFullscreenPreset: string,
	separateFullscreenPreset: boolean,
  presets: { [key: string]: BarStatus }
  presetsOrder: string[];
}