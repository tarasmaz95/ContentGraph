import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { ComparePageClient } from "@/app/compare/compare-client";

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ComparePageClient />
    </Suspense>
  );
}
