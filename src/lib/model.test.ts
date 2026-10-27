import { describe, expect, it } from "vitest";
import {
  defaultState,
  fieldError,
  isValidState,
  project,
  savingsRate,
  scenarioErrors,
  toInput,
  toShared,
} from "./model";
const defaults = () => {
  const s = defaultState();
  return { input: toInput(s.scenarios[0]), shared: toShared(s.shared) };
};
describe("annual investment model", () => {
  it("matches every specified year-one default result", () => {
    const { input, shared } = defaults();
    const r = project(input, shared)[0];
    expect(r).toMatchObject({
      grossIncome: 100000,
      taxes: 25000,
      takeHome: 75000,
      expenses: 36000,
      surplus: 39000,
      stockContribution: 0,
      endingBalance: 60000,
    });
    expect(r.surplus / 12).toBe(3250);
    expect(savingsRate(r)).toBe(0.52);
  });
  it("accumulates linearly with zero return, growth and inflation", () => {
    const { input, shared } = defaults();
    const rows = project(
      { ...input, growth: 0 },
      { ...shared, inflation: 0, returns: 0 },
    );
    expect(rows.map((r) => r.endingBalance)).toEqual(
      Array.from({ length: 10 }, (_, i) => 20000 + 39000 * (i + 1)),
    );
  });
  it("first applies salary growth and expense inflation in year two", () => {
    const { input, shared } = defaults();
    const rows = project(input, shared);
    expect(rows[0].base).toBe(100000);
    expect(rows[0].expenses).toBe(36000);
    expect(rows[1].base).toBe(103000);
    expect(rows[1].expenses).toBeCloseTo(36900);
  });
  it("lets shortfalls exhaust investments and never applies returns to negative openings", () => {
    const { input, shared } = defaults();
    const rows = project(
      { ...input, base: 0, monthlyExpenses: 3000 },
      { ...shared, years: 3, inflation: 0, returns: 5 },
    );
    expect(rows.map((r) => r.endingBalance)).toEqual([-15000, -51000, -87000]);
    expect(rows[1].investmentGain).toBe(0);
    expect(rows[2].investmentGain).toBe(0);
  });
  it("resumes returns only in the year following recovery from a shortfall", () => {
    const { input, shared } = defaults();
    const rows = project(
      { ...input, base: 100, growth: 20, tax: 0, monthlyExpenses: 10 },
      { ...shared, starting: 0, years: 5, returns: 10, inflation: 0 },
    );
    expect(rows[0].endingBalance).toBe(-20);
    expect(rows[1].endingBalance).toBe(-20);
    expect(rows[2].endingBalance).toBe(4);
    expect(rows[2].investmentGain).toBe(0);
    expect(rows[3].investmentGain).toBeCloseTo(0.4);
  });
  it("produces identical projections for identical scenarios", () => {
    const { input, shared } = defaults();
    expect(project(input, shared)).toEqual(
      project({ ...input }, { ...shared }),
    );
  });
  it("excludes stock by default and invests after-tax stock at year-end when included", () => {
    const { input, shared } = defaults();
    const excluded = project({ ...input, stock: 40000 }, shared)[0];
    const included = project(
      { ...input, stock: 40000, includeStock: true },
      shared,
    )[0];
    expect(excluded.endingBalance).toBe(60000);
    expect(excluded.stockContribution).toBe(0);
    expect(included.endingBalance).toBe(90000);
    expect(included.stockContribution).toBe(30000);
    expect(included.takeHome).toBe(75000);
    expect(included.taxes).toBe(35000);
  });
  it("keeps bonus and stock constant while base alone grows", () => {
    const { input, shared } = defaults();
    const rows = project(
      { ...input, bonus: 12000, stock: 10000, includeStock: true },
      shared,
    );
    expect(rows[1].base).toBe(103000);
    expect(rows[1].bonus).toBe(12000);
    expect(rows[1].stockGross).toBe(10000);
    expect(rows[0].takeHome / 12).toBe(7000);
  });
  it("supports zero salary, expenses and return without an undefined savings number", () => {
    const { input, shared } = defaults();
    const r = project(
      { ...input, base: 0, growth: 0, monthlyExpenses: 0 },
      { ...shared, returns: 0 },
    )[0];
    expect(r.endingBalance).toBe(20000);
    expect(savingsRate(r)).toBeNull();
  });
  it("supports negative returns above -100%", () => {
    const { input, shared } = defaults();
    expect(
      project(
        { ...input, base: 0, monthlyExpenses: 0 },
        { ...shared, returns: -50 },
      )[0].endingBalance,
    ).toBe(10000);
  });
  it("keeps full precision across years", () => {
    const { input, shared } = defaults();
    const r = project(
      { ...input, base: 100.123, tax: 12.345, monthlyExpenses: 0, growth: 0 },
      { ...shared, years: 2, starting: 10.123, returns: 1.234, inflation: 0 },
    );
    const surplus = 100.123 * (1 - 0.12345);
    expect(r[1].endingBalance).toBeCloseTo(
      (10.123 * 1.01234 + surplus) * 1.01234 + surplus,
      10,
    );
  });
  it("never overflows even at maximum accepted inputs and 40 years", () => {
    const { input, shared } = defaults();
    const rows = project(
      {
        ...input,
        base: 1e7,
        stock: 1e7,
        bonus: 1e7,
        growth: 20,
        includeStock: true,
        monthlyExpenses: 1e6,
      },
      { ...shared, starting: 1e7, years: 40, returns: 30, inflation: 20 },
    );
    expect(rows.every((r) => Object.values(r).every(Number.isFinite))).toBe(
      true,
    );
  });
  it.each([NaN, Infinity, -1, 10000001])(
    "rejects invalid salary %s before projection",
    (base) => {
      const { input, shared } = defaults();
      expect(() => project({ ...input, base }, shared)).toThrow(RangeError);
    },
  );
  it.each([
    { tax: 101 },
    { tax: -1 },
    { growth: 21 },
    { monthlyExpenses: -1 },
    { stock: NaN },
    { bonus: Infinity },
  ])("rejects invalid scenario %j", (bad) => {
    const { input, shared } = defaults();
    expect(() => project({ ...input, ...bad }, shared)).toThrow(RangeError);
  });
  it.each([
    { starting: -1 },
    { years: 0 },
    { years: 41 },
    { years: 2.5 },
    { returns: -100 },
    { returns: Infinity },
    { inflation: -1 },
  ])("rejects invalid assumption %j", (bad) => {
    const { input, shared } = defaults();
    expect(() => project(input, { ...shared, ...bad })).toThrow(RangeError);
  });
});
describe("editable field validation", () => {
  it.each(["", " ", "NaN", "Infinity", "1e999", "abc", "-1"])(
    "rejects invalid money %s",
    (value) => expect(fieldError(value, "base")).toBeTruthy(),
  );
  it("accepts decimal and zero values without reformatting them", () => {
    expect(fieldError("0", "base")).toBeUndefined();
    expect(fieldError("100.123", "base")).toBeUndefined();
    expect(fieldError("-99.9", "returns")).toBeUndefined();
    expect(fieldError("-99.999", "returns")).toBeUndefined();
  });
  it("rejects category totals above the expense limit", () => {
    const s = defaultState().scenarios[0];
    s.expenses.housing = "1000000";
    expect(scenarioErrors(s).expenses).toBeTruthy();
  });
  it("ignores a hidden comparison for results, and validates it when revealed", () => {
    const s = defaultState();
    s.scenarios[1].base = "";
    expect(isValidState(s)).toBe(true);
    s.comparison = true;
    expect(isValidState(s)).toBe(false);
  });
});
