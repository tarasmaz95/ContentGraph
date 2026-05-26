type BriefingT = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** Maps raw hook_type / taxonomy strings to i18n keys (display only). */
const HOOK_LABEL_KEYS: Record<string, string> = {
  emotional: "compare.hookLabel.emotional",
  numbers: "compare.hookLabel.numbers",
  general: "compare.hookLabel.general",
  identity: "compare.hookLabel.identity",
  authority: "compare.hookLabel.authority",
  curiosity: "compare.hookLabel.curiosity",
  how_to: "compare.hookLabel.how_to",
  "how-to": "compare.hookLabel.how_to",
  listicle: "compare.hookLabel.listicle",
  controversy: "compare.hookLabel.controversy",
  "transformation:from_to": "compare.hookLabel.transformation_from_to",
  transformation_from_to: "compare.hookLabel.transformation_from_to",
  "transformation:become": "compare.hookLabel.transformation_become",
  transformation_become: "compare.hookLabel.transformation_become",
  "urgency:watch_this": "compare.hookLabel.urgency_watch_this",
  urgency_watch_this: "compare.hookLabel.urgency_watch_this",
  "urgency:stop": "compare.hookLabel.urgency_stop",
  urgency_stop: "compare.hookLabel.urgency_stop",
  "curiosity:question": "compare.hookLabel.curiosity_question",
  curiosity_question: "compare.hookLabel.curiosity_question",
};

function normalizeHookKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Single hook taxonomy token → plain label. */
export function humanizeHookType(raw: string, t: BriefingT): string {
  const key = normalizeHookKey(raw);
  const i18nKey = HOOK_LABEL_KEYS[key] ?? HOOK_LABEL_KEYS[key.replace(/:/g, "_")];
  if (i18nKey) return t(i18nKey);
  return raw
    .replace(/[:_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Comma-separated hook list from API. */
export function humanizeHookList(raw: string, t: BriefingT): string {
  return raw
    .split(",")
    .map((part) => humanizeHookType(part.trim(), t))
    .filter(Boolean)
    .join(", ");
}

/** Title battle metadata line — hook type only, no curiosity score jargon. */
export function formatTitleMeta(
  hookType: string,
  titleLength: number,
  t: BriefingT,
): string {
  return t("compare.titleMeta", {
    hook: humanizeHookType(hookType, t),
    length: titleLength,
  });
}

/** Topic overlap from 0–1 score. */
export function formatTopicOverlapMessage(
  overlapScore: number,
  t: BriefingT,
): string {
  const pct = Math.round(overlapScore * 100);
  if (pct >= 40) {
    return t("compare.topicOverlap.high", { pct });
  }
  if (pct >= 15) {
    return t("compare.topicOverlap.medium", { pct });
  }
  return t("compare.topicOverlap.low", { pct });
}

/** Detect flat growth row in overview (display helper). */
export function isGrowthLikelyFlat(
  overviewRows: { signal: string; value_a: string; value_b: string }[],
): boolean {
  const row = overviewRows.find((r) => r.signal === "growth_7d_pct");
  if (!row) return false;
  const flat = (v: string) =>
    v === "0.0%" || v === "0%" || v === "—" || v === "0";
  return flat(row.value_a) && flat(row.value_b);
}
