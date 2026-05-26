/**
 * Lightweight personalization — localStorage only, no user accounts.
 *
 * Tracks recent searches, viewed creators/videos, and saved insight tags
 * to improve copilot recommendations.
 */

const KEY = "contentgraph_personalization";

export interface PersonalizationState {
  recent_searches: string[];
  viewed_creators: string[];
  saved_tags: string[];
  viewed_video_ids: number[];
}

const EMPTY: PersonalizationState = {
  recent_searches: [],
  viewed_creators: [],
  saved_tags: [],
  viewed_video_ids: [],
};

function readState(): PersonalizationState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as PersonalizationState;
    return {
      recent_searches: parsed.recent_searches ?? [],
      viewed_creators: parsed.viewed_creators ?? [],
      saved_tags: parsed.saved_tags ?? [],
      viewed_video_ids: parsed.viewed_video_ids ?? [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function writeState(state: PersonalizationState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

function pushUnique<T>(list: T[], item: T, max: number): T[] {
  const next = [item, ...list.filter((x) => x !== item)];
  return next.slice(0, max);
}

/** Record a semantic or keyword search */
export function trackSearch(query: string): void {
  const q = query.trim();
  if (!q) return;
  const s = readState();
  s.recent_searches = pushUnique(s.recent_searches, q, 12);
  writeState(s);
}

/** Record creator profile view */
export function trackCreatorView(creatorName: string): void {
  const name = creatorName.trim();
  if (!name) return;
  const s = readState();
  s.viewed_creators = pushUnique(s.viewed_creators, name, 10);
  writeState(s);
}

/** Record video intelligence page view */
export function trackVideoView(videoId: number): void {
  const s = readState();
  s.viewed_video_ids = pushUnique(s.viewed_video_ids, videoId, 15);
  writeState(s);
}

/** Merge tags from saved insights */
export function trackSavedTags(tags: string[]): void {
  const s = readState();
  for (const tag of tags) {
    s.saved_tags = pushUnique(s.saved_tags, tag, 20);
  }
  writeState(s);
}

/** Payload for copilot panel POST */
export function getPersonalizationPayload(): PersonalizationState {
  return readState();
}
