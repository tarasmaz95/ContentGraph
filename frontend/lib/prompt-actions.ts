"use client";

import type { ExamplePrompt } from "@/lib/prompts";
import { trackSearch } from "@/lib/personalization";

/** Run an example prompt — chat, keyword, or semantic route */
/** Navigate based on prompt action — chat, keyword, or semantic */
export function runExamplePrompt(
  router: { push: (href: string) => void },
  prompt: ExamplePrompt,
): void {
  trackSearch(prompt.text);
  if (prompt.action === "chat") {
    router.push(`/chat?q=${encodeURIComponent(prompt.text)}`);
    return;
  }
  if (prompt.action === "semantic") {
    router.push(`/dashboard?semantic=${encodeURIComponent(prompt.text)}`);
    return;
  }
  router.push(`/dashboard?q=${encodeURIComponent(prompt.text)}`);
}
