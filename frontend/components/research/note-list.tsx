import { Trash2 } from "lucide-react";

import type { ResearchNote } from "@/types/research";
import { Button } from "@/components/ui/button";

interface NoteListProps {
  notes: ResearchNote[];
  onDelete?: (id: number) => void;
}

export function NoteList({ notes, onDelete }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="text-sm text-muted-foreground">No research notes yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium">{note.title}</h3>
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(note.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {note.creator_name && (
            <p className="text-xs text-primary">Creator: {note.creator_name}</p>
          )}
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {note.content}
          </p>
          {note.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
