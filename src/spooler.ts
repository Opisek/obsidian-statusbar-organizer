import StatusBarOrganizer from "../main";

export default class Spooler {
  plugin: StatusBarOrganizer;
  mutex: boolean;
  spooler: number;
  observer: MutationObserver;
  callback: (plugin: StatusBarOrganizer) => void;

  constructor(plugin: StatusBarOrganizer, callback: (plugin: StatusBarOrganizer) => void) {
    // Technically the mutex part is not necessary, since JavaScript
    // is single-threaded, but this way it's future-proof.
    this.plugin = plugin;
    this.mutex = false;
    this.spooler = 0;
    this.callback = callback;

    this.observer = new MutationObserver((list, _) => {
      if (
        !this.mutex
        && list.some(
          mutation => mutation.type == "childList"
          && mutation.addedNodes.length > 0
        )
      ) {
        this.spoolFix(0);
      }
    });

    this.spoolFix(5000);
  }

  /**
   * Disable automatic spooling.
   */
  disableObserver() {
    this.observer.disconnect();
  }

  /**
   * Enable automatic spooling.
   */
  enableObserver() {
    this.observer.observe(this.plugin.statusBar, { childList: true });
  }

  /**
   * Schedule status bar elements to be reordered.
   * 
   * @param timeout 
   */
  spoolFix(timeout: number = 1000) {
    clearTimeout(this.spooler);

    this.spooler =
      window.setTimeout(() => {
        if (this.mutex) {
          this.spoolFix();
        } else {
          this.mutex = true;
          this.disableObserver();

          this.callback(this.plugin);

          this.enableObserver();
          this.mutex = false;
        }
      }, timeout);
  }
}