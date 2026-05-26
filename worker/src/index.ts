import {
  claimJob,
  completeJob,
  failJob,
  heartbeat,
  releaseJob,
  type HeartbeatPayload,
  type JobResult,
} from "./api-client.js";
import {
  captureFailureScreenshot,
  processVideoOnPage,
} from "./extension-ui.js";
import {
  closeBrowser,
  getPage,
  incrementJobsSinceRestart,
  maybePeriodicRestart,
  recoverBrowserSession,
} from "./browser-session.js";
import { config, validateConfig } from "./config.js";
import { checkExtensionCompatibility, readExtensionVersion } from "./extension-compat.js";
import {
  categorizeFailure,
  isRetryableCategory,
  type FailureCategory,
} from "./failure-taxonomy.js";
import { log } from "./logger.js";
import {
  createMemoryWatch,
  memoryMb,
  resetMemoryWatch,
  shouldRestartForMemory,
  uptimeSeconds,
} from "./metrics.js";
import {
  checkSafetyLimits,
  clearCooldown,
  loadSafetyState,
  recordJobFailure,
  recordJobSuccess,
  type SafetyState,
} from "./safety-limits.js";
import { JobWatchdog, WatchdogError } from "./watchdog.js";

function randomDelay(): number {
  const min = config.jobDelayMinMs;
  const max = config.jobDelayMaxMs;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  validateConfig();
  log.info("worker starting", { api: config.apiUrl });

  let safetyState = loadSafetyState();
  let successToday = 0;
  let failedToday = 0;
  const sessionStart = Date.now();
  let currentAction = "idle";
  let currentPhase = "idle";
  let currentJobId: number | null = null;
  let currentVideoUrl: string | null = null;
  let lastScreenshot: string | null = null;
  let extensionVersion = readExtensionVersion();
  let workerStatus: HeartbeatPayload["status"] = "online";
  let restartRecommended = false;
  const memoryWatch = createMemoryWatch();
  let jobsCompletedSession = 0;

  const buildHeartbeat = (): HeartbeatPayload => {
    const elapsedH = Math.max((Date.now() - sessionStart) / 3_600_000, 0.01);
    const processed = safetyState.processedToday;
    const jobsPerMin = Math.round((processed / Math.max(elapsedH * 60, 0.1)) * 10) / 10;
    const safety = checkSafetyLimits(safetyState);
    return {
      status: workerStatus === "online" && !safety.canClaim ? safety.status : workerStatus,
      current_action: currentAction,
      current_phase: currentPhase,
      current_job_id: currentJobId,
      current_video_url: currentVideoUrl,
      processed_today: safetyState.processedToday,
      success_today: successToday,
      failed_today: failedToday,
      jobs_per_min: jobsPerMin,
      consecutive_failures: safetyState.consecutiveFailures,
      max_jobs_per_day: config.maxJobsPerDay,
      daily_limit_reached:
        config.maxJobsPerDay > 0 && safetyState.processedToday >= config.maxJobsPerDay,
      cooldown_until: safetyState.cooldownUntil,
      extension_version: extensionVersion,
      required_extension_version: config.requiredExtensionVersion,
      memory_mb: memoryMb(),
      uptime_seconds: uptimeSeconds(),
      last_screenshot_path: lastScreenshot,
      last_success_at: safetyState.lastSuccessAt,
      restart_recommended: restartRecommended,
      processed_per_hour: Math.round(processed / elapsedH),
    };
  };

  const sendHeartbeat = async () => {
    try {
      const res = await heartbeat(buildHeartbeat());
      if (res?.clear_local_cooldown) {
        safetyState = clearCooldown(safetyState);
        if (workerStatus === "cooldown") {
          workerStatus = "online";
        }
        log.info("cooldown cleared from server request");
      }
    } catch (err) {
      log.warn("heartbeat failed", { error: String(err) });
    }
  };

  setInterval(() => void sendHeartbeat(), config.heartbeatIntervalMs);

  let page = await getPage();
  const compat = await checkExtensionCompatibility(page);
  extensionVersion = compat.extensionVersion;
  if (!compat.ok) {
    workerStatus = "incompatible_extension";
    log.error("extension incompatible", { reason: compat.reason });
    await sendHeartbeat();
    console.error(compat.reason);
    console.error("Fix extension version/DOM and restart worker.");
    await sleep(60_000);
    process.exit(1);
  }

  await sendHeartbeat();

  async function recoverFromCrash(jobId: number | null, reason: string): Promise<void> {
    log.warn("recovery started", { job_id: jobId, reason });
    currentAction = "recovering";
    currentPhase = "recovering";
    if (jobId) {
      try {
        await releaseJob(jobId, `Recovery requeue: ${reason}`);
      } catch (err) {
        log.error("release job failed", { job_id: jobId, error: String(err) });
      }
    }
    try {
      page = await recoverBrowserSession();
      const recheck = await checkExtensionCompatibility(page);
      extensionVersion = recheck.extensionVersion;
      if (!recheck.ok) {
        workerStatus = "incompatible_extension";
      } else {
        workerStatus = "online";
      }
    } catch (err) {
      log.error("recovery failed", { error: String(err) });
      await sleep(10_000);
    }
    currentJobId = null;
    currentVideoUrl = null;
    currentAction = "idle";
    currentPhase = "idle";
  }

  while (true) {
    try {
      safetyState = loadSafetyState();
      const safety = checkSafetyLimits(safetyState);
      if (!safety.canClaim) {
        workerStatus = safety.status;
        currentAction = safety.reason || safety.status;
        await sendHeartbeat();
        await sleep(30_000);
        continue;
      }
      workerStatus = "online";

      if (restartRecommended) {
        page = await recoverBrowserSession();
        resetMemoryWatch(memoryWatch);
        restartRecommended = false;
      }

      const periodic = await maybePeriodicRestart();
      if (periodic) page = periodic;

      const { job, run_paused } = await claimJob();
      if (run_paused) {
        currentAction = "paused";
        currentPhase = "paused";
        await sleep(5000);
        continue;
      }
      if (!job) {
        currentAction = "idle";
        currentPhase = "idle";
        currentJobId = null;
        currentVideoUrl = null;
        await sleep(3000);
        continue;
      }

      currentJobId = job.id;
      currentVideoUrl = job.video_url;
      currentAction = "opening_youtube";
      currentPhase = "navigation";
      log.info("job started", { job_id: job.id, url: job.video_url });

      const jobLogs: string[] = [];
      const retryHistory: string[] = [];
      const jobStarted = Date.now();
      const watchdog = new JobWatchdog();

      try {
        const result = await watchdog.race(
          processVideoOnPage(
            page,
            job.video_url,
            job.mode,
            (action) => {
              currentAction = action;
              currentPhase = action;
              watchdog.touch(action);
            },
            watchdog,
          ),
        );

        result.duration_ms = result.duration_ms ?? Date.now() - jobStarted;
        await completeJob(job.id, result);
        safetyState = recordJobSuccess(safetyState);
        successToday += 1;
        jobsCompletedSession += 1;
        incrementJobsSinceRestart();
        log.info("job success", { job_id: job.id, duration_ms: result.duration_ms });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const category: FailureCategory = categorizeFailure(message);
        jobLogs.push(message);
        retryHistory.push(`${new Date().toISOString()} ${category}: ${message}`);

        const screenshot = await captureFailureScreenshot(page, job.id);
        if (screenshot) lastScreenshot = screenshot;

        const result: JobResult = {
          logs: jobLogs,
          screenshot_path: screenshot,
          failure_category: category,
          duration_ms: Date.now() - jobStarted,
          current_phase: currentPhase,
          retry_history: retryHistory,
          transcript_status: "error",
        };

        const retryable = isRetryableCategory(category);
        await failJob(job.id, message.slice(0, 4000), result, retryable);
        safetyState = recordJobFailure(safetyState);
        failedToday += 1;
        jobsCompletedSession += 1;
        incrementJobsSinceRestart();

        log.error("job failed", {
          job_id: job.id,
          category,
          error: message,
          retryable,
        });

        const needsRecovery =
          err instanceof WatchdogError ||
          category === "browser_crash" ||
          category === "timeout" ||
          message.includes("Target closed") ||
          message.includes("Browser has been closed");

        if (needsRecovery) {
          await recoverFromCrash(null, message);
        }
      }

      if (shouldRestartForMemory(memoryWatch, jobsCompletedSession)) {
        restartRecommended = true;
        log.warn("memory restart recommended", { memory_mb: memoryMb() });
      }

      const periodicAfter = await maybePeriodicRestart();
      if (periodicAfter) page = periodicAfter;

      currentJobId = null;
      currentVideoUrl = null;
      currentAction = "idle";
      currentPhase = "idle";
      await sendHeartbeat();
      await sleep(randomDelay());
    } catch (err) {
      log.error("loop error", { error: String(err) });
      await recoverFromCrash(null, String(err));
    }
  }
}

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

main().catch((err) => {
  log.error("fatal", { error: String(err) });
  process.exit(1);
});
