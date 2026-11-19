import type {
  AssumptionsV2,
  CareerEvent,
  Grant,
  Issuer,
  RefresherRule,
  ScenarioV2,
} from "./planner";
import { monthIndex, monthLabel, scheduleError } from "./planner";
import { templateSchedule } from "../data/vesting";
export interface EmploymentPeriod {
  id: string;
  issuerId: string;
  start: number;
  end: number;
  label: string;
}
export interface EquityVest {
  grantId: string;
  grantName: string;
  issuerId: string;
  month: number;
  shares: number;
  price: number;
  value: number;
  treatment: "sell" | "hold";
}
export interface Forfeiture {
  grantId: string;
  grantName: string;
  issuerId: string;
  month: number;
  shares: number;
  value: number;
}
export interface EquityPlan {
  grants: Grant[];
  vests: EquityVest[];
  forfeitures: Forfeiture[];
  employment: EmploymentPeriod[];
}
export function issuerPrice(issuer: Issuer, elapsedMonths: number): number {
  const value =
    Number(issuer.price) *
    (1 + Number(issuer.appreciation) / 100) ** (elapsedMonths / 12);
  if (!Number.isFinite(value) || value <= 0)
    throw new RangeError("Share price assumption exceeded numerical limits");
  return value;
}
export function employmentPeriods(
  s: ScenarioV2,
  startYear: number,
  months: number,
): EmploymentPeriod[] {
  const jobs = s.events
    .filter((e) => e.kind === "job")
    .sort((a, b) => a.month.localeCompare(b.month));
  const periods: EmploymentPeriod[] = [
    {
      id: "initial",
      issuerId: s.employerId,
      start: 0,
      end: months,
      label: "Initial employment",
    },
  ];
  for (const e of jobs) {
    const month = monthIndex(e.month, startYear);
    periods[periods.length - 1].end = month;
    periods.push({
      id: e.id,
      issuerId: e.issuerId,
      start: month,
      end: months,
      label: e.role,
    });
  }
  return periods;
}
function generatedGrant(
  id: string,
  name: string,
  value: string,
  month: string,
  issuerId: string,
  employmentId: string,
  template: string,
  treatment: "sell" | "hold",
): Grant {
  return {
    id,
    name,
    value,
    month,
    issuerId,
    employmentId,
    units: "dollars",
    priceMode: "modeled",
    grantPrice: "100",
    schedule: templateSchedule(template),
    template,
    treatment,
    keepOnDeparture: false,
  };
}
function expandRule(
  rule: RefresherRule,
  s: ScenarioV2,
  a: AssumptionsV2,
  employment: EmploymentPeriod[],
): Grant[] {
  const year = Number(a.startYear),
    horizon = Number(a.years) * 12;
  const period = employment.find((p) => p.id === rule.employmentId);
  if (!period) throw new RangeError("Refresher refers to missing employment");
  const first = monthIndex(rule.firstMonth, year),
    last = monthIndex(rule.lastMonth, year);
  let end = Math.min(last + 1, period.end, horizon);
  if (rule.untilNextRole) {
    const next = s.events
      .map((e) => monthIndex(e.month, year))
      .filter((m) => m > period.start && m < period.end)
      .sort((x, y) => x - y)[0];
    if (next !== undefined) end = Math.min(end, next);
  }
  const result: Grant[] = [];
  for (let month = first; month < end; month += Number(rule.every)) {
    if (month < period.start) continue;
    result.push(
      generatedGrant(
        `${rule.id}:${month}`,
        `${rule.name} · ${monthLabel(month, year)}`,
        rule.value,
        monthLabel(month, year),
        rule.issuerId,
        rule.employmentId,
        rule.template,
        rule.treatment,
      ),
    );
  }
  return result;
}
export function buildEquity(s: ScenarioV2, a: AssumptionsV2): EquityPlan {
  const start = Number(a.startYear),
    months = Number(a.years) * 12;
  const employment = employmentPeriods(s, start, months),
    grants: Grant[] = s.grants.map((g) => ({ ...g }));
  const events = [...s.events].sort((a, b) => a.month.localeCompare(b.month));
  for (const r of s.refreshers) grants.push(...expandRule(r, s, a, employment));
  for (let i = 0; i < events.length; i++) {
    const e = events[i],
      eventMonth = monthIndex(e.month, start);
    const period = employment.find(
      (p) => eventMonth >= p.start && eventMonth < p.end,
    );
    if (!period) continue;
    if (Number(e.awardValue) > 0)
      grants.push(
        generatedGrant(
          `${e.id}:award`,
          `${e.role} award`,
          e.awardValue,
          e.month,
          e.issuerId,
          period.id,
          e.awardTemplate,
          e.awardTreatment,
        ),
      );
    if (Number(e.refresherValue) > 0) {
      const end = Math.min(
        period.end,
        events[i + 1] ? monthIndex(events[i + 1].month, start) : months,
      );
      for (
        let month = eventMonth + Number(e.refresherAfter);
        month < end;
        month += Number(e.refresherEvery)
      ) {
        grants.push(
          generatedGrant(
            `${e.id}:refresh:${month}`,
            `${e.role} refresher`,
            e.refresherValue,
            monthLabel(month, start),
            e.issuerId,
            period.id,
            e.refresherTemplate,
            e.refresherTreatment,
          ),
        );
      }
    }
  }
  if (grants.length > 1000)
    throw new RangeError(
      "Use at most 1,000 grants including generated refreshers.",
    );
  const vests: EquityVest[] = [],
    forfeitures: Forfeiture[] = [];
  for (const g of grants) {
    if (s.grantOverrides[g.id] !== undefined)
      g.keepOnDeparture = s.grantOverrides[g.id];
    const issuer = s.issuers.find((i) => i.id === g.issuerId),
      period = employment.find((p) => p.id === g.employmentId);
    if (!issuer || !period || scheduleError(g.schedule))
      throw new RangeError(
        "Check grant employer, employment and vesting schedule",
      );
    const grantMonth = monthIndex(g.month, start);
    if (
      grantMonth >= period.end ||
      (period.id !== "initial" && grantMonth < period.start)
    )
      throw new RangeError(
        `${g.name}: grant must be awarded during its employment period.`,
      );
    const grantPrice =
      g.priceMode === "explicit"
        ? Number(g.grantPrice)
        : issuerPrice(issuer, grantMonth);
    const shares =
      g.units === "shares" ? Number(g.value) : Number(g.value) / grantPrice;
    if (!Number.isFinite(shares) || shares < 0)
      throw new RangeError("Invalid grant share count");
    let forfeited = 0;
    for (const row of g.schedule) {
      // Offset 1 means the end of the grant month; offset 12 means the end of its 12th month.
      const month = grantMonth + Number(row.month) - 1,
        quantity = (shares * Number(row.percent)) / 100;
      if (month >= period.end && !g.keepOnDeparture) {
        forfeited += quantity;
        continue;
      }
      if (month < 0 || month >= months) continue;
      const price = issuerPrice(issuer, month + 1);
      vests.push({
        grantId: g.id,
        grantName: g.name,
        issuerId: g.issuerId,
        month,
        shares: quantity,
        price,
        value: quantity * price,
        treatment: g.treatment,
      });
    }
    if (forfeited > 0 && period.end < months)
      forfeitures.push({
        grantId: g.id,
        grantName: g.name,
        issuerId: g.issuerId,
        month: period.end,
        shares: forfeited,
        value: forfeited * issuerPrice(issuer, period.end),
      });
  }
  return { grants, vests, forfeitures, employment };
}
export function eventAtMonth(
  events: CareerEvent[],
  month: number,
  startYear: number,
): CareerEvent | undefined {
  return events.find((e) => monthIndex(e.month, startYear) === month);
}
