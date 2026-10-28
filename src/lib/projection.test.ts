import { describe, it, expect } from "vitest";
import {
  defaultPlanner,
  monthLabel,
  plannerScenarioErrors,
  scheduleError,
} from "./planner";
import type { CareerEvent, Grant, PlannerV2 } from "./planner";
import { projectScenario } from "./projection";
import { buildEquity } from "./equity";
import { templateSchedule, vestingTemplates } from "../data/vesting";
function fixture(): PlannerV2 {
  const p = defaultPlanner();
  p.shared = {
    ...p.shared,
    returns: "0",
    inflation: "0",
    starting: "0",
    taxInflation: "0",
  };
  p.scenarios[0].taxProfile.mode = "manual";
  p.scenarios[0].tax = "0";
  p.scenarios[0].base = "0";
  p.scenarios[0].growth = "0";
  p.scenarios[0].expenses = {
    housing: "0",
    food: "0",
    transportation: "0",
    healthcare: "0",
    other: "0",
  };
  return p;
}
function grant(p: PlannerV2, patch: Partial<Grant> = {}): Grant {
  return {
    id: "grant",
    name: "Initial award",
    issuerId: p.scenarios[0].employerId,
    employmentId: "initial",
    month: "2026-01",
    units: "dollars",
    value: "100000",
    priceMode: "explicit",
    grantPrice: "100",
    schedule: templateSchedule("annual"),
    template: "annual",
    treatment: "sell",
    keepOnDeparture: false,
    ...patch,
  };
}
function event(p: PlannerV2, patch: Partial<CareerEvent> = {}): CareerEvent {
  return {
    id: "promotion",
    kind: "promotion",
    issuerId: p.scenarios[0].employerId,
    month: "2026-07",
    role: "Senior",
    base: "200000",
    bonus: "24000",
    growth: "10",
    awardValue: "0",
    awardTemplate: "annual",
    awardTreatment: "sell",
    refresherValue: "0",
    refresherAfter: "12",
    refresherEvery: "12",
    refresherTemplate: "annual",
    refresherTreatment: "sell",
    ...patch,
  };
}
describe("monthly career and investment engine", () => {
  it("matches a separately computed zero-return cash accumulation", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "100000";
    s.tax = "25";
    s.expenses.housing = "3000";
    p.shared.starting = "20000";
    const r = projectScenario(s, p.shared).rows[0];
    expect(r.base).toBeCloseTo(100000);
    expect(r.surplus).toBeCloseTo(39000);
    expect(r.endingBalance).toBeCloseTo(59000);
  });
  it("uses the effective monthly rate and month-end contributions", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "12000";
    p.shared.returns = "12";
    const r = projectScenario(s, p.shared).rows[0];
    const monthly = 1.12 ** (1 / 12) - 1;
    expect(r.endingBalance).toBeCloseTo(
      (1000 * ((1 + monthly) ** 12 - 1)) / monthly,
      8,
    );
  });
  it("never applies investment returns to an unfunded opening cash shortfall", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.expenses.housing = "1000";
    p.shared.returns = "10";
    const r = projectScenario(s, p.shared);
    expect(r.rows[0].balances.taxable).toBe(-12000);
    expect(r.rows[1].balances.taxable).toBe(-24000);
  });
  it("prorates midyear role pay, accrues bonuses, and resets raise anniversaries", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "100000";
    s.bonus = "12000";
    s.events = [event(p)];
    const r = projectScenario(s, p.shared);
    expect(r.rows[0].base).toBeCloseTo(150000);
    expect(r.rows[0].bonus).toBeCloseTo(18000);
    expect(r.months[5].bonus).toBe(0);
    expect(r.months[11].bonus).toBeCloseTo(18000);
    expect(r.rows[1].base).toBeCloseTo(210000);
  });
  it("does not stack an automatic anniversary raise on explicit promotion salary", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "100000";
    s.growth = "10";
    s.events = [
      event(p, { month: "2027-01", base: "150000", bonus: "0", growth: "0" }),
    ];
    const r = projectScenario(s, p.shared);
    expect(r.rows[1].base).toBeCloseTo(150000);
  });
  it("uses joint household wages and preserves yearly payroll caps across job changes", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "400000";
    s.taxProfile = {
      ...s.taxProfile,
      mode: "calculated",
      location: "austin",
      filing: "joint",
      spouseWages: "200000",
    };
    s.events = [
      event(p, {
        kind: "job",
        id: "newjob",
        base: "400000",
        bonus: "0",
        growth: "0",
      }),
    ];
    const r = projectScenario(s, p.shared).rows[0];
    expect(r.spouseCash).toBeCloseTo(200000);
    expect(r.taxBreakdown.socialSecurity).toBeCloseTo(22878);
    expect(r.cashGross).toBeCloseTo(600000);
  });
  it("transfers contributions to separate accounts without manufacturing wealth or double counting premiums", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "100000";
    s.benefits = { retirement: "12000", hsa: "4000", health: "6000" };
    s.retirementTargets.primary.workplace401k.mode = "dollars";
    s.retirementTargets.primary.workplace401k.amount = "12000";
    s.taxProfile.hsaCoverage = "self";
    s.expenses.healthcare = "1000";
    const r = projectScenario(s, p.shared).rows[0];
    expect(r.balances.retirement).toBeCloseTo(12000);
    expect(r.balances.hsa).toBeCloseTo(4000);
    expect(r.healthcareOffset).toBeCloseTo(6000);
    expect(r.expenses).toBeCloseTo(6000);
    expect(r.balances.taxable).toBeCloseTo(72000);
    expect(r.endingBalance).toBeCloseTo(88000);
  });
  it("applies separate self-only HSA limits when both spouses have eligible self-only coverage", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "100000";
    s.taxProfile.filing = "joint";
    s.taxProfile.spouseWages = "100000";
    s.taxProfile.hsaCoverage = "self";
    s.benefits.hsa = "4400";
    s.spouseBenefits.hsa = "4400";
    expect(projectScenario(s, p.shared).rows[0].hsaContribution).toBeCloseTo(
      8800,
      8,
    );
    s.benefits.hsa = "4401";
    expect(plannerScenarioErrors(s, p.shared)["benefits.hsa"]).toBeTruthy();
  });
  it("does not create benefit assets when there is no cash pay", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.retirementTargets.primary.workplace401k.mode = "dollars";
    s.retirementTargets.primary.workplace401k.amount = "12000";
    const r = projectScenario(s, p.shared).rows[0];
    expect(r.retirementContribution).toBe(0);
    expect(r.endingBalance).toBe(0);
  });
  it("rejects contribution-limit violations, including a shared family HSA limit", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.taxProfile.filing = "joint";
    s.taxProfile.hsaCoverage = "family";
    s.benefits.hsa = "5000";
    s.spouseBenefits.hsa = "5000";
    expect(plannerScenarioErrors(s, p.shared)["benefits.hsa"]).toBeTruthy();
    s.benefits.hsa = "0";
    s.spouseBenefits.hsa = "0";
    s.retirementTargets.primary.workplace401k.mode = "dollars";
    s.retirementTargets.primary.workplace401k.amount = "24501";
    s.base = "100000";
    expect(projectScenario(s, p.shared).rows[0].retirementContribution).toBeCloseTo(24500, 8);
  });
  it("keeps annual 401(k) targets global when switching jobs", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "200000";
    s.retirementTargets.primary.workplace401k.mode = "dollars";
    s.retirementTargets.primary.workplace401k.amount = "24500";
    s.events = [
      event(p, {
        kind: "job",
        id: "newjob",
        base: "300000",
        bonus: "0",
        growth: "0",
      }),
    ];
    expect(
      projectScenario(s, p.shared).rows[0].retirementContribution,
    ).toBeCloseTo(24500, 8);
  });
  it("funds eligible IRA targets from available cash and taxes only the funded deductible amount", () => {
    const p = fixture(), s = p.scenarios[0];
    s.base = "70000";
    s.retirementProfiles.primary.workplacePlanCoverage = true;
    s.retirementTargets.primary.traditionalIra = "7500";
    const row = projectScenario(s, p.shared).rows[0];
    expect(row.traditionalIraContribution).toBeCloseTo(7500, 8);
    expect(row.deductibleIraContribution).toBeCloseTo(7500, 8);
    expect(row.accountBalances["traditional-ira"]).toBeCloseTo(7500, 8);
    s.retirementProfiles.primary.workplacePlanCoverage = "unsure";
    s.retirementTargets.primary.traditionalIra = "100000";
    const limited = projectScenario(s, p.shared).rows[0];
    expect(limited.deductibleIraContribution).toBe(0);
    expect(limited.unfundedIraContribution).toBeGreaterThan(0);
  });
  it("routes catch-up dollars to Roth when prior-year sponsoring-employer wages exceed the threshold", () => {
    const p = fixture(), s = p.scenarios[0];
    s.base = "200000";
    s.retirementProfiles.primary.ageAtFirstYearEnd = "50";
    s.retirementProfiles.primary.ageConfirmed = true;
    s.retirementProfiles.primary.allowsCatchUp = true;
    s.retirementProfiles.primary.priorYearFicaWages = "160000";
    s.retirementTargets.primary.workplace401k.mode = "dollars";
    s.retirementTargets.primary.workplace401k.amount = "32500";
    const row = projectScenario(s, p.shared).rows[0];
    expect(row.retirementContribution).toBeCloseTo(24500, 8);
    expect(row.roth401kContribution).toBeCloseTo(8000, 8);
  });
  it("rejects malformed numeric inputs rather than returning non-finite values", () => {
    const p = fixture();
    p.scenarios[0].base = "Infinity";
    expect(() => projectScenario(p.scenarios[0], p.shared)).toThrow();
  });
});
describe("vesting, grant overlap and departures", () => {
  it.each(vestingTemplates)(
    "validates the complete reported template $id",
    (t) => expect(scheduleError(t.schedule)).toBeUndefined(),
  );
  it("vests an annual grant over four years and then stops", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [grant(p)];
    const r = projectScenario(s, p.shared);
    expect(r.rows.slice(0, 5).map((r) => r.stockGross)).toEqual([
      25000, 25000, 25000, 25000, 0,
    ]);
    expect(r.rows[4].endingBalance).toBe(100000);
  });
  it("uses a one-year cliff and monthly post-cliff vesting", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [
      grant(p, {
        template: "cliff-monthly",
        schedule: templateSchedule("cliff-monthly"),
      }),
    ];
    const eq = buildEquity(s, p.shared);
    expect(eq.vests[0].month).toBe(11);
    expect(eq.vests[0].value).toBe(25000);
    expect(eq.vests[1].month).toBe(12);
    expect(eq.vests[1].value).toBeCloseTo(100000 / 48);
  });
  it("produces the historical Amazon back-loaded annual pattern", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [
      grant(p, {
        template: "amazon-historical",
        schedule: templateSchedule("amazon-historical"),
      }),
    ];
    expect(
      projectScenario(s, p.shared)
        .rows.slice(0, 4)
        .map((r) => r.stockGross),
    ).toEqual([5000, 15000, 40000, 40000]);
  });
  it("includes only future vests from historical grants and never invents starting holdings", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [grant(p, { month: "2025-01" })];
    const r = projectScenario(s, p.shared);
    expect(r.starting.employerStock).toBe(0);
    expect(r.rows[0].stockGross).toBe(25000);
    expect(r.rows.at(-1)!.endingBalance).toBe(75000);
  });
  it("supports explicit shares independently of grant-date price", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [grant(p, { units: "shares", value: "100", grantPrice: "999" })];
    expect(projectScenario(s, p.shared).rows[0].stockGross).toBe(2500);
  });
  it("sets fixed future grant shares at the modeled award-date price", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.issuers[0].appreciation = "100";
    s.grants = [
      grant(p, { month: "2027-01", priceMode: "modeled", value: "10000" }),
    ];
    const eq = buildEquity(s, p.shared);
    expect(eq.vests[0].shares).toBeCloseTo(12.5);
    expect(eq.vests[0].price).toBeCloseTo(400);
    expect(eq.vests[0].value).toBeCloseTo(5000);
  });
  it("overlaps refresher awards without repeating an expired grant forever", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [grant(p)];
    s.refreshers = [
      {
        id: "refresh",
        name: "Refresher",
        issuerId: s.employerId,
        employmentId: "initial",
        firstMonth: "2027-01",
        lastMonth: "2028-01",
        every: "12",
        value: "40000",
        template: "annual",
        treatment: "sell",
        untilNextRole: false,
      },
    ];
    const r = projectScenario(s, p.shared);
    expect(r.rows.slice(0, 6).map((r) => r.stockGross)).toEqual([
      25000, 35000, 45000, 45000, 20000, 10000,
    ]);
    expect(r.rows[6].stockGross).toBe(0);
  });
  it("forfeits unvested grants at departure and supports individual retention", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.grants = [grant(p, { schedule: templateSchedule("quarterly") })];
    s.events = [
      event(p, {
        id: "newjob",
        kind: "job",
        month: "2027-07",
        base: "0",
        bonus: "0",
        growth: "0",
      }),
    ];
    const r = projectScenario(s, p.shared);
    expect(r.rows[1].forfeitedEquity).toBe(62500);
    expect(r.rows.at(-1)!.endingBalance).toBe(37500);
    s.grants[0].keepOnDeparture = true;
    expect(projectScenario(s, p.shared).rows.at(-1)!.endingBalance).toBe(
      100000,
    );
  });
  it("keeps old vested holdings after departure and counts appreciation once", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.issuers[0].appreciation = "10";
    s.grants = [
      grant(p, {
        treatment: "hold",
        schedule: [{ month: "1", percent: "100" }],
      }),
    ];
    s.events = [
      event(p, {
        id: "newjob",
        kind: "job",
        month: "2027-01",
        base: "0",
        bonus: "0",
        growth: "0",
      }),
    ];
    const r = projectScenario(s, p.shared);
    expect(r.rows[0].balances.employerStock).toBeCloseTo(110000);
    expect(r.rows[1].balances.employerStock).toBeCloseTo(121000);
    expect(r.rows[0].balances.taxable).toBe(0);
    expect(r.rows[0].endingBalance).toBeCloseTo(110000);
  });
  it("taxes both sell and hold vests using identical incremental liability", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.base = "100000";
    s.taxProfile = {
      ...s.taxProfile,
      mode: "calculated",
      location: "columbus",
    };
    s.grants = [
      grant(p, { value: "50000", schedule: [{ month: "12", percent: "100" }] }),
    ];
    const sold = projectScenario(s, p.shared);
    s.grants[0].treatment = "hold";
    const held = projectScenario(s, p.shared);
    expect(sold.rows[0].stockTaxes).toBeCloseTo(18014);
    expect(held.rows[0].stockTaxes).toBe(sold.rows[0].stockTaxes);
    expect(held.rows[0].balances.employerStock).toBeCloseTo(31986);
    expect(sold.rows[0].endingBalance).toBeCloseTo(held.rows[0].endingBalance);
  });
  it("stops old-employer refresher awards and replaces role-policy grants at the next event", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.events = [
      event(p, {
        month: "2026-01",
        base: "0",
        bonus: "0",
        growth: "0",
        refresherValue: "40000",
        refresherAfter: "6",
        refresherEvery: "6",
      }),
      event(p, {
        id: "second",
        month: "2027-01",
        base: "0",
        bonus: "0",
        growth: "0",
        refresherValue: "80000",
        refresherAfter: "12",
      }),
    ];
    const eq = buildEquity(s, p.shared);
    expect(
      eq.grants.filter((g) => g.id.startsWith("promotion:refresh")),
    ).toHaveLength(1);
    expect(eq.grants.find((g) => g.id === "second:refresh:24")?.value).toBe(
      "80000",
    );
  });
  it("supports retention overrides for generated promotion awards without mutating inputs", () => {
    const p = fixture(),
      s = p.scenarios[0];
    s.events = [
      event(p, {
        month: "2026-01",
        awardValue: "100000",
        base: "0",
        bonus: "0",
        growth: "0",
      }),
      event(p, {
        id: "job",
        kind: "job",
        month: "2027-01",
        base: "0",
        bonus: "0",
        growth: "0",
      }),
    ];
    s.grantOverrides["promotion:award"] = true;
    expect(projectScenario(s, p.shared).rows[3].stockGross).toBe(25000);
    expect(s.events[0].awardValue).toBe("100000");
  });
  it("rejects invalid schedules and conflicting career events", () => {
    expect(scheduleError([{ month: "12", percent: "90" }])).toBeTruthy();
    const p = fixture(),
      s = p.scenarios[0];
    s.events = [event(p), event(p, { id: "duplicate" })];
    expect(() => projectScenario(s, p.shared)).toThrow();
  });
  it("handles a 40-year horizon with finite balances", () => {
    const p = fixture(),
      s = p.scenarios[0];
    p.shared.years = "40";
    p.shared.returns = "30";
    p.shared.taxInflation = "10";
    s.base = "10000000";
    s.growth = "20";
    s.grants = [grant(p)];
    expect(
      projectScenario(s, p.shared).months.every((r) =>
        Number.isFinite(r.endingBalance),
      ),
    ).toBe(true);
  });
  it("formats month offsets across years and historical dates consistently", () => {
    expect(monthLabel(-1, 2026)).toBe("2025-12");
    expect(monthLabel(12, 2026)).toBe("2027-01");
  });
});
