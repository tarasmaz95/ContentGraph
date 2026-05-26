/** Human-readable labels for worker phases, actions, and job statuses. */

export type LabelTranslate = (
  key: string,
  params?: Record<string, string>,
) => string;

const PHASE_MAP: Record<string, string> = {
  idle: "browserIngestion.phase.idle",
  paused: "browserIngestion.phase.paused",
  opening_youtube: "browserIngestion.phase.openingYoutube",
  navigation: "browserIngestion.phase.openingYoutube",
  wait_panel: "browserIngestion.phase.openingYoutube",
  extracting_transcript: "browserIngestion.phase.extractingTranscript",
  saving_transcript: "browserIngestion.phase.savingTranscript",
  extracting_comments: "browserIngestion.phase.extractingComments",
  saving_comments: "browserIngestion.phase.savingComments",
  recovering: "browserIngestion.phase.restartingChrome",
  click_extract_transcript: "browserIngestion.phase.extractingTranscript",
  click_save_transcript: "browserIngestion.phase.savingTranscript",
  click_extract_comments: "browserIngestion.phase.extractingComments",
  click_save_comments: "browserIngestion.phase.savingComments",
};

const ACTION_MAP: Record<string, string> = {
  idle: "browserIngestion.phase.idle",
  paused: "browserIngestion.phase.paused",
  opening_youtube: "browserIngestion.phase.openingYoutube",
  extracting_transcript: "browserIngestion.phase.extractingTranscript",
  saving_transcript: "browserIngestion.phase.savingTranscript",
  extracting_comments: "browserIngestion.phase.extractingComments",
  saving_comments: "browserIngestion.phase.savingComments",
  recovering: "browserIngestion.phase.restartingChrome",
  cooldown: "browserIngestion.phase.cooldown",
  daily_limit: "browserIngestion.phase.dailyLimit",
};

const JOB_STATUS_MAP: Record<string, string> = {
  queued: "browserIngestion.jobStatus.queued",
  processing: "browserIngestion.jobStatus.processing",
  success: "browserIngestion.jobStatus.success",
  failed: "browserIngestion.jobStatus.failed",
  skipped: "browserIngestion.jobStatus.skipped",
};

const HEALTH_MAP: Record<string, string> = {
  healthy: "browserIngestion.healthLabel.healthy",
  offline: "browserIngestion.healthLabel.offline",
  incompatible_extension: "browserIngestion.healthLabel.extensionOutdated",
  daily_limit: "browserIngestion.healthLabel.dailyLimit",
  cooldown: "browserIngestion.healthLabel.cooldown",
  restart_recommended: "browserIngestion.healthLabel.restartRecommended",
  unknown: "browserIngestion.healthLabel.unknown",
};

const FAILURE_MAP: Record<string, string> = {
  youtube_blocked: "browserIngestion.failureFriendly.youtube_blocked",
  transcript_unavailable: "browserIngestion.failureFriendly.transcript_unavailable",
  comments_disabled: "browserIngestion.failureFriendly.comments_disabled",
  extension_error: "browserIngestion.failureFriendly.extension_error",
  browser_crash: "browserIngestion.failureFriendly.browser_crash",
  timeout: "browserIngestion.failureFriendly.timeout",
  unknown: "browserIngestion.failureFriendly.unknown",
};

function lookup(map: Record<string, string>, raw: string | null | undefined, t: LabelTranslate): string {
  if (!raw) return "";
  const key = map[raw.toLowerCase().trim()];
  return key ? t(key) : raw.replace(/_/g, " ");
}

export function friendlyPhase(raw: string | null | undefined, t: LabelTranslate): string {
  const label = lookup(PHASE_MAP, raw, t);
  return label || t("browserIngestion.phase.working");
}

export function friendlyAction(raw: string | null | undefined, t: LabelTranslate): string {
  const label = lookup(ACTION_MAP, raw, t);
  return label || friendlyPhase(raw, t);
}

export function friendlyJobStatus(status: string, t: LabelTranslate): string {
  return lookup(JOB_STATUS_MAP, status, t) || status;
}

export function friendlyHealth(health: string, t: LabelTranslate): string {
  return lookup(HEALTH_MAP, health, t) || health;
}

export function friendlyFailure(category: string | null | undefined, t: LabelTranslate): string {
  if (!category) return "";
  return lookup(FAILURE_MAP, category, t) || category;
}

export function isWorkerProcessing(
  phase: string | null | undefined,
  action: string | null | undefined,
): boolean {
  const p = (phase || action || "").toLowerCase();
  if (!p || p === "idle" || p === "paused") return false;
  return true;
}
