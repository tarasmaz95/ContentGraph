/**
 * Onboarding completion flag — localStorage, no auth.
 */

const KEY = "contentgraph_onboarding_v1";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) === "done";
}

export function completeOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, "done");
}

export function resetOnboarding(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
