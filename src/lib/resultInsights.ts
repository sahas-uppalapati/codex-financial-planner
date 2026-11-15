import type { AnnualRow, Projection } from "./projection";

export function incomeBreakdown(row: AnnualRow) {
  return [
    { label: "Cash compensation", value: row.cashGross },
    { label: "Estimated cash taxes", value: -row.cashTaxes },
    { label: "Payroll benefits and contributions", value: -row.benefits },
    { label: "Living costs after payroll premiums", value: -row.expenses },
    { label: "IRA and after-tax contributions", value: -(row.traditionalIraContribution + row.rothIraContribution + row.megaBackdoorContribution) },
    { label: "Remaining cash / shortfall", value: row.surplus },
  ];
}

export function comparisonIndicators(projection: Projection) {
  const total = (get: (row: AnnualRow) => number) => projection.rows.reduce((sum, row) => sum + get(row), 0);
  return [
    { label: "Cash compensation", value: total((r) => r.cashGross) },
    { label: "Gross vested equity", value: total((r) => r.stockGross) },
    { label: "Estimated taxes", value: total((r) => r.taxes) },
    { label: "Living costs", value: total((r) => r.budgetExpenses) },
    { label: "Investment gains, excluding employer shares", value: total((r) => r.investmentGain) },
  ];
}
