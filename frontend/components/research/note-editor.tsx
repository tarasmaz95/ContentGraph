"use client";

import { useState } from "react";

import { createResearchNote } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NoteEditorProps {
  onCreated: () => void;
  defaultCreator?: string;
}

/** Simple form to create a research note with optional creator link */
export function NoteEditor({ onCreated, defaultCreator = "" }: NoteEditorProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creator, setCreator] = useState(defaultCreator);
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      await createResearchNote({
        title: title.trim(),
        content: content.trim(),
        type: creator ? "creator_finding" : "general",
        creator_name: creator.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setTitle("");
      setContent("");
      setTags("");
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Research Note</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Your findings, observations, next steps..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Input
          placeholder="Creator name (optional)"
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
        />
        <Input
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
        <Button onClick={() => void submit()} disabled={loading}>
          Add Note
        </Button>
      </CardContent>
    </Card>
  );
}
