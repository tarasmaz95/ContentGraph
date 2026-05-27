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

const TRANSCRIPT_OUTCOME_MAP: Record<string, string> = {
  ok: "browserIngestion.outcome.transcript.ok",
  unavailable: "browserIngestion.outcome.transcript.unavailable",
  failed: "browserIngestion.outcome.transcript.failed",
  skipped: "browserIngestion.outcome.transcript.skipped",
};

const COMMENTS_OUTCOME_MAP: Record<string, string> = {
  ok: "browserIngestion.outcome.comments.ok",
  disabled: "browserIngestion.outcome.comments.disabled",
  empty: "browserIngestion.outcome.comments.empty",
  failed: "browserIngestion.outcome.comments.failed",
  skipped: "browserIngestion.outcome.comments.skipped",
};

export type OutcomeTone = "success" | "warning" | "neutral" | "danger";

export function transcriptOutcomeTone(outcome: string | null | undefined): OutcomeTone {
  switch (outcome) {
    case "ok":
      return "success";
    case "unavailable":
      return "neutral";
    case "failed":
      return "danger";
    case "skipped":
    default:
      return "neutral";
  }
}

export function commentsOutcomeTone(outcome: string | null | undefined): OutcomeTone {
  switch (outcome) {
    case "ok":
      return "success";
    case "disabled":
      return "warning";
    case "empty":
      return "neutral";
    case "failed":
      return "warning";
    case "skipped":
    default:
      return "neutral";
  }
}

const OUTCOME_TONE_CLASS: Record<OutcomeTone, string> = {
  success: "bg-green-500/15 text-green-700 dark:text-green-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground",
  danger: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function outcomeBadgeClass(tone: OutcomeTone): string {
  return OUTCOME_TONE_CLASS[tone];
}

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

export function friendlyTranscriptOutcome(
  outcome: string | null | undefined,
  t: LabelTranslate,
): string {
  return lookup(TRANSCRIPT_OUTCOME_MAP, outcome, t);
}

export function friendlyCommentsOutcome(
  outcome: string | null | undefined,
  t: LabelTranslate,
): string {
  return lookup(COMMENTS_OUTCOME_MAP, outcome, t);
}

export function isWorkerProcessing(
  phase: string | null | undefined,
  action: string | null | undefined,
): boolean {
  const p = (phase || action || "").toLowerCase();
  if (!p || p === "idle" || p === "paused") return false;
  return true;
}
