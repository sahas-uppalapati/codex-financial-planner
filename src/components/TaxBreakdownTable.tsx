import { money, percent } from "../lib/format";
import type { Projection } from "../lib/projection";
import type { ScenarioV2 } from "../lib/planner";

export interface TaxResultSeries {
  name: string;
  index: number;
  projection: Projection;
  scenario?: ScenarioV2;
}

export function TaxBreakdownTable({
  series,
  activeYear,
}: {
  series: TaxResultSeries[];
  activeYear: number;
}) {
  const activeRow = series[0].projection.rows[activeYear];

  return (
    <section className="cash-panel tax-breakdown">
      <h3>
        Tax breakdown{" "}
        <span className="optional">
          {activeRow.calendarYear} · annual liability
        </span>
      </h3>
      <div className="details-body">
        <details className="table-header-controls">
          <summary>Tax coverage and reserves</summary>
          <p className="hint">
            Calculated estimates cover the selected full-year W-2 location and
            standard deductions; many tax situations are excluded.
            Equity-attributed tax is total liability with vesting minus
            liability on cash compensation alone. Monthly reserves allocate
            these annual estimates, not actual paycheck withholding.
          </p>
        </details>
        <div
          className="tax-table-container table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tax breakdown table"
        >
          <table className="tax-table">
            <thead>
              <tr>
                <th scope="col">Tax Component</th>
                {series.map((s) => (
                  <th scope="col" key={s.index}>
                    {series.length > 1 && (
                      <i className={`dot series-${s.index}`} />
                    )}
                    {series.length > 1 ? s.name : "Amount"}
                  </th>
                ))}
                {series.length === 1 && <th scope="col">% of Gross</th>}
              </tr>
            </thead>
            <tbody>
              <tr className="tax-group-header">
                <th
                  colSpan={series.length === 1 ? 3 : 1 + series.length}
                  scope="colgroup"
                >
                  Income & Taxable Bases
                </th>
              </tr>
              <tr>
                <th scope="row">Gross compensation</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(s.projection.rows[activeYear].taxBreakdown.gross)}
                  </td>
                ))}
                {series.length === 1 && <td>100.0%</td>}
              </tr>
              <tr>
                <th scope="row">Federal taxable income</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(
                      s.projection.rows[activeYear].taxBreakdown.federalTaxable,
                    )}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].taxBreakdown
                        .federalTaxable /
                        (series[0].projection.rows[activeYear].taxBreakdown
                          .gross || 1),
                    )}
                  </td>
                )}
              </tr>
              <tr>
                <th scope="row">State taxable income</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(
                      s.projection.rows[activeYear].taxBreakdown.stateTaxable,
                    )}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].taxBreakdown
                        .stateTaxable /
                        (series[0].projection.rows[activeYear].taxBreakdown
                          .gross || 1),
                    )}
                  </td>
                )}
              </tr>

              <tr className="tax-group-header">
                <th
                  colSpan={series.length === 1 ? 3 : 1 + series.length}
                  scope="colgroup"
                >
                  Taxes Owed
                </th>
              </tr>
              <tr>
                <th scope="row">Federal income tax</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(
                      s.projection.rows[activeYear].taxBreakdown.federalIncome,
                    )}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].taxBreakdown
                        .federalIncome /
                        (series[0].projection.rows[activeYear].taxBreakdown
                          .gross || 1),
                    )}
                  </td>
                )}
              </tr>
              <tr>
                <th scope="row">State income tax</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(
                      s.projection.rows[activeYear].taxBreakdown.stateIncome,
                    )}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].taxBreakdown
                        .stateIncome /
                        (series[0].projection.rows[activeYear].taxBreakdown
                          .gross || 1),
                    )}
                  </td>
                )}
              </tr>
              {series.some(
                (s) =>
                  s.projection.rows[activeYear].taxBreakdown.localIncome > 0,
              ) && (
                <tr>
                  <th scope="row">Local income tax</th>
                  {series.map((s) => (
                    <td key={s.index}>
                      {money(
                        s.projection.rows[activeYear].taxBreakdown.localIncome,
                      )}
                    </td>
                  ))}
                  {series.length === 1 && (
                    <td>
                      {percent(
                        series[0].projection.rows[activeYear].taxBreakdown
                          .localIncome /
                          (series[0].projection.rows[activeYear].taxBreakdown
                            .gross || 1),
                      )}
                    </td>
                  )}
                </tr>
              )}
              <tr>
                <th scope="row">Social Security (FICA)</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(
                      s.projection.rows[activeYear].taxBreakdown.socialSecurity,
                    )}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].taxBreakdown
                        .socialSecurity /
                        (series[0].projection.rows[activeYear].taxBreakdown
                          .gross || 1),
                    )}
                  </td>
                )}
              </tr>
              <tr>
                <th scope="row">Medicare</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {money(s.projection.rows[activeYear].taxBreakdown.medicare)}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].taxBreakdown
                        .medicare /
                        (series[0].projection.rows[activeYear].taxBreakdown
                          .gross || 1),
                    )}
                  </td>
                )}
              </tr>
              {series.some(
                (s) =>
                  s.projection.rows[activeYear].taxBreakdown
                    .additionalMedicare > 0,
              ) && (
                <tr>
                  <th scope="row">Additional Medicare</th>
                  {series.map((s) => (
                    <td key={s.index}>
                      {money(
                        s.projection.rows[activeYear].taxBreakdown
                          .additionalMedicare,
                      )}
                    </td>
                  ))}
                  {series.length === 1 && (
                    <td>
                      {percent(
                        series[0].projection.rows[activeYear].taxBreakdown
                          .additionalMedicare /
                          (series[0].projection.rows[activeYear].taxBreakdown
                            .gross || 1),
                      )}
                    </td>
                  )}
                </tr>
              )}
              {series.some(
                (s) =>
                  s.projection.rows[activeYear].taxBreakdown.employeePremiums >
                  0,
              ) && (
                <tr>
                  <th scope="row">Employee leave/disability premiums</th>
                  {series.map((s) => (
                    <td key={s.index}>
                      {money(
                        s.projection.rows[activeYear].taxBreakdown
                          .employeePremiums,
                      )}
                    </td>
                  ))}
                  {series.length === 1 && (
                    <td>
                      {percent(
                        series[0].projection.rows[activeYear].taxBreakdown
                          .employeePremiums /
                          (series[0].projection.rows[activeYear].taxBreakdown
                            .gross || 1),
                      )}
                    </td>
                  )}
                </tr>
              )}
              {series.some(
                (s) => s.projection.rows[activeYear].taxBreakdown.manual > 0,
              ) && (
                <tr>
                  <th scope="row">Manual rate component</th>
                  {series.map((s) => (
                    <td key={s.index}>
                      {money(s.projection.rows[activeYear].taxBreakdown.manual)}
                    </td>
                  ))}
                  {series.length === 1 && (
                    <td>
                      {percent(
                        series[0].projection.rows[activeYear].taxBreakdown
                          .manual /
                          (series[0].projection.rows[activeYear].taxBreakdown
                            .gross || 1),
                      )}
                    </td>
                  )}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="tax-total-row">
                <th scope="row">Total estimated tax</th>
                {series.map((s) => (
                  <td key={s.index}>
                    <strong>
                      {money(s.projection.rows[activeYear].taxBreakdown.total)}
                    </strong>
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    <strong>
                      {percent(
                        series[0].projection.rows[activeYear].taxBreakdown
                          .effective,
                      )}
                    </strong>
                  </td>
                )}
              </tr>
              <tr className="tax-sub-row">
                <th scope="row">Effective rate on gross compensation</th>
                {series.map((s) => (
                  <td key={s.index}>
                    {percent(
                      s.projection.rows[activeYear].taxBreakdown.effective,
                    )}
                  </td>
                ))}
                {series.length === 1 && <td />}
              </tr>
              <tr className="tax-sub-row">
                <th scope="row">Tax attributable to vested equity</th>
                {series.map((s) => (
                  <td key={s.index} data-testid={`equity-tax-${s.index}`}>
                    {money(s.projection.rows[activeYear].stockTaxes)}
                  </td>
                ))}
                {series.length === 1 && (
                  <td>
                    {percent(
                      series[0].projection.rows[activeYear].stockGross > 0
                        ? series[0].projection.rows[activeYear].stockTaxes /
                            series[0].projection.rows[activeYear].stockGross
                        : 0,
                    )}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
