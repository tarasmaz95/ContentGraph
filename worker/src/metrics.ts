const sessionStart = Date.now();

export function uptimeSeconds(): number {
  return Math.floor((Date.now() - sessionStart) / 1000);
}

export function memoryMb(): number {
  const mem = process.memoryUsage();
  return Math.round((mem.rss / 1024 / 1024) * 10) / 10;
}

export interface MemoryWatch {
  baselineRss: number;
  jobsSinceBaseline: number;
}

export function createMemoryWatch(): MemoryWatch {
  return {
    baselineRss: process.memoryUsage().rss,
    jobsSinceBaseline: 0,
  };
}

/** Suggest browser restart if RSS grew sharply over several jobs (old laptop protection). */
export function shouldRestartForMemory(
  watch: MemoryWatch,
  jobsSinceRestart: number,
): boolean {
  watch.jobsSinceBaseline += 1;
  const rss = process.memoryUsage().rss;
  const growthMb = (rss - watch.baselineRss) / 1024 / 1024;
  if (growthMb > 400 && watch.jobsSinceBaseline >= 5) {
    return true;
  }
  if (jobsSinceRestart >= 25 && growthMb > 200) {
    return true;
  }
  return false;
}

export function resetMemoryWatch(watch: MemoryWatch): void {
  watch.baselineRss = process.memoryUsage().rss;
  watch.jobsSinceBaseline = 0;
}
