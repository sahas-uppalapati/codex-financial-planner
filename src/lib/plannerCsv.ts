import { csvCell, downloadCsv } from "./csv";
import type { Projection } from "./projection";
export interface ExportScenario {
  name: string;
  projection: Projection;
}
export function plannerCsv(
  scenarios: ExportScenario[],
  monthly = false,
): string {
  const header = [
    "Scenario",
    "Period",
    "Role",
    "Events",
    "Base salary (USD)",
    "Cash bonus (USD)",
    "Spouse cash wages (USD)",
    "Gross cash (USD)",
    "Gross vested equity (USD)",
    "Estimated total taxes (USD)",
    "Cash-attributed taxes (USD)",
    "Equity-attributed taxes (USD)",
    "Cash take-home after benefits (USD)",
    "Budgeted expenses (USD)",
    "Healthcare premium offset (USD)",
    "Post-payroll expenses (USD)",
    "Cash surplus or shortfall (USD)",
    "401(k) contribution (USD)",
    "Employer match (USD)",
    "HSA contribution (USD)",
    "Stock proceeds invested (USD)",
    "Equity retained at vest (USD)",
    "Forfeited unvested equity (USD)",
    "Taxable investments or unfunded shortfall (USD)",
    "Held employer stock (USD)",
    "401(k) balance (USD)",
    "HSA balance (USD)",
    "Total before withdrawal or sale taxes (USD)",
    "Unrealized employer-stock gain (USD)",
    "Grant vesting details",
    "Federal income tax (USD)",
    "State income tax (USD)",
    "Local income tax (USD)",
    "Social Security (USD)",
    "Medicare (USD)",
    "Additional Medicare (USD)",
    "Employee leave/disability premiums (USD)",
    "Federal taxable income (USD)",
    "State taxable income (USD)",
    "Payroll health premiums (USD)",
  ];
  const records: (string | number)[][] = [header];
  for (const { name, projection: p } of scenarios) {
    const initial: (string | number)[] = Array(header.length).fill("");
    initial[0] = name;
    initial[1] = "Starting balances";
    initial[23] = p.starting.taxable;
    initial[24] = p.starting.employerStock;
    initial[25] = p.starting.retirement;
    initial[26] = p.starting.hsa;
    initial[27] = p.startingTotal;
    records.push(initial);
    if (monthly)
      for (const r of p.months)
        records.push([
          name,
          r.date,
          r.role,
          r.event,
          r.base,
          r.bonus,
          r.spouseCash,
          r.cashGross,
          r.stockGross,
          r.taxes,
          r.cashTaxes,
          r.stockTaxes,
          r.takeHome,
          r.budgetExpenses,
          r.healthcareOffset,
          r.expenses,
          r.surplus,
          r.retirementContribution,
          r.employerMatch,
          r.hsaContribution,
          r.stockContribution,
          r.heldContribution,
          r.forfeitedEquity,
          r.balances.taxable,
          r.balances.employerStock,
          r.balances.retirement,
          r.balances.hsa,
          r.endingBalance,
          r.unrealizedGain,
          r.vests
            .map((v) => `${v.grantName}: ${v.shares} shares @ ${v.price}`)
            .join("; "),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          r.healthPremiums,
        ]);
    else
      for (const r of p.rows)
        records.push([
          name,
          r.calendarYear,
          r.role,
          r.months
            .filter((m) => m.event)
            .map((m) => `${m.date}: ${m.event}`)
            .join("; "),
          r.base,
          r.bonus,
          r.spouseCash,
          r.cashGross,
          r.stockGross,
          r.taxes,
          r.cashTaxes,
          r.stockTaxes,
          r.takeHome,
          r.budgetExpenses,
          r.healthcareOffset,
          r.expenses,
          r.surplus,
          r.retirementContribution,
          r.employerMatch,
          r.hsaContribution,
          r.stockContribution,
          r.heldContribution,
          r.forfeitedEquity,
          r.balances.taxable,
          r.balances.employerStock,
          r.balances.retirement,
          r.balances.hsa,
          r.endingBalance,
          r.unrealizedGain,
          r.months
            .flatMap((m) =>
              m.vests.map(
                (v) =>
                  `${m.date} ${v.grantName}: ${v.shares} shares @ ${v.price}`,
              ),
            )
            .join("; "),
          r.taxBreakdown.federalIncome,
          r.taxBreakdown.stateIncome,
          r.taxBreakdown.localIncome,
          r.taxBreakdown.socialSecurity,
          r.taxBreakdown.medicare,
          r.taxBreakdown.additionalMedicare,
          r.taxBreakdown.employeePremiums,
          r.taxBreakdown.federalTaxable,
          r.taxBreakdown.stateTaxable,
          r.healthPremiums,
        ]);
  }
  return "\uFEFF" + records.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function exportProjection(scenarios: ExportScenario[], monthly = false) {
  downloadCsv(
    plannerCsv(scenarios, monthly),
    monthly ? "careerworth-monthly.csv" : "careerworth-projection.csv",
  );
}
