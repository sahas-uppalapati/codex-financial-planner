import { describe, expect, it } from "vitest";
import {
  applyCompensation,
  applyLocation,
  compensationPresets,
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
  it.each(compensationPresets)(
    "applies verified compensation $id without affecting other fields",
    (p) => {
      const original = defaultState().scenarios[0],
        applied = applyCompensation(original, p);
      expect(applied).toMatchObject({
        base: String(p.base),
        stock: String(p.stock),
        bonus: String(p.bonus),
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
    expect(compensationPresets.some((p) => p.company === "Google")).toBe(false);
    expect(
      compensationPresets.every(
        (p) =>
          p.scope === "United States" &&
          p.statistic === "Reported average" &&
          !!p.source &&
          !!p.reportedPeriod,
      ),
    ).toBe(true);
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
