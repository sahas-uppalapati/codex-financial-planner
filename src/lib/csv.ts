import type { ProjectionRow } from "./model";
// Protect user-provided names from spreadsheet formula interpretation, including leading whitespace.
export function csvCell(value: string | number): string {
  let s = String(value);
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function projectionCsv(
  scenarios: { name: string; rows: ProjectionRow[] }[],
  starting: number,
): string {
  const header = [
    "Scenario",
    "Year",
    "Base salary (USD)",
    "Cash bonus (USD)",
    "Included gross stock (USD)",
    "Modeled gross income (USD)",
    "Estimated cash taxes (USD)",
    "Estimated stock taxes (USD)",
    "Estimated total taxes (USD)",
    "Cash take-home (USD)",
    "Expenses (USD)",
    "Cash surplus or shortfall (USD)",
    "After-tax stock contribution (USD)",
    "Investment gain or loss (USD)",
    "Ending investment balance (USD)",
  ];
  const records: (string | number)[][] = [header];
  for (const s of scenarios) {
    records.push([
      s.name,
      0,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      starting,
    ]);
    for (const r of s.rows)
      records.push([
        s.name,
        r.year,
        r.base,
        r.bonus,
        r.stockGross,
        r.grossIncome,
        r.cashTaxes,
        r.stockTaxes,
        r.taxes,
        r.takeHome,
        r.expenses,
        r.surplus,
        r.stockContribution,
        r.investmentGain,
        r.endingBalance,
      ]);
  }
  return "\uFEFF" + records.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function downloadCsv(
  contents: string,
  filename = "careerworth-projection.csv",
) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
