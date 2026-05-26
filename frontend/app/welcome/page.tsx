"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileSpreadsheet,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";

import { InfoTip } from "@/components/ui/info-tip";
import { useT } from "@/lib/i18n";
import { completeOnboarding } from "@/lib/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function WelcomePage() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      {
        id: "welcome",
        title: t("welcome.title"),
        icon: Sparkles,
        body: (
          <>
            <p>{t("welcome.subtitle")}</p>
            <p className="text-muted-foreground">{t("welcome.tourHint")}</p>
          </>
        ),
      },
      {
        id: "sync",
        title: t("welcome.step1Title"),
        icon: FileSpreadsheet,
        body: (
          <>
            <p>{t("welcome.step1Desc")}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>{t("welcome.step1b1")}</li>
              <li>{t("welcome.step1b2")}</li>
              <li>{t("welcome.step1b3")}</li>
            </ul>
            <InfoTip term="sync" />
          </>
        ),
      },
      {
        id: "search",
        title: t("welcome.step2Title"),
        icon: MessageSquare,
        body: (
          <>
            <p>{t("welcome.step2Desc")}</p>
            <p className="text-sm text-muted-foreground">{t("welcome.step2Hint")}</p>
            <InfoTip term="semantic_search" />
            <InfoTip term="langgraph" />
          </>
        ),
      },
      {
        id: "workspaces",
        title: t("welcome.step3Title"),
        icon: Users,
        body: (
          <>
            <ul className="space-y-3 text-sm">
              <li>{t("welcome.step3c1")}</li>
              <li>{t("welcome.step3c2")}</li>
              <li>{t("welcome.step3c3")}</li>
              <li>{t("welcome.step3c4")}</li>
            </ul>
            <p className="text-muted-foreground">{t("welcome.step3Hint")}</p>
            <InfoTip term="copilot_panel" />
          </>
        ),
      },
      {
        id: "research",
        title: t("welcome.step4Title"),
        icon: BookOpen,
        body: (
          <>
            <p>{t("welcome.step4Desc")}</p>
            <p className="text-sm text-muted-foreground">{t("welcome.step4Hint")}</p>
            <InfoTip term="research_workspace" />
            <InfoTip term="intelligence_feed" />
          </>
        ),
      },
    ],
    [t],
  );

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  const finish = () => {
    completeOnboarding();
    router.push("/dashboard");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      <Card className="border-primary/20">
        <CardContent className="space-y-6 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
            <div className="space-y-3 text-sm leading-relaxed">{current.body}</div>
          </div>

          <div className="flex flex-wrap justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
            >
              {t("common.back")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={finish}>
                {t("welcome.skipToDashboard")}
              </Button>
              {isLast ? (
                <Button onClick={finish}>
                  <Check className="h-4 w-4" />
                  {t("welcome.startResearching")}
                </Button>
              ) : (
                <Button onClick={() => setStep((s) => s + 1)}>
                  {t("common.next")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">{t("welcome.reopenHint")}</p>
    </div>
  );
}
