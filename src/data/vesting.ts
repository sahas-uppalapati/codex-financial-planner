import templateData from "./vestingTemplates.json" with { type: "json" };
import type { VestingRow } from "../lib/planner";

export interface VestingTemplate {
  id: string;
  label: string;
  source: string;
  note: string;
  schedule: VestingRow[];
}

export const vestingTemplates: VestingTemplate[] = templateData.map(({ segments, ...metadata }) => ({
  ...metadata,
  schedule: segments.flatMap(({ firstMonth, cadence, count, totalPercent }) =>
    Array.from({ length: count }, (_, index) => ({
      month: String(firstMonth + index * cadence),
      percent: String(totalPercent / count),
    })),
  ),
}));

export function templateSchedule(id: string): VestingRow[] {
  const template = vestingTemplates.find((t) => t.id === id);
  if (!template) throw new RangeError("Choose a supported vesting template");
  return template.schedule.map((r) => ({ ...r }));
}
