import type { CreatorProfile } from "@/types/creator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CreatorProfileViewProps {
  profile: CreatorProfile;
}

/** AI-generated creator intelligence — style, themes, hooks, audience */
export function CreatorProfileView({ profile }: CreatorProfileViewProps) {
  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base">Strategic Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{profile.creator_summary}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TagCard title="Content Style" items={[profile.content_style]} single />
        <TagCard title="Communication Style" items={[profile.communication_style]} single />
        <TagCard title="Audience Targeting" items={[profile.audience_type]} single />
        <TagCard title="Common Themes" items={profile.top_topics} />
        <TagCard title="Hook Preferences" items={profile.hook_patterns} />
        <TagCard title="Emotional Patterns" items={profile.emotional_triggers} />
      </div>
    </div>
  );
}

function TagCard({
  title,
  items,
  single = false,
}: {
  title: string;
  items: string[];
  single?: boolean;
}) {
  const filtered = items.filter(Boolean);
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : single ? (
          <p className="text-sm">{filtered[0]}</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {filtered.map((item) => (
              <span key={item} className="rounded bg-muted px-2 py-0.5 text-xs">
                {item}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
