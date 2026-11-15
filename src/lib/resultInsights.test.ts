import { describe, expect, it } from "vitest";
import type { AnnualRow, Projection } from "./projection";
import { comparisonIndicators, incomeBreakdown } from "./resultInsights";

describe("result insights", () => {
  it("reconciles cash flow including payroll benefits and funded IRA contributions", () => {
    const row = { cashGross: 100000, cashTaxes: 18000, benefits: 12000, expenses: 50000, traditionalIraContribution: 3000, rothIraContribution: 2000, megaBackdoorContribution: 1000, surplus: 14000 } as AnnualRow;
    const values = incomeBreakdown(row);
    expect(values.slice(0, -1).reduce((sum, item) => sum + item.value, 0)).toBe(values.at(-1)?.value);
  });
  it("sums each comparison indicator over all years", () => {
    const rows = [{ cashGross: 100, stockGross: 20, taxes: 30, budgetExpenses: 40, investmentGain: -5 }, { cashGross: 200, stockGross: 30, taxes: 50, budgetExpenses: 60, investmentGain: 15 }] as AnnualRow[];
    expect(comparisonIndicators({ rows } as Projection).map((item) => item.value)).toEqual([300, 50, 80, 100, 10]);
  });
});
