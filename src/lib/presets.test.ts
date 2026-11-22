import { describe, expect, it } from "vitest";
import {
  applyCompensation,
  applyLocation,
  compensationPresets,
  compensationRegions,
  compensationStatus,
  findCompensation,
  locationPresets,
  locationStatus,
} from "../data/presets";
import {
  defaultState,
  monthlyExpenses,
  toInput,
  toShared,
  project,
} from "./model";
import { loadState, saveState, STORAGE_KEY } from "./storage";
import { csvCell, projectionCsv } from "./csv";
import { buildTechProgressionEvents, findTechCompPoint, getTechProgressionTimeline, techCompanies, techLevels } from "../data/techCompPresets";
import { taxLocations } from "./planner";
const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
};
describe("presets and persistence", () => {
  it("models Amazon L4 to L5 after 24 months in both timelines and events", () => {
    const timeline = getTechProgressionTimeline("amazon", "l4", "seattle", 2026, 10);
    const events = buildTechProgressionEvents("amazon", "l4", "seattle", "employer", 2026, 10);
    expect(timeline[1]).toMatchObject({ levelId: "l5", monthsFromStart: 24, monthLabel: "2028-01" });
    expect(events[0]).toMatchObject({ month: "2028-01", presetProgression: "amazon" });
    expect(timeline[2]).toMatchObject({ levelId: "l6", monthsFromStart: 84, monthLabel: "2033-01" });
    expect(events[1].month).toBe("2033-01");
    expect(buildTechProgressionEvents("amazon", "l5", "seattle", "employer", 2026, 10)[0].month).toBe("2031-01");
  });
  it("estimates Amazon sign-on without treating it as recurring bonus", () => {
    const point = findTechCompPoint("amazon", "l4", "new-york")!;
    const source = compensationPresets.find((p) => p.company === "Amazon" && p.stage === "entry" && p.scope === "New York City Area")!;
    expect(point.bonus).toBe(0);
    expect(point.signOnY1! + point.signOnY2!).toBe(source.bonus * 4);
    expect(point.signOnY1! - point.signOnY2!).toBeCloseTo(source.stock * 0.4);
    expect(findTechCompPoint("amazon", "l4", "seattle")).toMatchObject({ base: 129000, grantTotal: 109000, annualRsu: 27250, signOnY1: 54000, signOnY2: 33000, usesRoundedInputs: true });
    expect(findTechCompPoint("meta", "e3", "seattle")!.signOnY1).toBeUndefined();
  });
  it("maps every supported company, level and location to consistent promotion inputs", () => {
    for (const company of techCompanies) for (const location of taxLocations) for (const level of techLevels[company.id]) {
      const point = findTechCompPoint(company.id, level.id, location.id);
      if (!point) continue;
      expect(point.base).toBeGreaterThan(0);
      expect(point.grantTotal).toBe(point.annualRsu * 4);
      const events = buildTechProgressionEvents(company.id, level.id, location.id, "employer", 2026, 10);
      if (company.id === "microsoft") expect(events).toHaveLength(0);
      for (const event of events) {
        const target = techLevels[company.id].find((item) => event.role.startsWith(item.title))!;
        const targetPay = findTechCompPoint(company.id, target.id, location.id)!;
        expect(Number(event.base)).toBe(targetPay.base);
        expect(Number(event.bonus)).toBe(targetPay.bonus);
        expect(event.awardValue).toBe("0");
        expect(event.promotionTargetTc).toBe(targetPay.annualRsu > 0
          ? String(targetPay.base + targetPay.bonus + targetPay.annualRsu)
          : undefined);
      }
    }
  });
  it("uses the published Los Angeles County budget", () => {
    const la = locationPresets.find((preset) => preset.id === "los-angeles")!;
    expect(la.annualPublished.housing).toBe(22471);
    expect(la.annualPublished.transportation).toBe(8681);
    expect(la.source).toBe("https://livingwage.mit.edu/counties/06037");
  });
  it.each(compensationPresets)(
    "applies verified compensation $id without affecting other fields",
    (p) => {
      const original = defaultState().scenarios[0],
        applied = applyCompensation(original, p);
      expect(applied).toMatchObject({
        base: String(p.base),
        stock: String(p.stockKind === "annualized" ? p.stock : 0),
        bonus: String(p.bonusProjection),
        tax: original.tax,
        expenses: original.expenses,
        includeStock: false,
      });
      expect(compensationStatus(applied)).toContain(p.company);
      expect(compensationStatus({ ...applied, base: "1" })).toBe("Customized");
    },
  );
  it.each(locationPresets)(
    "applies budget $id without affecting compensation or tax",
    (p) => {
      const original = defaultState().scenarios[0],
        applied = applyLocation(original, p);
      expect(applied.base).toBe(original.base);
      expect(applied.stock).toBe(original.stock);
      expect(applied.bonus).toBe(original.bonus);
      expect(applied.tax).toBe(original.tax);
      expect(monthlyExpenses(applied)).toBe(
        Object.values(p.expenses).reduce((a, b) => a + Number(b), 0),
      );
      expect(locationStatus(applied)).toContain("Minimum needs");
      expect(
        locationStatus({
          ...applied,
          expenses: { ...applied.expenses, food: "1" },
        }),
      ).toBe("Customized");
    },
  );
  it.each(locationPresets)(
    "maps published annual costs exactly once for $id",
    (p) => {
      const annual = Object.values(p.annualPublished).reduce(
        (a, b) => a + b,
        0,
      );
      const monthly = Object.values(p.expenses).reduce(
        (a, b) => a + Number(b),
        0,
      );
      expect(Math.abs(monthly * 12 - annual)).toBeLessThan(0.31);
      expect(p.expenses.housing).toBe(
        (
          (p.annualPublished.housing + p.annualPublished.internetMobile) /
          12
        ).toFixed(2),
      );
      expect(p.expenses.other).toBe(
        ((p.annualPublished.civic + p.annualPublished.other) / 12).toFixed(2),
      );
    },
  );
  it("does not apply a preset when selector values alone change", () => {
    const s = defaultState().scenarios[0];
    const changed = {
      ...s,
      company: "Apple",
      stage: "senior",
      location: "seattle",
    };
    expect(findCompensation(changed)).toBeDefined();
    expect(changed.base).toBe("100000");
    expect(monthlyExpenses(changed)).toBe(3000);
  });
  it("omits incompatible or unverified presets", () => {
    expect(findTechCompPoint("constructor", "l4", "seattle")).toBeUndefined();
    expect(getTechProgressionTimeline("constructor", "l4", "seattle")).toEqual([]);
    expect(
      compensationPresets.every(
        (p) =>
          compensationRegions.includes(p.scope) &&
          p.statistic === "Reported average" &&
          !!p.source &&
          !!p.reportedPeriod,
      ),
    ).toBe(true);
    // Microsoft senior detailed component breakdown was unverified in source snapshots
    expect(
      compensationPresets.some(
        (p) => p.company === "Microsoft" && p.stage === "senior",
      ),
    ).toBe(false);
  });
  it("restores legacy un-scoped preset IDs without wiping saves", () => {
    const storage = memoryStorage(),
      s = defaultState();
    // Simulate legacy v1 save with old appliedCompensation format "meta-entry"
    s.scenarios[0].appliedCompensation = "meta-entry";
    saveState(storage, s);
    const restored = loadState(storage);
    expect(restored.message).toBe("");
    expect(restored.state.scenarios[0].appliedCompensation).toBe("meta-entry-united-states");
  });
  it("restores customized fields, selected and applied presets and both scenarios", () => {
    const storage = memoryStorage(),
      s = defaultState();
    s.comparison = true;
    s.scenarios[0] = {
      ...applyLocation(
        applyCompensation(s.scenarios[0], compensationPresets[0]),
        locationPresets[1],
      ),
      base: "150001",
      company: "Apple",
      location: "boston",
    };
    expect(saveState(storage, s)).toBe(true);
    expect(loadState(storage).state).toEqual(s);
  });
  it("does not overwrite the last valid save with invalid inputs", () => {
    const storage = memoryStorage(),
      s = defaultState();
    saveState(storage, s);
    const invalid = structuredClone(s);
    invalid.scenarios[0].base = "";
    expect(saveState(storage, invalid)).toBe(false);
    expect(loadState(storage).state).toEqual(s);
  });
  it.each([
    "{broken",
    "null",
    "{}",
    '{"version":2}',
    '{"version":1,"comparison":false,"scenarios":[{},{}],"shared":{}}',
  ])("recovers from malformed save %s", (raw) => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, raw);
    expect(loadState(storage).state).toEqual(defaultState());
    expect(loadState(storage).message).toBeTruthy();
  });
  it("handles unavailable storage and write quotas", () => {
    const storage = {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("quota");
      },
    };
    expect(loadState(storage).state).toEqual(defaultState());
    expect(saveState(storage, defaultState())).toBe(false);
  });
});
describe("CSV export", () => {
  it("exports both scenarios including starting balance and stock components", () => {
    const s = defaultState(),
      shared = toShared(s.shared);
    const csv = projectionCsv(
      s.scenarios.map((s) => ({
        name: s.name,
        rows: project(toInput(s), shared),
      })),
      shared.starting,
    );
    expect(csv).toContain("Columbus offer");
    expect(csv).toContain("Seattle offer");
    expect(csv).toContain("After-tax stock contribution");
    expect(csv.split("\r\n")).toHaveLength(23);
    expect(csv).toContain('"60000"');
  });
  it("quotes names and prevents formula injection without changing numeric negative balances", () => {
    expect(csvCell('"Offer, A"')).toBe('"""Offer, A"""');
    expect(csvCell(" =1+2")).toBe('"\' =1+2"');
    expect(csvCell(-200)).toBe('"-200"');
  });
});
