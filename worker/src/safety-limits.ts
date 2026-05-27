import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type { FailureCategory } from "./failure-taxonomy.js";
import { log } from "./logger.js";

export interface SafetyState {
  day: string;
  processedToday: number;
  consecutiveFailures: number;
  cooldownUntil: string | null;
  lastSuccessAt: string | null;
}

/**
 * Soft failure categories never increment the consecutive-failure counter and
 * never trigger a cooldown — they describe content (no captions, comments off),
 * not infrastructure problems with the worker / browser / YouTube access.
 */
const SOFT_FAILURE_CATEGORIES = new Set<FailureCategory>([
  "comments_disabled",
  "transcript_unavailable",
]);

export function isSoftFailureCategory(category: FailureCategory | undefined): boolean {
  return category !== undefined && SOFT_FAILURE_CATEGORIES.has(category);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function statePath(): string {
  return path.join(config.stateDir, "safety-state.json");
}

function defaultState(): SafetyState {
  return {
    day: todayKey(),
    processedToday: 0,
    consecutiveFailures: 0,
    cooldownUntil: null,
    lastSuccessAt: null,
  };
}

export function loadSafetyState(): SafetyState {
  const file = statePath();
  if (!fs.existsSync(file)) {
    return defaultState();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as SafetyState;
    if (raw.day !== todayKey()) {
      return {
        ...defaultState(),
        lastSuccessAt: raw.lastSuccessAt,
      };
    }
    return raw;
  } catch {
    return defaultState();
  }
}

export function saveSafetyState(state: SafetyState): void {
  fs.mkdirSync(config.stateDir, { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
}

export interface SafetyCheck {
  canClaim: boolean;
  status: "online" | "daily_limit" | "cooldown";
  reason?: string;
  state: SafetyState;
}

export function checkSafetyLimits(state: SafetyState): SafetyCheck {
  const now = Date.now();

  if (state.cooldownUntil) {
    const until = Date.parse(state.cooldownUntil);
    if (Number.isFinite(until) && now < until) {
      return {
        canClaim: false,
        status: "cooldown",
        reason: `Cooldown until ${state.cooldownUntil}`,
        state,
      };
    }
    state.cooldownUntil = null;
    state.consecutiveFailures = 0;
    saveSafetyState(state);
  }

  if (config.maxJobsPerDay > 0 && state.processedToday >= config.maxJobsPerDay) {
    return {
      canClaim: false,
      status: "daily_limit",
      reason: `Daily limit ${config.maxJobsPerDay} reached`,
      state,
    };
  }

  return { canClaim: true, status: "online", state };
}

export function recordJobSuccess(state: SafetyState): SafetyState {
  const next: SafetyState = {
    ...state,
    day: todayKey(),
    processedToday: state.processedToday + 1,
    consecutiveFailures: 0,
    lastSuccessAt: new Date().toISOString(),
  };
  saveSafetyState(next);
  return next;
}

export function clearCooldown(state?: SafetyState): SafetyState {
  const base = state ?? loadSafetyState();
  const next: SafetyState = {
    ...base,
    consecutiveFailures: 0,
    cooldownUntil: null,
  };
  saveSafetyState(next);
  return next;
}

export function recordJobFailure(
  state: SafetyState,
  category?: FailureCategory,
): SafetyState {
  // Soft failures count toward processedToday but never bump the cooldown counter.
  if (isSoftFailureCategory(category)) {
    const next: SafetyState = {
      ...state,
      day: todayKey(),
      processedToday: state.processedToday + 1,
    };
    saveSafetyState(next);
    return next;
  }

  const failures = state.consecutiveFailures + 1;
  let cooldownUntil = state.cooldownUntil;
  if (
    config.maxConsecutiveFailures > 0 &&
    failures >= config.maxConsecutiveFailures
  ) {
    const until = new Date(Date.now() + config.cooldownMinutes * 60_000);
    cooldownUntil = until.toISOString();
    log.warn("safety cooldown triggered", {
      failures,
      category,
      cooldown_until: cooldownUntil,
    });
  }
  const next: SafetyState = {
    ...state,
    day: todayKey(),
    processedToday: state.processedToday + 1,
    consecutiveFailures: failures,
    cooldownUntil,
  };
  saveSafetyState(next);
  return next;
}
