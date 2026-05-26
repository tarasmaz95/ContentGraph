"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  Key,
  Puzzle,
  Settings,
  Terminal,
  Wifi,
} from "lucide-react";

import { CopyCodeBlock } from "@/components/browser-ingestion/copy-code-block";
import { CopyButton } from "@/components/convenience/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/convenience/toast-provider";
import {
  CHROME_EXTENSIONS_URL,
  EXTENSION_PAGE_URL,
  getApiBaseUrl,
  NPM_INSTALL_ONE_LINER,
  NPM_START_ONE_LINER,
  SETUP_COMMANDS_UNIX,
  SETUP_COMMANDS_WINDOWS,
  WORKER_ZIP_URL,
} from "@/lib/browser-ingestion-setup";
import {
  getStoredExtensionKey,
  getStoredWorkerToken,
  getWizardProgress,
  isWizardStepDone,
  markWizardStep,
  saveWizardProgress,
  setStoredExtensionKey,
  setStoredWorkerToken,
} from "@/lib/browser-ingestion-onboarding-storage";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { registerBrowserWorker } from "@/services/api";

const STEP_ICONS = [Download, Puzzle, Settings, Key, Key, Terminal, Wifi] as const;

export function SetupWizard({ workerOnline }: { workerOnline: boolean }) {
  const t = useT();
  const { showMessage } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [workerName, setWorkerName] = useState("home-laptop");
  const [extensionKey, setExtensionKey] = useState("");
  const [workerToken, setWorkerToken] = useState("");
  const [registering, setRegistering] = useState(false);
  const apiUrl = getApiBaseUrl();

  const refresh = useCallback(() => {
    const p = getWizardProgress();
    setWorkerName(p.workerName || "home-laptop");
    setExtensionKey(getStoredExtensionKey());
    setWorkerToken(getStoredWorkerToken());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, workerOnline]);

  useEffect(() => {
    if (workerOnline) markWizardStep(7);
  }, [workerOnline]);

  const stepDone = (n: number) => isWizardStepDone(n) || (n === 7 && workerOnline);

  const allDone = [1, 2, 3, 4, 5, 6, 7].every(stepDone);

  useEffect(() => {
    if (allDone && workerOnline) setExpanded(false);
  }, [allDone, workerOnline]);

  const handleRegisterToken = async () => {
    setRegistering(true);
    try {
      const res = await registerBrowserWorker(workerName.trim() || "home-laptop");
      setStoredWorkerToken(res.token);
      setWorkerToken(res.token);
      saveWizardProgress({
        ...getWizardProgress(),
        workerName: workerName.trim(),
      });
      markWizardStep(5);
      showMessage(t("browserIngestion.tokenGenerated"));
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : t("browserIngestion.tokenFailed"),
        "error",
      );
    } finally {
      setRegistering(false);
    }
  };

  const steps = [
    {
      n: 1,
      title: t("browserIngestion.wizard.step1Title"),
      desc: t("browserIngestion.wizard.step1Desc"),
      body: (
        <div className="space-y-3">
          <a
            href={WORKER_ZIP_URL}
            download
            onClick={() => markWizardStep(1)}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="mr-2 h-4 w-4" />
            {t("browserIngestion.wizard.downloadZip")}
          </a>
          <p className="text-xs text-muted-foreground">{t("browserIngestion.wizard.step1Hint")}</p>
        </div>
      ),
      onComplete: () => markWizardStep(1),
      completeLabel: t("browserIngestion.wizard.markDownloaded"),
    },
    {
      n: 2,
      title: t("browserIngestion.wizard.step2Title"),
      desc: t("browserIngestion.wizard.step2Desc"),
      body: (
        <div className="space-y-3">
          <Link
            href={EXTENSION_PAGE_URL}
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {t("browserIngestion.wizard.openExtensionGuide")}
          </Link>
          <CopyCodeBlock code={CHROME_EXTENSIONS_URL} label={t("browserIngestion.wizard.chromeUrl")} />
        </div>
      ),
      onComplete: () => markWizardStep(2),
      completeLabel: t("browserIngestion.wizard.markInstalled"),
    },
    {
      n: 3,
      title: t("browserIngestion.wizard.step3Title"),
      desc: t("browserIngestion.wizard.step3Desc"),
      body: (
        <p className="text-sm text-muted-foreground">{t("browserIngestion.wizard.step3Body")}</p>
      ),
      onComplete: () => markWizardStep(3),
      completeLabel: t("browserIngestion.wizard.markSettingsOpen"),
    },
    {
      n: 4,
      title: t("browserIngestion.wizard.step4Title"),
      desc: t("browserIngestion.wizard.step4Desc"),
      body: (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("browserIngestion.wizard.apiUrl")}
            </span>
            <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{apiUrl}</code>
            <CopyButton text={apiUrl} label={t("browserIngestion.copy")} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("browserIngestion.wizard.extensionKey")}
            </label>
            <div className="mt-1 flex gap-2">
              <Input
                value={extensionKey}
                onChange={(e) => setExtensionKey(e.target.value)}
                placeholder={t("browserIngestion.wizard.extensionKeyPlaceholder")}
                className="font-mono text-sm"
              />
              <CopyButton
                text={extensionKey}
                label={t("browserIngestion.copy")}
                variant="outline"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("browserIngestion.wizard.extensionKeyHint")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setStoredExtensionKey(extensionKey);
              markWizardStep(4);
              refresh();
            }}
          >
            {t("browserIngestion.wizard.saveExtensionKey")}
          </Button>
        </div>
      ),
    },
    {
      n: 5,
      title: t("browserIngestion.wizard.step5Title"),
      desc: t("browserIngestion.wizard.step5Desc"),
      body: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t("browserIngestion.wizard.workerName")}
            </label>
            <Input
              className="mt-1"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="home-laptop"
            />
          </div>
          <Button onClick={() => void handleRegisterToken()} disabled={registering}>
            {registering
              ? t("browserIngestion.wizard.generating")
              : t("browserIngestion.wizard.generateToken")}
          </Button>
          {workerToken && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                {t("browserIngestion.wizard.tokenReady")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="max-w-full truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                  {workerToken}
                </code>
                <CopyButton text={workerToken} label={t("browserIngestion.copyToken")} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("browserIngestion.wizard.tokenEnvHint")}
              </p>
            </div>
          )}
        </div>
      ),
    },
    {
      n: 6,
      title: t("browserIngestion.wizard.step6Title"),
      desc: t("browserIngestion.wizard.step6Desc"),
      body: (
        <div className="space-y-4">
          <CopyCodeBlock
            code={SETUP_COMMANDS_UNIX}
            label={t("browserIngestion.wizard.macosLinux")}
          />
          <CopyCodeBlock code={SETUP_COMMANDS_WINDOWS} label={t("browserIngestion.wizard.windows")} />
          <div className="flex flex-wrap gap-2">
            <CopyButton
              text={NPM_INSTALL_ONE_LINER}
              label={t("browserIngestion.wizard.copyInstall")}
            />
            <CopyButton text={NPM_START_ONE_LINER} label={t("browserIngestion.wizard.copyStart")} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              markWizardStep(6);
              refresh();
            }}
          >
            {t("browserIngestion.wizard.markCommandsRun")}
          </Button>
        </div>
      ),
    },
    {
      n: 7,
      title: t("browserIngestion.wizard.step7Title"),
      desc: t("browserIngestion.wizard.step7Desc"),
      body: (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            workerOnline
              ? "border-emerald-500/40 bg-emerald-500/10"
              : "border-border bg-muted/30",
          )}
        >
          {workerOnline ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <Wifi className="h-8 w-8 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">
              {workerOnline
                ? t("browserIngestion.wizard.verifySuccess")
                : t("browserIngestion.wizard.verifyWaiting")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("browserIngestion.wizard.verifyHint")}
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Card
      id="browser-ingestion-setup"
      className="scroll-mt-20 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card shadow-lg"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl">{t("browserIngestion.wizard.title")}</CardTitle>
            <CardDescription className="mt-1">{t("browserIngestion.wizard.subtitle")}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {allDone && !expanded && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {t("browserIngestion.wizard.allComplete")}
          </p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {steps.map((step) => {
            const Icon = STEP_ICONS[step.n - 1] ?? Circle;
            const done = stepDone(step.n);
            return (
              <div
                key={step.n}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  done
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border bg-card/50",
                )}
              >
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      done ? "bg-emerald-500/20 text-emerald-700" : "bg-primary/10 text-primary",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("browserIngestion.wizard.stepLabel", { n: String(step.n) })}
                      </p>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.desc}</p>
                    </div>
                    {step.body}
                    {step.onComplete && step.completeLabel && !done && (
                      <Button variant="outline" size="sm" onClick={step.onComplete}>
                        {step.completeLabel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
