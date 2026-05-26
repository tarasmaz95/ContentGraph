"use client";

import { AlertTriangle, Lightbulb, Laptop } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function BrowserIngestionInfoCards() {
  const t = useT();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
        <CardContent className="flex gap-3 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
            <Laptop className="h-5 w-5 text-amber-700 dark:text-amber-300" />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">{t("browserIngestion.infoLaptopTitle")}</p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t("browserIngestion.infoLaptop1")}</li>
              <li>{t("browserIngestion.infoLaptop2")}</li>
              <li>{t("browserIngestion.infoLaptop3")}</li>
              <li>{t("browserIngestion.infoLaptop4")}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex gap-3 pt-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Lightbulb className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">{t("browserIngestion.infoWhyTitle")}</p>
            <p className="text-muted-foreground">{t("browserIngestion.infoWhyBody")}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 md:col-span-2">
        <CardContent className="flex gap-3 pt-5 text-sm text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>{t("browserIngestion.infoResidential")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
