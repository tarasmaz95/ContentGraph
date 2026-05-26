const WIZARD_KEY = "contentgraph:browser-ingestion-wizard-v1";
const TOKEN_KEY = "contentgraph:browser-ingestion-worker-token";
const EXT_KEY_KEY = "contentgraph:browser-ingestion-extension-key";

export interface WizardProgress {
  completedSteps: number[];
  workerName: string;
}

export function getWizardProgress(): WizardProgress {
  if (typeof window === "undefined") {
    return { completedSteps: [], workerName: "home-laptop" };
  }
  try {
    const raw = localStorage.getItem(WIZARD_KEY);
    if (!raw) return { completedSteps: [], workerName: "home-laptop" };
    return JSON.parse(raw) as WizardProgress;
  } catch {
    return { completedSteps: [], workerName: "home-laptop" };
  }
}

export function saveWizardProgress(progress: WizardProgress): void {
  localStorage.setItem(WIZARD_KEY, JSON.stringify(progress));
}

export function markWizardStep(step: number): void {
  const p = getWizardProgress();
  if (!p.completedSteps.includes(step)) {
    p.completedSteps = [...p.completedSteps, step].sort((a, b) => a - b);
    saveWizardProgress(p);
  }
}

export function isWizardStepDone(step: number): boolean {
  return getWizardProgress().completedSteps.includes(step);
}

export function getStoredWorkerToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setStoredWorkerToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredExtensionKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(EXT_KEY_KEY) || "";
}

export function setStoredExtensionKey(key: string): void {
  localStorage.setItem(EXT_KEY_KEY, key);
}

export function isWizardComplete(workerOnline: boolean): boolean {
  const steps = getWizardProgress().completedSteps;
  const manual = [1, 2, 3, 4, 5, 6].every((s) => steps.includes(s));
  return manual && (workerOnline || steps.includes(7));
}
