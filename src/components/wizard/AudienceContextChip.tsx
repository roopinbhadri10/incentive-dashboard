import { Users } from "lucide-react";
import type { AudienceV2State } from "./builderState";

interface Props {
  audience: AudienceV2State;
}

/** "Building for: <division> · <role> · <region>" context chip shown across wizard steps. */
export function AudienceContextChip({ audience }: Props) {
  if (!audience.division || audience.roles.length === 0) return null;

  const division = audience.division;
  const role =
    audience.roles.length === 1
      ? audience.roles[0]
      : `${audience.roles[0]} +${audience.roles.length - 1}`;

  let region = "—";
  if (audience.geographies.length === 0) region = "No region";
  else if (audience.geographies.includes("All India")) region = "All regions";
  else if (audience.geographies.length === 1) region = audience.geographies[0];
  else region = `${audience.geographies[0]} +${audience.geographies.length - 1}`;

  if (audience.geographyExceptions.length > 0) {
    region += ` (−${audience.geographyExceptions.length})`;
  }

  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-medium">
      <Users size={11} />
      <span className="text-muted-foreground font-normal">Building for:</span>
      <span>{division}</span>
      <span className="opacity-50">·</span>
      <span>{role}</span>
      <span className="opacity-50">·</span>
      <span>{region}</span>
    </div>
  );
}
