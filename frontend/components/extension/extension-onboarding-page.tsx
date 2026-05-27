"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Chrome,
  Download,
  FileText,
  MessageSquare,
  Puzzle,
  RefreshCw,
  Search,
} from "lucide-react";

import { CopyButton } from "@/components/convenience/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EXTENSION_META_PATH,
  EXTENSION_ZIP_PATH,
  formatBytes,
  formatMetaDate,
  type ExtensionMeta,
} from "@/lib/extension-download";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CHROME_EXTENSIONS_URL = "chrome://extensions";

function PlaceholderFrame({ label }: { label: string }) {
  return (
    <div
      className="flex h-28 items-center justify-center rounded-md border border-dashed bg-muted/30 px-4 text-center text-xs text-muted-foreground"
      aria-hidden
    >
      {label}
    </div>
  );
}

function StepCard({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {n}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

/** Internal onboarding for Chrome extension install + workflows */
export function ExtensionOnboardingPage() {
  const t = useT();
  const [meta, setMeta] = useState<ExtensionMeta | null>(null);

  useEffect(() => {
    void fetch(EXTENSION_META_PATH)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMeta(data as ExtensionMeta | null))
      .catch(() => setMeta(null));
  }, []);

  const version = meta?.version ?? "0.1.0";
  const sizeLabel = meta ? formatBytes(meta.sizeBytes) : "—";
  const updatedLabel = meta ? formatMetaDate(meta.updatedAt) : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 pb-16">
      <PageHeader
        icon={Puzzle}
        title={t("extension.title")}
        description={t("extension.subtitle")}
      />

      {/* Hero bullets */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-2 pt-6 text-sm">
          <p>{t("extension.heroLead")}</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            <li>{t("extension.heroB1")}</li>
            <li>{t("extension.heroB2")}</li>
            <li>{t("extension.heroB3")}</li>
          </ul>
        </CardContent>
      </Card>

      {/* Download — sticky on md+ */}
      <section
        id="download"
        className={cn(
          "scroll-mt-20 rounded-lg border bg-card p-5 shadow-sm",
          "md:sticky md:top-[4.5rem] md:z-10",
        )}
      >
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Download className="h-5 w-5 text-primary" />
          {t("extension.downloadTitle")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">{t("extension.downloadDesc")}</p>

        <dl className="mb-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("extension.version")}</dt>
            <dd className="font-mono font-medium">{version}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("extension.updated")}</dt>
            <dd className="text-xs sm:text-sm">{updatedLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("extension.size")}</dt>
            <dd>{sizeLabel}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <a
            href={EXTENSION_ZIP_PATH}
            download="contentgraph-extension.zip"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            {t("extension.downloadBtn")}
          </a>
          <CopyButton text={version} label={t("extension.copyVersion")} variant="outline" />
          <CopyButton
            text={CHROME_EXTENSIONS_URL}
            label={t("extension.copyChromeUrl")}
            variant="ghost"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("extension.releaseTitle")}</h2>
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("extension.releaseHeading")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
              <li>{t("extension.releaseB1")}</li>
              <li>{t("extension.releaseB2")}</li>
              <li>{t("extension.releaseB3")}</li>
              <li>{t("extension.releaseB4")}</li>
              <li>{t("extension.releaseB5")}</li>
              <li>{t("extension.releaseB6")}</li>
              <li>{t("extension.releaseB7")}</li>
              <li>{t("extension.releaseB8")}</li>
              <li>{t("extension.releaseB9")}</li>
              <li>{t("extension.releaseB10")}</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Chrome install */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Chrome className="h-5 w-5" />
          {t("extension.installTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <StepCard n={1} title={t("extension.installS1")}>
            <p>{t("extension.installS1Desc")}</p>
          </StepCard>
          <StepCard n={2} title={t("extension.installS2")}>
            <p>{t("extension.installS2Desc")}</p>
          </StepCard>
          <StepCard n={3} title={t("extension.installS3")}>
            <p>
              {t("extension.installS3Desc")}{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">chrome://extensions</code>
            </p>
            <PlaceholderFrame label={t("extension.placeholderExtensions")} />
          </StepCard>
          <StepCard n={4} title={t("extension.installS4")}>
            <p>{t("extension.installS4Desc")}</p>
          </StepCard>
          <StepCard n={5} title={t("extension.installS5")}>
            <p>{t("extension.installS5Desc")}</p>
            <PlaceholderFrame label={t("extension.placeholderLoadUnpacked")} />
          </StepCard>
          <StepCard n={6} title={t("extension.installS6")}>
            <p>{t("extension.installS6Desc")}</p>
            <p className="text-xs">{t("extension.installApiHint")}</p>
          </StepCard>
        </div>
      </section>

      {/* Transcript workflow */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5" />
          {t("extension.transcriptTitle")}
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("extension.transcript1")}</li>
          <li>{t("extension.transcript2")}</li>
          <li>{t("extension.transcript3")}</li>
          <li>{t("extension.transcript4")}</li>
          <li>{t("extension.transcript5")}</li>
        </ol>
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
            <p>{t("extension.transcriptNote1")}</p>
            <p>{t("extension.transcriptNote2")}</p>
          </CardContent>
        </Card>
      </section>

      {/* Comments workflow */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" />
          {t("extension.commentsTitle")}
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>{t("extension.comments1")}</li>
          <li>{t("extension.comments2")}</li>
          <li>{t("extension.comments3")}</li>
        </ol>
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-muted-foreground">
            <p>{t("extension.commentsNote1")}</p>
            <p>{t("extension.commentsNote2")}</p>
            <p>{t("extension.commentsNote3")}</p>
          </CardContent>
        </Card>
      </section>

      {/* Troubleshooting */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AlertCircle className="h-5 w-5" />
          {t("extension.troubleshootTitle")}
        </h2>
        <ul className="space-y-3">
          {(
            [
              "trouble1",
              "trouble2",
              "trouble3",
              "trouble4",
              "trouble5",
              "trouble6",
            ] as const
          ).map((key) => (
            <li
              key={key}
              className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              {t(`extension.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {/* Verification */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          {t("extension.verifyTitle")}
        </h2>
        <Card>
          <CardHeader>
            <CardDescription>{t("extension.verifyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-inside list-disc space-y-2 text-muted-foreground">
              <li>
                {t("extension.verify1")}{" "}
                <Link href="/dashboard" className="text-primary underline">
                  /dashboard
                </Link>
              </li>
              <li>
                {t("extension.verify2")}{" "}
                <code className="rounded bg-muted px-1 text-xs">/videos/&#123;id&#125;</code>{" "}
                or{" "}
                <code className="rounded bg-muted px-1 text-xs">/transcripts/&#123;id&#125;</code>
              </li>
              <li>{t("extension.verify3")}</li>
              <li>{t("extension.verify4")}</li>
              <li className="flex items-start gap-2">
                <Search className="mt-0.5 h-4 w-4 shrink-0" />
                {t("extension.verify5")}
              </li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/feed"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
              >
                {t("nav.feed")}
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
              >
                {t("extension.trySemantic")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" />
        {t("extension.footerHint")}
      </p>
    </div>
  );
}
