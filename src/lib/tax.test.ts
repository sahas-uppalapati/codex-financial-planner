import { describe, it, expect } from "vitest";
import { calculateTaxes } from "./tax";
import type { WorkerTaxInput } from "./tax";
import { defaultPlanner } from "./planner";
import type { TaxLocation } from "./planner";
const worker = (cash: number, stock = 0): WorkerTaxInput => ({
  cash,
  stock,
  retirement: 0,
  health: 0,
  hsa: 0,
});
function profile(location: TaxLocation = "austin") {
  return { ...defaultPlanner().scenarios[0].taxProfile, location };
}
describe("independent 2026 W-2 tax fixtures", () => {
  it("calculates federal brackets and payroll for a $100,000 single worker", () => {
    const r = calculateTaxes([worker(100000)], profile(), 2026, 2.5);
    expect(r.federalTaxable).toBe(83900);
    expect(r.federalIncome).toBeCloseTo(13170, 8);
    expect(r.socialSecurity).toBe(6200);
    expect(r.medicare).toBe(1450);
    expect(r.total).toBeCloseTo(20820, 8);
  });
  it("uses joint deductions and separate Social Security caps for two earners", () => {
    const r = calculateTaxes(
      [worker(200000), worker(200000)],
      { ...profile(), filing: "joint" },
      2026,
      2.5,
    );
    expect(r.federalTaxable).toBe(367800);
    expect(r.federalIncome).toBeCloseTo(73468, 8);
    expect(r.socialSecurity).toBe(22878);
    expect(r.additionalMedicare).toBe(1350);
    expect(r.total).toBeCloseTo(103496, 8);
  });
  it("caps Social Security per person and uses liability rather than withholding Medicare threshold", () => {
    const r = calculateTaxes(
      [worker(150000), worker(150000)],
      { ...profile(), filing: "joint" },
      2026,
      2.5,
    );
    expect(r.socialSecurity).toBe(18600);
    expect(r.additionalMedicare).toBeCloseTo(450, 8);
    expect(
      calculateTaxes([worker(300000)], profile(), 2026, 2.5).socialSecurity,
    ).toBe(11439);
  });
  it("does not inflate fixed additional-Medicare thresholds", () => {
    const r = calculateTaxes([worker(300000)], profile(), 2027, 10);
    expect(r.additionalMedicare).toBeCloseTo(900, 8);
    expect(r.federalTaxable).toBeCloseTo(300000 - 17710);
    expect(r.socialSecurity).toBeCloseTo(202950 * 0.062);
  });
  it("calculates Ohio entry amount and Columbus taxes without subtracting 401(k) locally", () => {
    const r = calculateTaxes([worker(100000)], profile("columbus"), 2026, 2.5);
    expect(r.stateTaxable).toBe(98100);
    expect(r.stateIncome).toBeCloseTo(2313.375, 8);
    expect(r.localIncome).toBe(2500);
    expect(r.total).toBeCloseTo(25633.375, 8);
    const benefits = calculateTaxes(
      [{ ...worker(100000), retirement: 20000, health: 3000, hsa: 4000 }],
      profile("columbus"),
      2026,
      2.5,
    );
    expect(benefits.localIncome).toBe(93000 * 0.025);
  });
  it("handles Ohio exemption phaseouts, entry credit and joint-filing credit", () => {
    const near = calculateTaxes([worker(28500)], profile("columbus"), 2026, 0);
    expect(near.stateIncome).toBeCloseTo(313.375, 8);
    const joint = calculateTaxes(
      [worker(50000), worker(50000)],
      { ...profile("columbus"), filing: "joint" },
      2026,
      0,
    );
    const before = 332 + (96200 - 26050) * 0.0275;
    expect(joint.stateIncome).toBeCloseTo(before * 0.95, 8);
    expect(
      calculateTaxes([worker(500000)], profile("columbus"), 2026, 0)
        .stateTaxable,
    ).toBe(500000);
  });
  it("adds exact 2026 NY recapture and NYC resident liability/credits", () => {
    const r = calculateTaxes([worker(200000)], profile("new-york"), 2026, 2.5);
    expect(r.stateTaxable).toBe(192000);
    expect(r.stateIncome).toBeCloseTo(11327.65, 8);
    expect(r.localIncome).toBeCloseTo(6822.52, 8);
    expect(r.employeePremiums).toBeCloseTo(411.91, 8);
  });
  it("uses the 2026 joint NY recapture constants", () => {
    const r = calculateTaxes(
      [worker(200000), worker(200000)],
      { ...profile("new-york"), filing: "joint" },
      2026,
      0,
    );
    // 2026 schedule: 17928 + 6.85% of (383950-323200), plus 1140+3071 recapture.
    expect(r.stateIncome).toBeCloseTo(
      17928 + (383950 - 323200) * 0.0685 + 1140 + 3071,
      8,
    );
  });
  it("uses fixed NY brackets and deductions in future-year projections", () => {
    const p = profile("new-york");
    const a = calculateTaxes([worker(200000)], p, 2026, 10),
      b = calculateTaxes([worker(200000)], p, 2027, 10);
    expect(b.stateIncome).toBe(a.stateIncome);
    expect(b.localIncome).toBe(a.localIncome);
    expect(b.federalIncome).toBeLessThan(a.federalIncome);
  });
  it("includes CA HSA addback and uncapped SDI, but excludes cafeteria health premiums", () => {
    const w = { ...worker(100000), retirement: 10000, health: 5000, hsa: 4000 };
    const r = calculateTaxes([w], profile("san-francisco"), 2026, 0);
    expect(r.federalTaxable).toBe(64900);
    expect(r.stateTaxable).toBe(79100);
    expect(r.employeePremiums).toBe(1235);
    expect(r.stateIncome).toBeCloseTo(3515.859, 6);
    const noHsa = calculateTaxes(
      [{ ...w, hsa: 0 }],
      profile("san-francisco"),
      2026,
      0,
    );
    expect(noHsa.stateIncome).toBe(r.stateIncome);
    expect(noHsa.federalIncome - r.federalIncome).toBeCloseTo(880, 8);
  });
  it("includes CA fixed $1m surtax and eliminates high-income exemption credit", () => {
    const r = calculateTaxes(
      [worker(2000000)],
      profile("san-francisco"),
      2026,
      0,
    );
    expect(r.stateIncome).toBeGreaterThan(200000);
    expect(r.employeePremiums).toBe(26000);
    const delta =
      calculateTaxes([worker(2010000)], profile("san-francisco"), 2026, 0)
        .stateIncome - r.stateIncome;
    expect(delta).toBeCloseTo(1330, 8);
  });
  it("includes MA personal exemption and per-person FICA deduction", () => {
    const r = calculateTaxes([worker(100000)], profile("boston"), 2026, 0);
    expect(r.stateTaxable).toBe(93600);
    expect(r.stateIncome).toBe(4680);
    expect(r.employeePremiums).toBe(460);
    expect(r.total).toBe(25960);
    const joint = calculateTaxes(
      [worker(100000), worker(0)],
      { ...profile("boston"), filing: "joint" },
      2026,
      0,
    );
    expect(joint.stateTaxable).toBe(89200);
  });
  it("applies MA no-tax status, limited-income rules and indexed surtax", () => {
    expect(
      calculateTaxes([worker(8000)], profile("boston"), 2026, 0).stateIncome,
    ).toBe(0);
    expect(
      calculateTaxes([worker(8100)], profile("boston"), 2026, 0).stateIncome,
    ).toBe(10);
    const a = calculateTaxes([worker(2000000)], profile("boston"), 2026, 10),
      b = calculateTaxes([worker(2000000)], profile("boston"), 2027, 10);
    expect(a.stateIncome - b.stateIncome).toBeCloseTo(110775 * 0.04, 8);
  });
  it("uses WA gross premium bases, RSU income and an explicit Cares exemption", () => {
    const p = profile("seattle"),
      w = {
        ...worker(100000, 100000),
        retirement: 24500,
        health: 5000,
        hsa: 4000,
      };
    const r = calculateTaxes([w], p, 2026, 0);
    expect(r.stateIncome).toBe(0);
    expect(r.employeePremiums).toBeCloseTo(
      184500 * 0.00807159 + 200000 * 0.0058,
      8,
    );
    const exempt = calculateTaxes(
      [w],
      { ...p, waCaresExempt: true, employeePremiums: false },
      2026,
      0,
    );
    expect(exempt.employeePremiums).toBe(0);
  });
  it("attributes equity tax using incremental liability rather than an effective cash rate", () => {
    const p = profile("columbus"),
      cash = calculateTaxes([worker(100000)], p, 2026, 0),
      full = calculateTaxes([worker(100000, 50000)], p, 2026, 0);
    expect(full.total - cash.total).toBeCloseTo(18014, 8);
    expect(full.total - cash.total).toBeGreaterThan(50000 * cash.effective);
  });
  it("supports manual tax and signed liability adjustments without adding payroll taxes", () => {
    const p = {
      ...profile(),
      mode: "manual" as const,
      federalAdjustment: "100",
    };
    const r = calculateTaxes([worker(100000)], p, 2026, 0, 25);
    expect(r.total).toBe(25100);
    expect(r.socialSecurity).toBe(0);
    expect(
      calculateTaxes(
        [worker(0)],
        { ...profile(), federalAdjustment: "-100" },
        2026,
        0,
      ).total,
    ).toBe(0);
  });
  it.each([NaN, Infinity, -1])("rejects invalid wage %s", (cash) =>
    expect(() => calculateTaxes([worker(cash)], profile(), 2026, 0)).toThrow(),
  );
});
