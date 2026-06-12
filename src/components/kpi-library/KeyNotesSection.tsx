import { Plus, Trash2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  /** Section number prefix shown in the label, e.g. "7" */
  index?: number | string;
  notes: string[];
  onChange: (next: string[]) => void;
}

export function KeyNotesSection({ index, notes, onChange }: Props) {
  const update = (i: number, v: string) =>
    onChange(notes.map((n, idx) => (idx === i ? v : n)));
  const add = () => onChange([...notes, ""]);
  const remove = (i: number) => onChange(notes.filter((_, idx) => idx !== i));

  return (
    <section className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <NotebookPen size={12} /> {index ? `${index} · ` : ""}Key notes (visible in the app)
      </Label>
      <p className="text-[11px] text-muted-foreground">
        Short bullets shown to the field user — what this KPI is and how it's calculated.
      </p>
      <div className="space-y-1.5">
        {notes.map((n, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 text-muted-foreground">•</span>
            <Input
              value={n}
              onChange={(e) => update(i, e.target.value)}
              placeholder="Add a short note…"
              className="h-8 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={add}>
        <Plus size={12} /> Add note
      </Button>
    </section>
  );
}
