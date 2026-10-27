import type { VestingRow } from "../lib/planner";
export interface VestingTemplate {
  id: string;
  label: string;
  source: string;
  note: string;
  schedule: VestingRow[];
}
const row = (month: number, percent: number): VestingRow => ({
  month: String(month),
  percent: String(percent),
});
const even = (cadence: number, years = 4) =>
  Array.from({ length: (years * 12) / cadence }, (_, i) =>
    row((i + 1) * cadence, 100 / ((years * 12) / cadence)),
  );
const weighted = (weights: number[], cadence: number) =>
  weights.flatMap((weight, year) =>
    Array.from({ length: 12 / cadence }, (_, i) =>
      row(year * 12 + (i + 1) * cadence, weight / (12 / cadence)),
    ),
  );
const levels = "https://www.levels.fyi/blog/unique-vesting-schedules.html";
export const vestingTemplates: VestingTemplate[] = [
  {
    id: "annual",
    label: "4 years · 25% annually (Microsoft-style)",
    source:
      "https://www.levels.fyi/companies/microsoft/salaries/software-engineer",
    note: "Reported annual template; other Microsoft schedules exist.",
    schedule: even(12),
  },
  {
    id: "monthly",
    label: "4 years · monthly, no cliff",
    source: levels,
    note: "Even monthly distribution; customizable planning template.",
    schedule: even(1),
  },
  {
    id: "quarterly",
    label: "4 years · quarterly (Meta-style)",
    source: "https://www.levels.fyi/companies/meta/salaries/software-engineer",
    note: "Reported 6.25% quarterly template, not a promise of offer terms.",
    schedule: even(3),
  },
  {
    id: "semiannual",
    label: "4 years · semiannual (Apple-style)",
    source: "https://www.levels.fyi/companies/apple/salaries/software-engineer",
    note: "Reported 12.5% semiannual template; confirm your grant.",
    schedule: even(6),
  },
  {
    id: "cliff-monthly",
    label: "1-year cliff · then monthly",
    source: levels,
    note: "25% after month 12, then 1/48 monthly.",
    schedule: [
      row(12, 25),
      ...Array.from({ length: 36 }, (_, i) => row(13 + i, 75 / 36)),
    ],
  },
  {
    id: "cliff-quarterly",
    label: "1-year cliff · then quarterly",
    source:
      "https://www.levels.fyi/companies/microsoft/salaries/software-engineer",
    note: "25% after month 12, then 6.25% quarterly.",
    schedule: [
      row(12, 25),
      ...Array.from({ length: 12 }, (_, i) => row(15 + 3 * i, 6.25)),
    ],
  },
  {
    id: "amazon-historical",
    label: "Amazon-style · 5/15/40/40 (historical)",
    source:
      "https://www.levels.fyi/companies/amazon/salaries/software-engineer",
    note: "Reported alternate/historical schedule. Current offers may differ.",
    schedule: [
      row(12, 5),
      row(24, 15),
      row(30, 20),
      row(36, 20),
      row(42, 20),
      row(48, 20),
    ],
  },
  {
    id: "amazon-annual",
    label: "Amazon-style · 5/15/45/35 annually",
    source:
      "https://www.levels.fyi/companies/amazon/salaries/software-engineer",
    note: "Reported annual variant, accessed October 27, 2026.",
    schedule: weighted([5, 15, 45, 35], 12),
  },
  {
    id: "google",
    label: "Google-style · 38/32/20/10 monthly",
    source:
      "https://www.levels.fyi/companies/google/salaries/software-engineer",
    note: "Reported front-loaded weights. Actual cadence can depend on grant size and terms.",
    schedule: weighted([38, 32, 20, 10], 1),
  },
  {
    id: "google-quarterly",
    label: "Google-style · 38/32/20/10 quarterly",
    source:
      "https://www.levels.fyi/companies/google/salaries/software-engineer",
    note: "Same reported annual weights distributed quarterly; review your offer.",
    schedule: weighted([38, 32, 20, 10], 3),
  },
  {
    id: "google-legacy",
    label: "Google-style · 33/33/22/12 monthly",
    source: levels,
    note: "Reported historical front-loaded variant.",
    schedule: weighted([33, 33, 22, 12], 1),
  },
];
export function templateSchedule(id: string): VestingRow[] {
  const template = vestingTemplates.find((t) => t.id === id);
  if (!template) throw new RangeError("Choose a supported vesting template");
  return template.schedule.map((r) => ({ ...r }));
}
