import { log } from "./logger.js";
import { config } from "./config.js";

export class WatchdogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WatchdogError";
  }
}

export class JobWatchdog {
  private lastProgress = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private rejectStuck: ((err: Error) => void) | null = null;

  touch(label?: string): void {
    this.lastProgress = Date.now();
    if (label) {
      log.debug("watchdog progress", { action: label });
    }
  }

  start(): void {
    this.lastProgress = Date.now();
    this.timer = setInterval(() => {
      const idleMs = Date.now() - this.lastProgress;
      if (idleMs >= config.stuckPageMs && this.rejectStuck) {
        log.error("watchdog: page stuck", { idle_ms: idleMs });
        this.rejectStuck(
          new WatchdogError(`No progress for ${Math.round(idleMs / 1000)}s`),
        );
        this.rejectStuck = null;
      }
    }, 3000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.rejectStuck = null;
  }

  race<T>(work: Promise<T>): Promise<T> {
    this.start();
    return new Promise<T>((resolve, reject) => {
      this.rejectStuck = (err) => reject(err);
      work.then(resolve, reject).finally(() => this.stop());
    });
  }
}
