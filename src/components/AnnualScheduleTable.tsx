import { useState } from "react";
import { money } from "../lib/format";
import { retirementAccountLabels } from "../lib/retirement";
import type { RetirementAccountType } from "../lib/retirement";
import type { TaxResultSeries } from "./TaxBreakdownTable";

export function AnnualScheduleTable({
  series,
  years,
  isOpen,
}: {
  series: TaxResultSeries[];
  years: number;
  isOpen?: boolean;
}) {
  const [tableColumnsMode, setTableColumnsMode] = useState<"full" | "summary">(
    "full",
  );

  return (
    <details open={isOpen ? true : undefined}>
      <summary>
        Year-by-year projection <span className="optional">{years} years</span>
      </summary>
      <div className="details-body">
        <div className="table-header-controls">
          <p className="hint">
            All values are nominal USD. Gross includes vested equity whether sold
            or held. Portfolio balance excludes unvested awards. CSV contains
            full precision and detailed tax components.
          </p>
          <div
            className="table-density-switch"
            role="group"
            aria-label="Table column density"
          >
            <button
              type="button"
              className={`density-pill ${tableColumnsMode === "summary" ? "active" : ""}`}
              aria-pressed={tableColumnsMode === "summary"}
              onClick={() => setTableColumnsMode("summary")}
            >
              Key summary (11 cols)
            </button>
            <button
              type="button"
              className={`density-pill ${tableColumnsMode === "full" ? "active" : ""}`}
              aria-pressed={tableColumnsMode === "full"}
              onClick={() => setTableColumnsMode("full")}
            >
              Full detail (27 cols)
            </button>
          </div>
        </div>
        {series.map((s) => (
          <div className="yearly-table-block" key={s.index}>
            <h3>
              <i className={`dot series-${s.index}`} />
              {s.name}
            </h3>
            <div
              className="table-scroll"
              role="region"
              aria-label={`${s.name} annual projection`}
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Annual compensation, taxes and assets for {s.name}
                </caption>
                <thead>
                  <tr>
                    {(tableColumnsMode === "summary"
                      ? [
                          "Year / role",
                          "Base",
                          "Bonus",
                          "Vested equity",
                          "Gross income",
                          "Est. taxes",
                          "Cash take-home",
                          "Expenses",
                          "Cash surplus",
                          "401(k) + Match",
                          "Total balance",
                        ]
                      : [
                          "Year / role",
                          "Base",
                          "Bonus",
                          "Spouse cash",
                          "Vested equity",
                          "Gross income",
                          "Est. taxes",
                          "Cash take-home",
                          "Expenses",
                          "Cash surplus",
                          "401(k)",
                          "Employer match",
                          "HSA",
                          "Traditional IRA",
                          "Roth IRA",
                          "Backdoor conversion",
                          "Mega backdoor Roth",
                          "IRA deduction",
                          "Unfunded IRA target",
                          "Stock invested",
                          "Equity retained",
                          "Forfeited awards",
                          "Taxable balance",
                          "Employer stock",
                          ...Object.values(retirementAccountLabels).map(
                            (label) => `${label} balance`,
                          ),
                          "Total balance",
                        ]
                    ).map((h) => (
                      <th scope="col" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Start</th>
                    {tableColumnsMode === "summary" ? (
                      <>
                        <td colSpan={9}>Starting owned assets</td>
                        <td>{money(s.projection.startingTotal)}</td>
                      </>
                    ) : (
                      <>
                        <td colSpan={21}>Starting owned assets</td>
                        <td>{money(s.projection.starting.taxable)}</td>
                        <td>{money(s.projection.starting.employerStock)}</td>
                        {Object.keys(retirementAccountLabels).map((key) => (
                          <td key={key}>
                            {money(
                              s.projection.startingAccountBalances[
                                key as RetirementAccountType
                              ],
                            )}
                          </td>
                        ))}
                        <td>{money(s.projection.startingTotal)}</td>
                      </>
                    )}
                  </tr>
                  {s.projection.rows.map((r) => {
                    const rowVals =
                      tableColumnsMode === "summary"
                        ? [
                            r.base,
                            r.bonus,
                            r.stockGross,
                            r.grossIncome,
                            r.taxes,
                            r.takeHome,
                            r.expenses,
                            r.surplus,
                            r.retirementContribution + r.employerMatch,
                            r.endingBalance,
                          ]
                        : [
                            r.base,
                            r.bonus,
                            r.spouseCash,
                            r.stockGross,
                            r.grossIncome,
                            r.taxes,
                            r.takeHome,
                            r.expenses,
                            r.surplus,
                            r.retirementContribution,
                            r.employerMatch,
                            r.hsaContribution,
                            r.traditionalIraContribution,
                            r.rothIraContribution,
                            r.backdoorRothConversion,
                            r.megaBackdoorContribution,
                            r.deductibleIraContribution,
                            r.unfundedIraContribution,
                            r.stockContribution,
                            r.heldContribution,
                            r.forfeitedEquity,
                            r.balances.taxable,
                            r.balances.employerStock,
                            ...Object.keys(retirementAccountLabels).map(
                              (key) =>
                                r.accountBalances[key as RetirementAccountType],
                            ),
                            r.endingBalance,
                          ];
                    return (
                      <tr key={r.year}>
                        <th scope="row">
                          {r.calendarYear}
                          <small>{r.role}</small>
                        </th>
                        {rowVals.map((v, i) => (
                          <td key={i} className={v < 0 ? "negative" : ""}>
                            {money(v)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
