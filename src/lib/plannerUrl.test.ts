import { describe, it, expect } from "vitest";
import { defaultPlanner } from "./planner";
import { projectScenario } from "./projection";
import { monthlyExpenses } from "./model";
import { parsePlannerUrlParams, buildPlannerSearchString } from "./plannerUrl";

describe("plannerUrl", () => {
  it("parses query parameters and applies them to planner state", () => {
    const search =
      "?salary=150000&bonus=20000&equity=40000&location=san-francisco&filing=joint&spouse_salary=60000&savings=80000&years=15&returns=8";
    const { mode, hasCustomParams, applyTo } = parsePlannerUrlParams(search);

    expect(hasCustomParams).toBe(true);
    expect(mode).toBeUndefined();

    const base = defaultPlanner();
    const updated = applyTo(base);

    expect(updated.scenarios[0].base).toBe("150000");
    expect(updated.scenarios[0].bonus).toBe("20000");
    expect(updated.scenarios[0].stock).toBe("40000");
    expect(updated.scenarios[0].includeStock).toBe(true);
    expect(projectScenario(updated.scenarios[0], updated.shared).rows[0].stockGross).toBe(40000);
    expect(updated.scenarios[0].taxProfile.location).toBe("san-francisco");
    expect(updated.scenarios[0].taxProfile.filing).toBe("joint");
    expect(updated.scenarios[0].taxProfile.spouseWages).toBe("60000");
    expect(updated.shared.starting).toBe("80000");
    expect(updated.shared.years).toBe("15");
    expect(updated.shared.returns).toBe("8");
  });

  it("preserves the monthly expense total when splitting it into categories", () => {
    const parsed = parsePlannerUrlParams("?expenses=3999.99");
    expect(parsed.valid).toBe(true);
    expect(monthlyExpenses(parsed.applyTo(defaultPlanner()).scenarios[0])).toBeCloseTo(3999.99, 8);
    expect(parsePlannerUrlParams("?expenses=-0.001").valid).toBe(false);
  });

  it("rejects overrides outside planner input limits", () => {
    const base = defaultPlanner();
    for (const query of ["salary=-1", "salary=1e3", "years=2.5", "returns=-100", "match_rate=101"]) {
      const parsed = parsePlannerUrlParams('?' + query);
      expect(parsed.valid).toBe(false);
      expect(parsed.applyTo(base)).toBe(base);
    }
  });

  it("handles mode parameter", () => {
    const q1 = parsePlannerUrlParams("?mode=detailed");
    expect(q1.mode).toBe("detailed");

    const q2 = parsePlannerUrlParams("?mode=quick");
    expect(q2.mode).toBe("quick");
  });

  it("builds search string cleanly omitting defaults", () => {
    const p = defaultPlanner();
    const query = buildPlannerSearchString(p, true);
    expect(query).toBe("?share=1&mode=quick");

    p.scenarios[0].base = "180000";
    const queryUpdated = buildPlannerSearchString(p, false);
    expect(queryUpdated).toContain("mode=detailed");
    expect(queryUpdated).toContain("salary=180000");
  });

  it("marks even a default estimate as a share that can be loaded independently", () => {
    const parsed = parsePlannerUrlParams(
      buildPlannerSearchString(defaultPlanner(), true),
    );
    expect(parsed.hasCustomParams).toBe(true);
    expect(parsed.mode).toBe("quick");
    const loaded = parsed.applyTo(defaultPlanner());
    expect(loaded.scenarios[0].base).toBe(defaultPlanner().scenarios[0].base);
  });

  it("safely ignores invalid locations or malformed numbers", () => {
    const search = "?salary=invalid&location=atlantis";
    const { applyTo, valid } = parsePlannerUrlParams(search);
    expect(valid).toBe(false);
    const base = defaultPlanner();
    const updated = applyTo(base);
    expect(updated.scenarios[0].base).toBe(base.scenarios[0].base);
    expect(updated.scenarios[0].taxProfile.location).toBe(
      base.scenarios[0].taxProfile.location,
    );
  });
});

