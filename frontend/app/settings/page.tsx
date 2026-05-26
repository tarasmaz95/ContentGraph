"use client";

import { AppSettingsPanel } from "@/components/settings/app-settings-panel";
import { PageHeader } from "@/components/ui/page-header";
import { useT } from "@/lib/i18n";

export default function SettingsPage() {
  const t = useT();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-12">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />
      <AppSettingsPanel />
    </div>
  );
}
