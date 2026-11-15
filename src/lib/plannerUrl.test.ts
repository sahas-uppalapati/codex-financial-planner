import { describe, it, expect } from "vitest";
import { defaultPlanner } from "./planner";
import { parsePlannerUrlParams, buildPlannerSearchString } from "./plannerUrl";

describe("plannerUrl", () => {
  it("parses query parameters and applies them to planner state", () => {
    const search = "?salary=150000&bonus=20000&equity=40000&location=san-francisco&filing=joint&spouse_salary=60000&savings=80000&years=15&returns=8";
    const { mode, hasCustomParams, applyTo } = parsePlannerUrlParams(search);

    expect(hasCustomParams).toBe(true);
    expect(mode).toBeUndefined();

    const base = defaultPlanner();
    const updated = applyTo(base);

    expect(updated.scenarios[0].base).toBe("150000");
    expect(updated.scenarios[0].bonus).toBe("20000");
    expect(updated.scenarios[0].stock).toBe("40000");
    expect(updated.scenarios[0].includeStock).toBe(true);
    expect(updated.scenarios[0].taxProfile.location).toBe("san-francisco");
    expect(updated.scenarios[0].taxProfile.filing).toBe("joint");
    expect(updated.scenarios[0].taxProfile.spouseWages).toBe("60000");
    expect(updated.shared.starting).toBe("80000");
    expect(updated.shared.years).toBe("15");
    expect(updated.shared.returns).toBe("8");
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
    const parsed = parsePlannerUrlParams(buildPlannerSearchString(defaultPlanner(), true));
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
    expect(updated.scenarios[0].taxProfile.location).toBe(base.scenarios[0].taxProfile.location);
  });
});

describe("full plan links", () => {
  it("round trips both scenarios, detailed inputs and view", async () => {
    const { fullPlannerUrl, readFullPlannerLink } = await import("./plannerUrl");
    const plan = defaultPlanner();
    plan.comparison = true;
    plan.scenarios[0].name = "Offer & equity 🏡";
    plan.shared.starting = "12345";
    const url = fullPlannerUrl("https://example.com/", plan, false);
    expect(readFullPlannerLink(new URL(url).search)).toEqual({ state: plan, quickMode: false });
    expect(new URL(fullPlannerUrl(url, null, false)).searchParams.has("plan")).toBe(false);
  });
  it("rejects malformed full links", async () => {
    const { readFullPlannerLink } = await import("./plannerUrl");
    expect(() => readFullPlannerLink("?plan=invalid")).toThrow();
  });
});
