/**
 * Centralized example prompts — used in empty states, chips, and ⌘K palette.
 */

export type PromptPage =
  | "dashboard"
  | "creators"
  | "creator"
  | "hooks"
  | "scripts"
  | "videos"
  | "video"
  | "research"
  | "feed"
  | "chat"
  | "audience"
  | "semantic";

export interface ExamplePrompt {
  label: string;
  /** Chat query or search string */
  text: string;
  /** Where to run the prompt */
  action: "chat" | "search" | "semantic";
}

export const PAGE_PROMPTS: Record<PromptPage, ExamplePrompt[]> = {
  dashboard: [
    { label: "Trending topics", text: "What topics are trending in my catalog?", action: "chat" },
    { label: "Top hooks", text: "Which hook types perform best overall?", action: "chat" },
    { label: "Semantic: discipline", text: "videos about discipline", action: "semantic" },
  ],
  creators: [
    { label: "Dan Koe success", text: "What makes Dan Koe successful?", action: "chat" },
    { label: "Compare creators", text: "Compare Dan Koe vs Hormozi", action: "chat" },
    { label: "Communication style", text: "What communication style works best?", action: "chat" },
  ],
  creator: [
    { label: "Profile deep dive", text: "Analyze this creator's content style and hooks", action: "chat" },
    { label: "Best hooks", text: "What hook types work best for this creator?", action: "chat" },
    { label: "Generate hooks", text: "Generate 10 curiosity hooks for this creator", action: "chat" },
  ],
  hooks: [
    { label: "AI video hooks", text: "Which hooks perform best for AI videos?", action: "chat" },
    { label: "Curiosity patterns", text: "Show curiosity hook patterns with highest avg views", action: "chat" },
    { label: "Search: identity", text: "identity transformation", action: "search" },
  ],
  scripts: [
    { label: "Dan Koe discipline", text: "Generate a Dan Koe script about discipline", action: "chat" },
    { label: "10-min philosophical", text: "Write a 10 minute philosophical script about focus", action: "chat" },
    { label: "Analyze style", text: "Analyze this creator's speaking and transcript style", action: "chat" },
  ],
  videos: [
    { label: "Why viral", text: "Why did this video go viral?", action: "chat" },
    { label: "Transcript themes", text: "What are the key themes in this transcript?", action: "chat" },
    { label: "Audience view", text: "What does the audience think about this video?", action: "chat" },
  ],
  video: [
    { label: "Viral breakdown", text: "Why did this video perform well?", action: "chat" },
    { label: "Reusable framework", text: "What reusable frameworks appear in this video?", action: "chat" },
    { label: "Similar videos", text: "Find videos similar to this one", action: "semantic" },
  ],
  research: [
    { label: "Save comparison", text: "Compare my top two creators and summarize for research", action: "chat" },
    { label: "Viral patterns", text: "What viral patterns should I document?", action: "chat" },
    { label: "Hook opportunities", text: "What hook opportunities are underused?", action: "chat" },
  ],
  feed: [
    { label: "Today's trends", text: "Summarize today's viral trends in my feed", action: "chat" },
    { label: "Rising keywords", text: "Which keywords are rising fastest?", action: "chat" },
    { label: "Audience signals", text: "What audience reactions matter most right now?", action: "chat" },
  ],
  chat: [
    { label: "Dan Koe", text: "What makes Dan Koe successful?", action: "chat" },
    { label: "Compare", text: "Compare Dan Koe vs Hormozi", action: "chat" },
    { label: "Hooks", text: "Which curiosity hooks generate highest engagement?", action: "chat" },
    { label: "Audience pain", text: "What audience pain points appear most in comments?", action: "chat" },
  ],
  audience: [
    { label: "Pain points", text: "What audience pain points appear most?", action: "chat" },
    { label: "Confusion themes", text: "Where is audience confusion highest?", action: "chat" },
    { label: "Comment sentiment", text: "Summarize comment sentiment for video", action: "chat" },
  ],
  semantic: [
    { label: "Discipline", text: "videos about discipline", action: "semantic" },
    { label: "Identity", text: "identity transformation", action: "semantic" },
    { label: "AI productivity", text: "AI productivity mindset", action: "semantic" },
  ],
};

/** Flat list for command palette search */
export function allExamplePrompts(): ExamplePrompt[] {
  const seen = new Set<string>();
  const out: ExamplePrompt[] = [];
  for (const list of Object.values(PAGE_PROMPTS)) {
    for (const p of list) {
      if (!seen.has(p.text)) {
        seen.add(p.text);
        out.push(p);
      }
    }
  }
  return out;
}
