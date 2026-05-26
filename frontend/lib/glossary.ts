/**
 * Short explainers for tooltips and welcome — keeps UX self-documenting.
 */

export const GLOSSARY: Record<string, string> = {
  semantic_search:
    "Finds videos by meaning using embeddings — works across titles and transcripts, not just keywords.",
  hook_intelligence:
    "Extracts and ranks hook patterns from titles and transcripts so you can see what drives views.",
  creator_profile:
    "AI summary of a creator's style, topics, hooks, and positioning from their video catalog.",
  langgraph:
    "Routes your question to the right analysis, retrieves relevant videos, then returns structured insights.",
  research_workspace:
    "Save insights and notes from any page — export as markdown for your creator research.",
  intelligence_feed:
    "Daily ideas for what to study — from videos and comments already in your workspace.",
  copilot_panel:
    "Context-aware sidebar with smart insights, briefs, and recommended next steps.",
  sync:
    "Pulls rows from Google Sheets into Postgres, then enriches embeddings, transcripts, hooks, and comments.",
};
