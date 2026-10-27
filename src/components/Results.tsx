import { useState } from "react";
import type { PlannerV2 } from "../lib/planner";
import { monthIndex } from "../lib/planner";
import type { Projection } from "../lib/projection";
import { money, percent } from "../lib/format";
import { exportProjection } from "../lib/plannerCsv";
import { ProjectionChart } from "./ProjectionChart";
import { SelectField } from "./EditorFields";
interface ResultSeries {
  name: string;
  index: number;
  projection: Projection;
}
export function Results({
  state,
  series,
}: {
  state: PlannerV2;
  series: ResultSeries[];
}) {
  const [selected, setSelected] = useState(0),
    activeYear = Math.min(selected, Number(state.shared.years) - 1);
  const years = Number(state.shared.years),
    startYear = Number(state.shared.startYear);
  const first = series[0].projection.rows[activeYear],
    final = series.map((s) => s.projection.rows.at(-1)!);
  const difference =
    series.length === 2 ? final[1].endingBalance - final[0].endingBalance : 0;
  const insight =
    series.length === 2
      ? Math.abs(difference) < 0.005
        ? `Both scenarios end with the same combined investment balance after ${years} years.`
        : `${series[difference > 0 ? 1 : 0].name} ends with approximately ${money(Math.abs(difference))} more after ${years} years, before future sale or withdrawal taxes.`
      : first.surplus >= 0
        ? `Your assumptions leave approximately ${money(first.surplus / 12)} per month in cash savings in ${first.calendarYear}, with equity and retirement contributions tracked separately.`
        : `Cash expenses exceed cash take-home by approximately ${money(-first.surplus / 12)} per month in ${first.calendarYear}.`;
  const warnings = [...new Set(series.flatMap((s) => s.projection.warnings))];
  const chartSeries = series.map((s) => ({
    name: s.name,
    index: s.index,
    rows: s.projection.rows,
    starting: s.projection.startingTotal,
    markers: state.scenarios[s.index].events.map((e) => ({
      year: monthIndex(e.month, startYear) / 12,
      label: `${e.month}: ${e.kind === "job" ? "Change employer" : "Promotion"} · ${e.role}`,
    })),
  }));
  return (
    <div className="results-content">
      <section className="quick-read" aria-labelledby="quick-read-heading">
        <div className="quick-read-heading">
          <div>
            <p className="eyebrow">AT A GLANCE</p>
            <h2 id="quick-read-heading">Your monthly picture</h2>
          </div>
          <span className="period-tag">
            {series[0].projection.rows[activeYear].calendarYear}
          </span>
        </div>
        <div className="quick-read-grid" style={{ "--scenario-count": series.length } as React.CSSProperties}>
          {series.map((s) => {
            const row = s.projection.rows[activeYear];
            return (
              <article className="quick-read-card" key={s.index}>
                <h3>
                  {series.length > 1 && <i className={`dot series-${s.index}`} />}
                  {s.name}
                </h3>
                <p className={`quick-surplus ${row.surplus < 0 ? "negative" : "positive"}`}>
                  {money(row.surplus / 12)}<span> / month</span>
                </p>
                <div className="quick-read-details">
                  <span>Take-home <strong>{money(row.takeHome / 12)}</strong></span>
                  <span>Living costs <strong>{money(row.expenses / 12)}</strong></span>
                </div>
              </article>
            );
          })}
        </div>
        <p className="hint">Cash savings after modeled taxes, payroll benefits and living costs. Equity and retirement contributions are tracked separately.</p>
      </section>
      <section
        className="projection-panel"
        aria-labelledby="projection-heading"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">THE BIGGER PICTURE</p>
            <h2 id="projection-heading">Your career, over time</h2>
          </div>
          <span className="period-tag">{years}-year projection</span>
        </div>
        <div className="balance-heading">
          <p>Projected investment balance</p>
          <div className="ending-balances">
            {series.map((s, i) => (
              <div className="ending-value" key={s.index}>
                {series.length > 1 && (
                  <span className="balance-name">
                    <i className={`dot series-${s.index}`} />
                    {s.name}
                  </span>
                )}
                <strong
                  className={final[i].endingBalance < 0 ? "negative" : ""}
                  data-testid={`ending-${s.index}`}
                >
                  {money(final[i].endingBalance)}
                </strong>
              </div>
            ))}
          </div>
          <p className="hint">
            End of {startYear + years - 1} · before future sale / withdrawal
            taxes · nominal dollars
          </p>
        </div>
        <ProjectionChart
          series={chartSeries}
          starting={series[0].projection.startingTotal}
        />
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.index}>
              <i className={`legend-line series-${s.index}`} />
              <span className="truncate">{s.name}</span>
            </span>
          ))}
          <span className="legend-note">
            Monthly cash flows · vested assets only
          </span>
        </div>
        <div className="insight" role="status">
          <span className="insight-icon" aria-hidden="true">
            ↗
          </span>
          <p>{insight}</p>
        </div>
        {series.some((s) =>
          s.projection.months.some((m) => m.balances.taxable < 0),
        ) && (
          <p className="shortfall-note">
            A negative taxable-investment balance is an unfunded cash shortfall,
            not a loan. It earns no investment return. Held shares and
            retirement assets are not automatically sold to fund spending.
          </p>
        )}
      </section>
      <section className="cash-panel" aria-labelledby="assets-heading">
        <div className="panel-heading">
          <h2 id="assets-heading">What makes up that balance</h2>
          <span className="muted small-text">End of projection</span>
        </div>
        <div
          className="metrics-table"
          style={{ "--scenario-count": series.length } as React.CSSProperties}
        >
          {series.length === 2 && (
            <div className="metric-row metric-head">
              <span>Account</span>
              {series.map((s) => (
                <strong key={s.index}>
                  <i className={`dot series-${s.index}`} />
                  {s.name}
                </strong>
              ))}
            </div>
          )}
          {(
            [
              ["Taxable investments / shortfall", "taxable"],
              ["Vested employer shares", "employerStock"],
              ["Traditional 401(k)", "retirement"],
              ["HSA", "hsa"],
            ] as const
          ).map(([label, key]) => (
            <div className="metric-row" key={key}>
              <span>{label}</span>
              {series.map((s, i) => (
                <strong
                  className={final[i].balances[key] < 0 ? "negative" : ""}
                  key={s.index}
                  data-testid={`${key}-${s.index}`}
                >
                  {money(final[i].balances[key])}
                </strong>
              ))}
            </div>
          ))}
          <div className="metric-row">
            <span>
              Unrealized employer-stock gain
              <small>Already included above</small>
            </span>
            {series.map((s, i) => (
              <strong key={s.index}>{money(final[i].unrealizedGain)}</strong>
            ))}
          </div>
        </div>
        <p className="hint monthly-note">
          These accounts have different access and tax rules. Totals do not
          deduct future liquidation or retirement withdrawal taxes. Unvested
          awards are excluded.
        </p>
      </section>
      <section className="cash-panel" aria-labelledby="cash-heading">
        <div className="panel-heading">
          <h2 id="cash-heading">The cash & compensation picture</h2>
          <div className="result-year">
            <SelectField
              label="Results for calendar year"
              value={String(activeYear)}
              onChange={(v) => setSelected(Number(v))}
            >
              {series[0].projection.rows.map((r, i) => (
                <option value={i} key={i}>
                  {r.calendarYear} · Year {r.year}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        <p className="hint">
          {state.scenarios.some((s) => s.taxProfile.filing === "joint")
            ? "Joint-filing scenarios show household wages, taxes, benefits and savings. "
            : ""}
          Monthly equivalents smooth annual bonuses; actual cash bonuses are
          paid in December.
        </p>
        <div
          className="metrics-table"
          style={{ "--scenario-count": series.length } as React.CSSProperties}
        >
          {series.length === 2 && (
            <div className="metric-row metric-head">
              <span>Monthly equivalent</span>
              {series.map((s) => (
                <strong key={s.index}>{s.name}</strong>
              ))}
            </div>
          )}
          <div className="metric-row">
            <span>
              Cash take-home<small>After taxes and payroll benefits</small>
            </span>
            {series.map((s) => (
              <strong key={s.index} data-testid={`take-home-${s.index}`}>
                {money(s.projection.rows[activeYear].takeHome / 12)}
              </strong>
            ))}
          </div>
          <div className="metric-row">
            <span>Budgeted living expenses</span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].budgetExpenses / 12)}
              </strong>
            ))}
          </div>
          <div className="metric-row">
            <span>
              Healthcare already paid in payroll
              <small>Removed once from living expenses</small>
            </span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].healthcareOffset / 12)}
              </strong>
            ))}
          </div>
          <div className="metric-row">
            <span>Post-payroll living expenses</span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].expenses / 12)}
              </strong>
            ))}
          </div>
          <div className="metric-row savings-row">
            <span>Cash savings / shortfall</span>
            {series.map((s) => {
              const r = s.projection.rows[activeYear];
              return (
                <strong
                  key={s.index}
                  className={r.surplus < 0 ? "negative" : "positive"}
                  data-testid={`savings-${s.index}`}
                >
                  {money(r.surplus / 12)}
                </strong>
              );
            })}
          </div>
          <div className="metric-row">
            <span>Cash savings rate</span>
            {series.map((s) => {
              const r = s.projection.rows[activeYear];
              return (
                <strong key={s.index}>
                  {r.takeHome > 0 ? (
                    percent(r.surplus / r.takeHome)
                  ) : (
                    <abbr title="No positive cash take-home">N/A</abbr>
                  )}
                </strong>
              );
            })}
          </div>
          <div className="metric-row stock-row">
            <span>
              Gross vested equity
              <small>Annual · includes retained shares</small>
            </span>
            {series.map((s) => (
              <strong key={s.index} data-testid={`stock-${s.index}`}>
                {money(s.projection.rows[activeYear].stockGross)}
              </strong>
            ))}
          </div>
          <div className="metric-row">
            <span>
              Stock proceeds invested
              <small>Annual · after attributed equity taxes</small>
            </span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].stockContribution)}
              </strong>
            ))}
          </div>
          <div className="metric-row">
            <span>
              Equity retained at vest<small>Annual · after sell-to-cover</small>
            </span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].heldContribution)}
              </strong>
            ))}
          </div>
          <div className="metric-row">
            <span>
              401(k) + HSA contributions
              <small>Annual · transferred into their accounts</small>
            </span>
            {series.map((s) => {
              const r = s.projection.rows[activeYear];
              return (
                <strong key={s.index}>
                  {money(r.retirementContribution + r.hsaContribution)}
                </strong>
              );
            })}
          </div>
        </div>
      </section>
      <section className="yearly-section">
        <div className="table-toolbar">
          <h2>Look a little closer</h2>
          <button
            type="button"
            className="secondary small"
            onClick={() => exportProjection(series)}
          >
            <span aria-hidden="true">↓ </span>Export CSV
          </button>
        </div>
        <details>
          <summary>
            Tax breakdown{" "}
            <span className="optional">
              {first.calendarYear} · annual liability
            </span>
          </summary>
          <div className="details-body">
            <p className="hint">
              Equity-attributed tax is total liability with vesting minus
              liability on cash compensation alone. Monthly reserves allocate
              these annual estimates, not actual paycheck withholding.
            </p>
            <div
              className="tax-comparison"
              style={
                { "--scenario-count": series.length } as React.CSSProperties
              }
            >
              {(
                [
                  ["Gross compensation", "gross"],
                  ["Federal taxable income", "federalTaxable"],
                  ["State taxable income", "stateTaxable"],
                  ["Federal income tax", "federalIncome"],
                  ["State income tax", "stateIncome"],
                  ["Local income tax", "localIncome"],
                  ["Social Security", "socialSecurity"],
                  ["Medicare", "medicare"],
                  ["Additional Medicare", "additionalMedicare"],
                  ["Employee leave/disability premiums", "employeePremiums"],
                  ["Manual rate component", "manual"],
                  ["Total estimated tax", "total"],
                ] as const
              ).map(([label, key]) => (
                <div className="metric-row" key={key}>
                  <span>{label}</span>
                  {series.map((s) => (
                    <strong key={s.index}>
                      {money(s.projection.rows[activeYear].taxBreakdown[key])}
                    </strong>
                  ))}
                </div>
              ))}
              <div className="metric-row">
                <span>Effective rate on gross compensation</span>
                {series.map((s) => (
                  <strong key={s.index}>
                    {percent(
                      s.projection.rows[activeYear].taxBreakdown.effective,
                    )}
                  </strong>
                ))}
              </div>
              <div className="metric-row">
                <span>Tax attributable to vested equity</span>
                {series.map((s) => (
                  <strong key={s.index} data-testid={`equity-tax-${s.index}`}>
                    {money(s.projection.rows[activeYear].stockTaxes)}
                  </strong>
                ))}
              </div>
            </div>
          </div>
        </details>
        <details>
          <summary>
            Year-by-year projection{" "}
            <span className="optional">{years} years</span>
          </summary>
          <div className="details-body">
            <p className="hint">
              All values are nominal USD. Gross includes vested equity whether
              sold or held. Portfolio balance excludes unvested awards. CSV
              contains full precision and detailed tax components.
            </p>
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
                        {[
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
                          "HSA",
                          "Stock invested",
                          "Equity retained",
                          "Forfeited awards",
                          "Taxable balance",
                          "Employer stock",
                          "Retirement balance",
                          "HSA balance",
                          "Total balance",
                        ].map((h) => (
                          <th scope="col" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Start</th>
                        <td colSpan={14}>Starting owned assets</td>
                        <td>{money(s.projection.starting.taxable)}</td>
                        <td>{money(s.projection.starting.employerStock)}</td>
                        <td>{money(s.projection.starting.retirement)}</td>
                        <td>{money(s.projection.starting.hsa)}</td>
                        <td>{money(s.projection.startingTotal)}</td>
                      </tr>
                      {s.projection.rows.map((r) => (
                        <tr key={r.year}>
                          <th scope="row">
                            {r.calendarYear}
                            <small>{r.role}</small>
                          </th>
                          {[
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
                            r.hsaContribution,
                            r.stockContribution,
                            r.heldContribution,
                            r.forfeitedEquity,
                            r.balances.taxable,
                            r.balances.employerStock,
                            r.balances.retirement,
                            r.balances.hsa,
                            r.endingBalance,
                          ].map((v, i) => (
                            <td key={i} className={v < 0 ? "negative" : ""}>
                              {money(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </details>
        <details>
          <summary>
            Monthly cash flows & vesting{" "}
            <span className="optional">{first.calendarYear}</span>
          </summary>
          <div className="details-body">
            <div className="table-toolbar">
              <p className="hint">
                Change the results year above to inspect another calendar year.
              </p>
              <button
                type="button"
                className="secondary small"
                onClick={() => exportProjection(series, true)}
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
                      Monthly cash flows and vesting in {first.calendarYear}
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
                            <td key={i}>{money(v)}</td>
                          ))}
                          <td>
                            {m.vests
                              .map(
                                (v) =>
                                  `${v.grantName}: ${v.shares.toFixed(3)} shares @ ${money(v.price)}`,
                              )
                              .join("; ") || "—"}
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
        {state.scenarios
          .slice(0, state.comparison ? 2 : 1)
          .some((s) => s.events.length > 0) && (
          <details>
            <summary>Career timeline markers</summary>
            <div className="details-body">
              {state.scenarios
                .slice(0, state.comparison ? 2 : 1)
                .map((s, i) => (
                  <div key={i}>
                    <h3>{s.name}</h3>
                    <ol className="timeline-list">
                      {s.events.map((e) => (
                        <li key={e.id}>
                          {e.month} ·{" "}
                          {e.kind === "job" ? "Change employer" : "Promotion"} ·{" "}
                          {e.role} · {money(Number(e.base))} base +{" "}
                          {money(Number(e.bonus))} annual bonus
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
            </div>
          </details>
        )}
      </section>
      {warnings.length > 0 && (
        <div className="model-notes">
          {warnings.map((w) => (
            <p className="hint" key={w}>
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
