import { BrowserWindow } from "electron";

// One job ending must not hide another job's progress. Values above one request
// native indeterminate progress; negative values clear the dock/taskbar.
export class DesktopProgress {
  private jobs = new Map<string, number>();
  constructor(private publish: (value: number) => void) {}
  set(id: string, value: number) {
    this.jobs.set(id, value);
    this.update();
  }
  clear(id: string) {
    this.jobs.delete(id);
    this.update();
  }
  clearOwner(owner: number) {
    for (const id of this.jobs.keys())
      if (id.startsWith(`${owner}:`)) this.jobs.delete(id);
    this.update();
  }
  private update() {
    const values = [...this.jobs.values()];
    const value = values.length ? Math.max(...values) : -1;
    try {
      this.publish(value);
    } catch {
      /* A dock can be absent or the window closing. */
    }
  }
  async run<T>(
    id: string,
    task: () => Promise<T>,
    progress?: () => Promise<number>,
  ) {
    this.set(id, 2);
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const value = await progress!();
        if (active && this.jobs.has(id)) this.set(id, value);
      } catch {
        /* The operation itself reports errors in the app. */
      }
      if (active && this.jobs.has(id)) timer = setTimeout(poll, 500);
    };
    if (progress) void poll();
    try {
      return await task();
    } finally {
      active = false;
      clearTimeout(timer);
      this.clear(id);
    }
  }
}
export const desktopProgress = new DesktopProgress((value) => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      try {
        window.setProgressBar(value);
      } catch {
        /* Unsupported desktop integration. */
      }
    }
  }
});
