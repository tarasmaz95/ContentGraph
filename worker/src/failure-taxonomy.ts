export type FailureCategory =
  | "youtube_blocked"
  | "transcript_unavailable"
  | "comments_disabled"
  | "extension_error"
  | "browser_crash"
  | "timeout"
  | "unknown";

export function categorizeFailure(message: string): FailureCategory {
  const m = message.toLowerCase();

  if (
    m.includes("target closed") ||
    m.includes("browser has been closed") ||
    m.includes("browser crash") ||
    m.includes("session closed")
  ) {
    return "browser_crash";
  }

  if (
    m.includes("timeout") ||
    m.includes("stuck") ||
    m.includes("watchdog") ||
    m.includes("navigation")
  ) {
    return "timeout";
  }

  if (
    m.includes("sign in") ||
    m.includes("blocked") ||
    m.includes("not available in your country") ||
    m.includes("confirm you're not a bot")
  ) {
    return "youtube_blocked";
  }

  if (
    m.includes("no transcript") ||
    m.includes("transcript unavailable") ||
    m.includes("captions are disabled") ||
    m.includes("no captions")
  ) {
    return "transcript_unavailable";
  }

  if (
    m.includes("comments are turned off") ||
    m.includes("comments disabled") ||
    m.includes("comments unavailable") ||
    m.includes("no comments found") ||
    m.includes("no comments")
  ) {
    return "comments_disabled";
  }

  if (
    m.includes("extension") ||
    m.includes("cg-transcript-panel") ||
    m.includes("data-action") ||
    m.includes("incompatible")
  ) {
    return "extension_error";
  }

  if (m.includes("age-restricted") || m.includes("age restricted")) {
    return "youtube_blocked";
  }

  return "unknown";
}

export function isRetryableCategory(category: FailureCategory): boolean {
  return (
    category === "timeout" ||
    category === "browser_crash" ||
    category === "extension_error" ||
    category === "unknown"
  );
}