describe("full plan links", () => {
  it("round trips both scenarios, detailed inputs and view with a compact delta", async () => {
    const { fullPlannerUrl, readFullPlannerLink } = await import(
      "./plannerUrl"
    );
    const plan = defaultPlanner();
    plan.comparison = true;
    plan.scenarios[0].name = "Offer & equity 🏡";
    plan.shared.starting = "12345";
    const url = fullPlannerUrl("https://example.com/", plan, false);
    expect(url.length).toBeLessThan(500);
    expect(readFullPlannerLink(new URL(url).search)).toEqual({
      state: plan,
      quickMode: false,
    });
    expect(
      new URL(fullPlannerUrl(url, null, false)).searchParams.has("plan"),
    ).toBe(false);
  });
  it("preserves extensive plan edits including custom grants, accounts, tiers, and comparison", async () => {
    const { fullPlannerUrl, readFullPlannerLink } = await import(
      "./plannerUrl"
    );
    const { templateSchedule } = await import("../data/vesting");
    const plan = defaultPlanner();
    plan.comparison = true;
    plan.shared.starting = "75000";
    plan.shared.years = "18";
    plan.shared.startingAccounts = [
      {
        id: "a1",
        owner: "primary",
        type: "traditional-401k",
        balance: "50000",
      },
      { id: "a2", owner: "spouse", type: "roth-ira", balance: "20000" },
    ];
    plan.scenarios[0].base = "215000";
    plan.scenarios[0].bonus = "35000";
    plan.scenarios[0].stockMode = "grants";
    plan.scenarios[0].grants = [
      {
        id: "grant-test-1",
        name: "Initial grant",
        issuerId: plan.scenarios[0].employerId,
        employmentId: "initial",
        month: "2026-01",
        units: "dollars",
        value: "200000",
        priceMode: "modeled",
        grantPrice: "100",
        schedule: templateSchedule("quarterly"),
        template: "quarterly",
        treatment: "sell",
        keepOnDeparture: false,
      },
    ];
    plan.scenarios[0].employerMatch = {
      type: "tiered",
      rate: "0",
      payPercent: "0",
      cap: "10000",
      tiers: [
        { rate: "100", payPercent: "4" },
        { rate: "50", payPercent: "2" },
      ],
      vestingType: "graded-4",
      vestingSchedule: ["25", "50", "75", "100"],
    };
    plan.scenarios[0].retirementTargets.primary.workplace401k = {
      mode: "dollars",
      amount: "23500",
      traditionalSharePercent: "80",
      rothSharePercent: "20",
    };
    plan.scenarios[1].base = "230000";
    plan.scenarios[1].taxProfile.location = "san-francisco";

    const url = fullPlannerUrl("https://example.com/", plan, false);
    const parsed = readFullPlannerLink(new URL(url).search);
    expect(parsed).toEqual({ state: plan, quickMode: false });
  });
  it("reads legacy format 1 full plan links", async () => {
    const { readFullPlannerLink } = await import("./plannerUrl");
    const plan = defaultPlanner();
    plan.scenarios[0].base = "185000";
    const legacySearch = `?plan=${encodeURIComponent(JSON.stringify({ format: 1, quickMode: true, planner: plan }))}`;
    const result = readFullPlannerLink(legacySearch);
    expect(result?.quickMode).toBe(true);
    expect(result?.state.scenarios[0].base).toBe("185000");
  });
  it("rejects malformed full links", async () => {
    const { readFullPlannerLink } = await import("./plannerUrl");
    expect(() => readFullPlannerLink("?plan=invalid")).toThrow();
    const unsupported = new URLSearchParams({ plan: JSON.stringify({ format: 1, planner: { ...defaultPlanner(), version: 99 } }) });
    const malformed = new URLSearchParams({ plan: JSON.stringify({ format: 2, delta: { comparison: "yes" } }) });
    expect(() => readFullPlannerLink(`?${unsupported}`)).toThrow();
    expect(() => readFullPlannerLink(`?${malformed}`)).toThrow();
  });
});

it("round trips complete startup fragment links and rejects malformed fragments", async () => {
  const { sessionShareUrl, readSessionLink } = await import("./plannerUrl");
  const { emptyStartupSession } = await import("./startupComparison");
  const state = defaultPlanner();
  const startup = emptyStartupSession();
  startup.scenario = 1;
  startup.inputs[1].grant = "12000";
  const url = new URL(
    sessionShareUrl("https://example.com/?other=1", state, startup),
  );
  expect(readSessionLink(url.hash)).toEqual({ state, startup });
  expect(() => readSessionLink("#plan=broken")).toThrow();
  const invalid = new URLSearchParams({
    plan: JSON.stringify({
      format: 3,
      planner: { ...state, version: 99 },
      startup,
    }),
  });
  expect(() => readSessionLink(`#${invalid}`)).toThrow();
});
