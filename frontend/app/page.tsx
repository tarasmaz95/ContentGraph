"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

import { useT } from "@/lib/i18n";
import { isOnboardingComplete } from "@/lib/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Landing — routes new users to onboarding */
export default function HomePage() {
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!isOnboardingComplete()) {
      router.replace("/welcome");
    }
  }, [router]);

  const quickLinks = [
    ["/dashboard", t("home.dashboard")],
    ["/feed", t("home.intelligenceFeed")],
    ["/creators", t("home.creators")],
    ["/chat", t("home.copilotChat")],
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {t("home.title")}
        </h1>
        <p className="text-muted-foreground leading-relaxed">{t("home.subtitle")}</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("home.openWorkspace")}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/welcome"
          className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-accent"
        >
          <Sparkles className="h-4 w-4" />
          {t("home.tutorial")}
        </Link>
      </div>

      <Card className="text-left">
        <CardHeader>
          <CardTitle className="text-base">{t("home.quickLinks")}</CardTitle>
          <CardDescription>{t("home.quickLinksDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {quickLinks.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
            >
              {label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
