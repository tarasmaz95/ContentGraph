"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";

import { AiThinking } from "@/components/ai/ai-thinking";
import { ChatIntro } from "@/components/chat/chat-intro";
import { StructuredPanel } from "@/components/analytics/structured-panel";
import { SaveInsightButton } from "@/components/research/save-insight-button";
import { PageHeader } from "@/components/ui/page-header";
import { PromptChips } from "@/components/ui/prompt-chips";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { formatChatForSave } from "@/lib/research-format";
import { getAnalysisTypeLabel, getPagePrompts, useLocale, useT } from "@/lib/i18n";
import { trackSearch } from "@/lib/personalization";
import { sendChatMessage } from "@/services/api";
import type { ChatMessage } from "@/types/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function ChatPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const t = useT();
  const { locale } = useLocale();
  const pagePrompts = getPagePrompts(locale).chat;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setInput(q);
  }, [searchParams]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    trackSearch(trimmed);
    setLastSuggestions([]);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(trimmed);
      setLastSuggestions(response.suggestions ?? []);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.reply,
          analysis_type: response.analysis_type,
          relevant_videos: response.relevant_videos,
          insights: response.insights,
          structured: response.structured,
          suggestions: response.suggestions,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("chat.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={MessageSquare}
        title={t("chat.title")}
        description={t("chat.description")}
        helpKey="langgraph"
      />

      <ChatIntro />

      <PromptChips
        prompts={pagePrompts}
        onSelect={(p) => void sendMessage(p.text)}
        disabled={loading}
      />

      <Card className="min-h-[400px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("chat.conversation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {messages.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t("chat.conversationHint")}
            </p>
          )}

          {messages.map((msg, i) => (
            <div key={`${msg.role}-${i}`}>
              {msg.role === "user" ? (
                <div className="ml-auto max-w-[85%] rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {msg.content}
                </div>
              ) : (
                <AssistantReply message={msg} />
              )}
            </div>
          ))}

          {loading && <AiThinking />}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {lastSuggestions.length > 0 && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("common.suggestedFollowUps")}
          </p>
          <PromptChips
            prompts={lastSuggestions.map((text) => ({
              label: text.length > 48 ? `${text.slice(0, 48)}…` : text,
              text,
              action: "chat" as const,
            }))}
            onSelect={(p) => void sendMessage(p.text)}
            disabled={loading}
          />
        </div>
      )}

      <form
        className="sticky bottom-0 flex gap-2 border-t bg-background/95 py-3 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
      >
        <Input
          placeholder={t("chat.placeholder")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function AssistantReply({ message }: { message: ChatMessage }) {
  const t = useT();
  const { locale } = useLocale();
  const typeLabel = message.analysis_type
    ? getAnalysisTypeLabel(locale, message.analysis_type)
    : "";

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm animate-in">
      {message.insights && message.insights.length > 0 && (
        <div className="rounded-md bg-primary/5 px-3 py-2">
          <p className="mb-2 text-xs font-semibold uppercase text-primary">
            {t("chat.keyInsights")}
          </p>
          <ul className="space-y-1 text-sm">
            {message.insights.slice(0, 6).map((insight) => (
              <li key={insight} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message.structured && <StructuredPanel structured={message.structured} />}

      {message.relevant_videos && message.relevant_videos.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {t("chat.sources", {
              count: message.relevant_videos.length,
              type: typeLabel,
            })}
          </p>
          <div className="max-h-28 overflow-y-auto rounded border text-xs">
            {message.relevant_videos.slice(0, 6).map((v) => (
              <div key={v.id} className="border-b px-2 py-2 last:border-0">
                <span className="font-medium">{v.creator_name}</span>
                <span className="text-muted-foreground"> — {v.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
          {t("common.summary")}
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        <SaveInsightButton
          insightText={formatChatForSave(message)}
          sourceType="chat"
          sourceReference={message.analysis_type ?? "chat"}
          tags={[message.analysis_type ?? "chat"]}
        />
      </div>
    </div>
  );
}
