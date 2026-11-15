import { money } from "../lib/format";
import { exportProjection } from "../lib/plannerCsv";
import { track } from "../lib/analytics";
import type { TaxResultSeries } from "./TaxBreakdownTable";

export function MonthlyCashFlowsTable({
  series,
  activeYear,
}: {
  series: TaxResultSeries[];
  activeYear: number;
}) {
  const activeCalYear = series[0].projection.rows[activeYear].calendarYear;

  return (
    <details>
      <summary>
        Monthly cash flows & vesting{" "}
        <span className="optional">{activeCalYear}</span>
      </summary>
      <div className="details-body">
        <div className="table-toolbar">
          <p className="hint">
            Change the results year above to inspect another calendar year.
          </p>
          <button
            type="button"
            className="secondary small"
            onClick={() => {
              exportProjection(series, true);
              track("csv_exported", { period: "monthly" });
            }}
          >
            Export monthly CSV
          </button>
        </div>
        {series.map((s) => (
          <div className="yearly-table-block" key={s.index}>
            <h3>{s.name}</h3>
            <div
              className="table-scroll"
              role="region"
              aria-label={`${s.name} monthly projection`}
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Monthly cash flows and vesting in {activeCalYear}
                </caption>
                <thead>
                  <tr>
                    {[
                      "Month / event",
                      "Gross cash",
                      "Vested equity",
                      "Tax reserve",
                      "Cash take-home",
                      "Expenses",
                      "Cash surplus",
                      "Stock invested",
                      "Equity retained",
                      "Forfeited awards",
                      "Total balance",
                      "Grant vesting",
                    ].map((h) => (
                      <th scope="col" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.projection.rows[activeYear].months.map((m) => (
                    <tr key={m.month}>
                      <th scope="row">
                        {m.date}
                        <small>{m.event}</small>
                      </th>
                      {[
                        m.cashGross,
                        m.stockGross,
                        m.taxes,
                        m.takeHome,
                        m.expenses,
                        m.surplus,
                        m.stockContribution,
                        m.heldContribution,
                        m.forfeitedEquity,
                        m.endingBalance,
                      ].map((v, i) => (
                        <td key={i} className={v < 0 ? "negative" : ""}>
                          {money(v)}
                        </td>
                      ))}
                      <td className="vest-cell">
                        {m.vests.length ? (
                          <ul className="vest-list">
                            {m.vests.map((v, idx) => (
                              <li key={idx}>
                                {v.grantName}: {v.shares.toFixed(3)} shares @{" "}
                                {money(v.price)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
