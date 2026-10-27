import { describe, it, expect } from "vitest";
import { defaultPlanner } from "./planner";
import { defaultState } from "./model";
import { loadPlanner, savePlanner, PLANNER_KEY } from "./plannerStorage";
import { STORAGE_KEY } from "./storage";
import { plannerCsv } from "./plannerCsv";
import { projectScenario } from "./projection";
const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};
describe("v2 persistence and migration", () => {
  it("preserves customized v2 profiles, employers, benefits and assumptions", () => {
    const storage = memory(),
      p = defaultPlanner();
    p.scenarios[0].taxProfile.filing = "joint";
    p.scenarios[0].taxProfile.spouseWages = "100000";
    p.scenarios[0].benefits.retirement = "12000";
    p.scenarios[0].issuers[0].appreciation = "8";
    p.shared.taxInflation = "3";
    expect(savePlanner(storage, p)).toBe(true);
    expect(loadPlanner(storage).state).toEqual(p);
  });
  it("migrates v1 without inventing grants or losing tax and legacy stock inputs", () => {
    const storage = memory(),
      old = defaultState();
    old.scenarios[0].stock = "50000";
    old.scenarios[0].includeStock = true;
    storage.setItem(STORAGE_KEY, JSON.stringify(old));
    const loaded = loadPlanner(storage);
    expect(loaded.state.version).toBe(2);
    expect(loaded.state.scenarios[0].taxProfile.mode).toBe("manual");
    expect(loaded.state.scenarios[0].tax).toBe("25");
    expect(loaded.state.scenarios[0].stockMode).toBe("legacy");
    expect(loaded.state.scenarios[0].stock).toBe("50000");
    expect(loaded.state.scenarios[0].grants).toEqual([]);
    expect(loaded.message).toContain("monthly");
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(old));
    expect(savePlanner(storage, loaded.state)).toBe(true);
  });
  it("keeps the last valid save while fields are invalid", () => {
    const storage = memory(),
      p = defaultPlanner();
    savePlanner(storage, p);
    const invalid = structuredClone(p);
    invalid.scenarios[0].base = "";
    expect(savePlanner(storage, invalid)).toBe(false);
    expect(loadPlanner(storage).state).toEqual(p);
  });
  it.each(["null", "{}", "{broken", '{"version":2,"scenarios":[{},{}]}'])(
    "recovers from malformed v2 input %s",
    (raw) => {
      const storage = memory();
      storage.setItem(PLANNER_KEY, raw);
      expect(loadPlanner(storage).state).toEqual(defaultPlanner());
      expect(loadPlanner(storage).message).toBeTruthy();
    },
  );
  it("rejects a valid-looking save with a malformed nested issuer or unsupported enum", () => {
    const storage = memory(),
      p = defaultPlanner();
    (p.scenarios[0].issuers[0] as unknown as { price: null }).price = null;
    storage.setItem(PLANNER_KEY, JSON.stringify(p));
    expect(loadPlanner(storage).message).toBeTruthy();
  });
  it("handles unavailable storage and quota failures", () => {
    const storage = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("quota");
      },
    };
    expect(loadPlanner(storage).state).toEqual(defaultPlanner());
    expect(savePlanner(storage, defaultPlanner())).toBe(false);
  });
});
describe("v2 annual and monthly CSV", () => {
  it("exports both scenarios, starting assets, components, and full monthly data", () => {
    const p = defaultPlanner(),
      series = p.scenarios.map((s) => ({
        name: s.name,
        projection: projectScenario(s, p.shared),
      }));
    const annual = plannerCsv(series),
      monthly = plannerCsv(series, true);
    expect(annual).toContain("Healthcare premium offset");
    expect(annual).toContain("Payroll health premiums");
    expect(annual).toContain("Columbus offer");
    expect(annual).toContain("Seattle offer");
    expect(annual.split("\r\n")).toHaveLength(23);
    expect(monthly.split("\r\n")).toHaveLength(243);
    expect(monthly).toContain("2026-01");
    expect(annual).toContain(String(series[0].projection.rows[0].taxes));
  });
  it("exports equal field counts for headers, starting rows, and period rows", () => {
    const p = defaultPlanner(),
      series = [
        {
          name: "Offer",
          projection: projectScenario(p.scenarios[0], p.shared),
        },
      ];
    for (const monthly of [false, true]) {
      const rows = plannerCsv(series, monthly)
        .split("\r\n")
        .map((r) => r.split(",").length);
      expect(rows.every((n) => n === rows[0])).toBe(true);
    }
  });
  it("continues to neutralize spreadsheet formulas in user-entered names", () => {
    const p = defaultPlanner();
    const csv = plannerCsv([
      {
        name: '=HYPERLINK("x")',
        projection: projectScenario(p.scenarios[0], p.shared),
      },
    ]);
    expect(csv).toContain("'=HYPERLINK");
  });
});
