import {
  defaultState as legacyDefaults,
  scenarioErrors,
  sharedErrors,
  categoryKeys,
} from "./model";
import type { Scenario, Assumptions } from "./model";

export type TaxLocation =
  | "columbus"
  | "seattle"
  | "san-francisco"
  | "new-york"
  | "austin"
  | "boston";
export type FilingStatus = "single" | "joint";
export interface Benefits {
  retirement: string;
  health: string;
  hsa: string;
}
export interface MatchTier {
  rate: string;
  payPercent: string;
}
export interface EmployerMatch {
  type: "unsure" | "none" | "simple" | "tiered";
  rate: string;
  payPercent: string;
  cap: string;
  tiers: MatchTier[];
}
export interface TaxProfile {
  mode: "calculated" | "manual";
  location: TaxLocation;
  filing: FilingStatus;
  spouseWages: string;
  spouseGrowth: string;
  hsaCoverage: "none" | "self" | "family";
  federalAdjustment: string;
  stateAdjustment: string;
  localAdjustment: string;
  employeePremiums: boolean;
  waCaresExempt: boolean;
  nyDisability: boolean;
}
export interface Issuer {
  id: string;
  name: string;
  price: string;
  appreciation: string;
  startingShares: string;
  startingBasis: string;
}
export interface VestingRow {
  month: string;
  percent: string;
}
export type SaleTreatment = "sell" | "hold";
export interface Grant {
  id: string;
  name: string;
  issuerId: string;
  employmentId: string;
  month: string;
  units: "dollars" | "shares";
  value: string;
  priceMode: "modeled" | "explicit";
  grantPrice: string;
  schedule: VestingRow[];
  template: string;
  treatment: SaleTreatment;
  keepOnDeparture: boolean;
  presetCompensation?: string;
}
export interface RefresherRule {
  id: string;
  name: string;
  issuerId: string;
  employmentId: string;
  firstMonth: string;
  lastMonth: string;
  every: string;
  value: string;
  template: string;
  treatment: SaleTreatment;
  untilNextRole: boolean;
}
export interface CareerEvent {
  id: string;
  kind: "promotion" | "job";
  month: string;
  issuerId: string;
  role: string;
  base: string;
  bonus: string;
  growth: string;
  awardValue: string;
  awardTemplate: string;
  awardTreatment: SaleTreatment;
  refresherValue: string;
  refresherAfter: string;
  refresherEvery: string;
  refresherTemplate: string;
  refresherTreatment: SaleTreatment;
  presetProgression?: string;
}
export interface ScenarioV2 extends Scenario {
  taxProfile: TaxProfile;
  benefits: Benefits;
  spouseBenefits: Benefits;
  role: string;
  employerId: string;
  stockMode: "grants" | "legacy";
  grantOverrides: Record<string, boolean>;
  issuers: Issuer[];
  grants: Grant[];
  refreshers: RefresherRule[];
  events: CareerEvent[];
  employerMatch: EmployerMatch;
}
export interface AssumptionsV2 extends Assumptions {
  startYear: string;
  taxInflation: string;
  startingRetirement: string;
  startingHsa: string;
  startingSpouseRetirement: string;
  startingSpouseHsa: string;
}
export interface PlannerV2 {
  version: 2;
  scenarios: [ScenarioV2, ScenarioV2];
  shared: AssumptionsV2;
  comparison: boolean;
}
export const taxLocations: { id: TaxLocation; label: string }[] = [
  { id: "columbus", label: "Columbus, OH" },
  { id: "seattle", label: "Seattle, WA" },
  { id: "san-francisco", label: "San Francisco, CA" },
  { id: "new-york", label: "New York City, NY" },
  { id: "austin", label: "Austin, TX" },
  { id: "boston", label: "Boston, MA" },
];
export const emptyBenefits = (): Benefits => ({
  retirement: "0",
  health: "0",
  hsa: "0",
});
export function upgradeScenario(
  s: Scenario,
  index: number,
  legacy = false,
): ScenarioV2 {
  return {
    ...s,
    taxProfile: {
      mode: legacy ? "manual" : "calculated",
      location: index === 0 ? "columbus" : "seattle",
      filing: "single",
      spouseWages: "0",
      spouseGrowth: "0",
      hsaCoverage: "none",
      federalAdjustment: "0",
      stateAdjustment: "0",
      localAdjustment: "0",
      employeePremiums: true,
      waCaresExempt: false,
      nyDisability: false,
    },
    benefits: emptyBenefits(),
    spouseBenefits: emptyBenefits(),
    role: "Software engineer",
    employerId: "employer-initial",
    stockMode: legacy ? "legacy" : "grants",
    grantOverrides: {},
    issuers: [
      {
        id: "employer-initial",
        name: "Current employer",
        price: "100",
        appreciation: "0",
        startingShares: "0",
        startingBasis: "0",
      },
    ],
    grants: [],
    refreshers: [],
    events: [],
    employerMatch: {
      type: "unsure",
      rate: "50",
      payPercent: "6",
      cap: "0",
      tiers: [
        { rate: "100", payPercent: "3" },
        { rate: "50", payPercent: "2" },
      ],
    },
  };
}
export function defaultPlanner(): PlannerV2 {
  const d = legacyDefaults();
  return {
    version: 2,
    comparison: false,
    scenarios: d.scenarios.map((s, i) =>
      upgradeScenario(s, i),
    ) as PlannerV2["scenarios"],
    shared: {
      ...d.shared,
      startYear: "2026",
      taxInflation: "2.5",
      startingRetirement: "0",
      startingHsa: "0",
      startingSpouseRetirement: "0",
      startingSpouseHsa: "0",
    },
  };
}
export function numberError(
  value: unknown,
  min = 0,
  max = 10_000_000,
  integer = false,
): string | undefined {
  if (typeof value !== "string" || !value.trim())
    return "Enter a value; zero is allowed.";
  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) ||
    !Number.isFinite(Number(value))
  )
    return "Enter a finite number.";
  const n = Number(value);
  if (n < min || n > max)
    return `Use ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}.`;
  if (integer && !Number.isInteger(n)) return "Use a whole number.";
}
export function monthIndex(month: string, startYear: number): number {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    return NaN;
  return (
    (Number(month.slice(0, 4)) - startYear) * 12 + Number(month.slice(5)) - 1
  );
}
export function monthLabel(index: number, startYear: number): string {
  const year = startYear + Math.floor(index / 12),
    month = (((index % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
export function displayMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return "Choose month";
  return new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)) - 1,
    1,
  ).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
export function scheduleError(rows: VestingRow[]): string | undefined {
  if (!Array.isArray(rows) || !rows.length || rows.length > 120)
    return "Add 1–120 vesting rows.";
  if (
    rows.some(
      (r) =>
        numberError(r.month, 1, 120, true) || numberError(r.percent, 0, 100),
    )
  )
    return "Use month offsets 1–120 and percentages 0–100.";
  if (new Set(rows.map((r) => Number(r.month))).size !== rows.length)
    return "Use each month offset only once.";
  if (
    Math.abs(rows.reduce((sum, r) => sum + Number(r.percent), 0) - 100) > 1e-8
  )
    return "Vesting percentages must total 100%.";
}
export function plannerScenarioErrors(
  s: ScenarioV2,
  shared: AssumptionsV2,
): Record<string, string> {
  const errors = scenarioErrors(s);
  // Flat tax and annualized stock are active only in their corresponding legacy/manual modes.
  if (s.taxProfile.mode !== "manual") delete errors.tax;
  if (s.stockMode !== "legacy") delete errors.stock;
  const check = (
    path: string,
    value: unknown,
    min = 0,
    max = 10_000_000,
    integer = false,
  ) => {
    const e = numberError(value, min, max, integer);
    if (e) errors[path] = e;
  };
  const text = (path: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim() || value.length > 100)
      errors[path] = "Use 1–100 characters.";
  };
  const start = Number(shared.startYear),
    months = Number(shared.years) * 12;
  const date = (path: string, value: string, historical = false) => {
    const m = monthIndex(value, start);
    if (!Number.isInteger(m) || m < (historical ? -120 : 0) || m >= months)
      errors[path] = historical
        ? "Choose a month within the projection or the preceding 10 years."
        : "Choose a month within the projection.";
  };
  if (
    !["calculated", "manual"].includes(s.taxProfile.mode) ||
    !taxLocations.some((l) => l.id === s.taxProfile.location) ||
    !["single", "joint"].includes(s.taxProfile.filing) ||
    !["none", "self", "family"].includes(s.taxProfile.hsaCoverage)
  )
    errors.taxProfile = "Choose a supported tax profile.";
  for (const k of [
    "employeePremiums",
    "waCaresExempt",
    "nyDisability",
  ] as const)
    if (typeof s.taxProfile[k] !== "boolean")
      errors.taxProfile = "Invalid tax switches.";
  text("role", s.role);
  if (
    !["grants", "legacy"].includes(s.stockMode) ||
    !s.grantOverrides ||
    Object.values(s.grantOverrides).some((v) => typeof v !== "boolean")
  )
    errors.grants = "Invalid equity mode or grant overrides.";
  if (s.taxProfile.filing === "joint") {
    check("taxProfile.spouseWages", s.taxProfile.spouseWages);
    check("taxProfile.spouseGrowth", s.taxProfile.spouseGrowth, -100, 20);
  }
  for (const k of [
    "federalAdjustment",
    "stateAdjustment",
    "localAdjustment",
  ] as const)
    check(`taxProfile.${k}`, s.taxProfile[k], -1_000_000, 1_000_000);
  for (const who of (s.taxProfile.filing === "joint"
    ? ["benefits", "spouseBenefits"]
    : ["benefits"]) as ("benefits" | "spouseBenefits")[]) {
    for (const key of ["retirement", "health", "hsa"] as const)
      check(`${who}.${key}`, s[who][key]);
    if (
      Number(s[who].retirement) >
      24500 *
        (1 + Number(shared.taxInflation) / 100) ** Math.max(0, start - 2026)
    )
      errors[`${who}.retirement`] =
        "Exceeds the projected annual 401(k) employee limit (under age 50).";
  }
  const match = s.employerMatch;
  if (!match || !["unsure", "none", "simple", "tiered"].includes(match.type)) {
    errors.employerMatch = "Choose a valid employer match setting.";
  } else {
    check("employerMatch.rate", match.rate, 0, 100);
    check("employerMatch.payPercent", match.payPercent, 0, 100);
    check("employerMatch.cap", match.cap, 0, 10_000_000);
    if (!Array.isArray(match.tiers) || match.tiers.length > 20)
      errors.employerMatch = "Use at most 20 employer match tiers.";
    else {
      let previous = 0;
      match.tiers.forEach((tier, index) => {
        check(`employerMatch.tiers.${index}.rate`, tier.rate, 0, 100);
        check(`employerMatch.tiers.${index}.payPercent`, tier.payPercent, 0, 100);
        previous += Number(tier.payPercent);
      });
      if (previous > 100) errors.employerMatch = "Match tiers cannot exceed 100% of eligible pay.";
    }
  }
  const spouse = s.taxProfile.filing === "joint";
  if (s.taxProfile.hsaCoverage === "self")
    for (const who of (spouse
      ? ["benefits", "spouseBenefits"]
      : ["benefits"]) as ("benefits" | "spouseBenefits")[]) {
      if (
        Number(s[who].hsa) >
        4400 *
          (1 + Number(shared.taxInflation) / 100) ** Math.max(0, start - 2026)
      )
        errors[`${who}.hsa`] =
          "Exceeds the projected per-person self-only HSA limit.";
    }
  const hsa =
    Number(s.benefits.hsa) + (spouse ? Number(s.spouseBenefits.hsa) : 0);
  const hsaLimit =
    (s.taxProfile.hsaCoverage === "none"
      ? 0
      : s.taxProfile.hsaCoverage === "self"
        ? 4400 * (spouse ? 2 : 1)
        : 8750) *
    (1 + Number(shared.taxInflation) / 100) ** Math.max(0, start - 2026);
  if (hsa > hsaLimit)
    errors["benefits.hsa"] =
      s.taxProfile.hsaCoverage === "none"
        ? "Confirm eligible HSA coverage before contributing."
        : "Combined contributions exceed the projected household HSA limit.";
  if (
    s.stockMode === "legacy" &&
    (s.grants.length > 0 ||
      s.refreshers.length > 0 ||
      s.events.some(
        (e) => Number(e.awardValue) > 0 || Number(e.refresherValue) > 0,
      ))
  )
    errors.grants =
      "Switch Equity grants to grant mode to model awards and refreshers. Legacy mode only includes the saved repeating annual amount.";
  const issuerIds = new Set(s.issuers.map((i) => i.id));
  if (
    !s.issuers.length ||
    s.issuers.length > 25 ||
    issuerIds.size !== s.issuers.length ||
    !issuerIds.has(s.employerId)
  )
    errors.issuers =
      "Choose a valid initial employer; use at most 25 unique employers.";
  s.issuers.forEach((i, idx) => {
    text(`issuers.${idx}.name`, i.name);
    check(`issuers.${idx}.price`, i.price, 0.01, 1_000_000);
    check(`issuers.${idx}.appreciation`, i.appreciation, -99.9, 100);
    check(`issuers.${idx}.startingShares`, i.startingShares, 0, 1_000_000_000);
    check(`issuers.${idx}.startingBasis`, i.startingBasis, 0, 1e12);
  });
  const employmentIds = new Set([
    "initial",
    ...s.events.filter((e) => e.kind === "job").map((e) => e.id),
  ]);
  if (
    s.events.length > 30 ||
    new Set(s.events.map((e) => e.id)).size !== s.events.length
  )
    errors.events = "Use at most 30 unique career events.";
  if (new Set(s.events.map((e) => e.month)).size !== s.events.length)
    errors.events = "Only one career change can start in a month.";
  let currentIssuer = s.employerId;
  const sorted = s.events
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => a.e.month.localeCompare(b.e.month));
  sorted.forEach(({ e, idx }) => {
    const p = `events.${idx}`;
    date(`${p}.month`, e.month);
    text(`${p}.role`, e.role);
    if (!["promotion", "job"].includes(e.kind) || !issuerIds.has(e.issuerId))
      errors[`${p}.issuerId`] = "Choose a valid employer.";
    if (e.kind === "promotion" && e.issuerId !== currentIssuer)
      errors[`${p}.issuerId`] =
        "A promotion must remain at the active employer. Use Change employer instead.";
    if (e.kind === "job") currentIssuer = e.issuerId;
    for (const k of ["base", "bonus", "awardValue", "refresherValue"] as const)
      check(`${p}.${k}`, e[k]);
    check(`${p}.growth`, e.growth, -100, 20);
    check(`${p}.refresherAfter`, e.refresherAfter, 1, 120, true);
    check(`${p}.refresherEvery`, e.refresherEvery, 1, 120, true);
    if (
      !["sell", "hold"].includes(e.awardTreatment) ||
      !["sell", "hold"].includes(e.refresherTreatment)
    )
      errors[p] = "Choose an equity treatment.";
  });
  if (
    s.grants.length > 100 ||
    new Set(s.grants.map((g) => g.id)).size !== s.grants.length
  )
    errors.grants = "Use at most 100 unique grants.";
  s.grants.forEach((g, idx) => {
    const p = `grants.${idx}`;
    text(`${p}.name`, g.name);
    date(`${p}.month`, g.month, true);
    check(`${p}.value`, g.value);
    if (g.units === "dollars" && g.priceMode === "explicit")
      check(`${p}.grantPrice`, g.grantPrice, 0.000001, 1_000_000);
    if (!issuerIds.has(g.issuerId) || !employmentIds.has(g.employmentId))
      errors[p] = "Choose an existing employer and employment period.";
    if (
      !["dollars", "shares"].includes(g.units) ||
      !["modeled", "explicit"].includes(g.priceMode) ||
      !["sell", "hold"].includes(g.treatment) ||
      typeof g.keepOnDeparture !== "boolean"
    )
      errors[p] = "Invalid grant settings.";
    if (
      monthIndex(g.month, start) < 0 &&
      g.units === "dollars" &&
      g.priceMode !== "explicit"
    )
      errors[`${p}.grantPrice`] =
        "Enter the actual grant-date price for a historical dollar grant.";
    const e = scheduleError(g.schedule);
    if (e) errors[`${p}.schedule`] = e;
  });
  if (
    s.refreshers.length > 30 ||
    new Set(s.refreshers.map((r) => r.id)).size !== s.refreshers.length
  )
    errors.refreshers = "Use at most 30 unique refresher rules.";
  s.refreshers.forEach((r, idx) => {
    const p = `refreshers.${idx}`;
    text(`${p}.name`, r.name);
    date(`${p}.firstMonth`, r.firstMonth);
    date(`${p}.lastMonth`, r.lastMonth);
    check(`${p}.every`, r.every, 1, 120, true);
    check(`${p}.value`, r.value);
    if (r.lastMonth < r.firstMonth)
      errors[`${p}.lastMonth`] = "End month must not precede first award.";
    if (
      !issuerIds.has(r.issuerId) ||
      !employmentIds.has(r.employmentId) ||
      !["sell", "hold"].includes(r.treatment) ||
      typeof r.untilNextRole !== "boolean"
    )
      errors[p] = "Choose a valid employer, employment and treatment.";
  });
  return errors;
}
export function plannerSharedErrors(s: AssumptionsV2): Record<string, string> {
  const errors = sharedErrors({
    starting: s.starting,
    years: s.years,
    returns: s.returns,
    inflation: s.inflation,
  });
  for (const [k, min, max, integer] of [
    ["startYear", 2026, 2036, true],
    ["taxInflation", 0, 10, false],
    ["startingRetirement", 0, 1e7, false],
    ["startingHsa", 0, 1e7, false],
    ["startingSpouseRetirement", 0, 1e7, false],
    ["startingSpouseHsa", 0, 1e7, false],
  ] as const) {
    const e = numberError(s[k], min, max, integer);
    if (e) errors[k] = e;
  }
  return errors;
}
export function validPlanner(state: PlannerV2): boolean {
  return (
    !Object.keys(plannerSharedErrors(state.shared)).length &&
    state.scenarios
      .slice(0, state.comparison ? 2 : 1)
      .every((s) => !Object.keys(plannerScenarioErrors(s, state.shared)).length)
  );
}
export function uid(): string {
  return crypto.randomUUID();
}
export function totalBudget(s: ScenarioV2): number {
  return categoryKeys.reduce((sum, k) => sum + Number(s.expenses[k]), 0);
}
