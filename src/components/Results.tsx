import { useState } from "react";
import type { PlannerV2 } from "../lib/planner";
import { monthIndex } from "../lib/planner";
import type { Projection } from "../lib/projection";
import { money } from "../lib/format";
import { exportProjection } from "../lib/plannerCsv";
import { ProjectionChart } from "./ProjectionChart";
import { retirementAccountLabels } from "../lib/retirement";
import type { RetirementAccountType } from "../lib/retirement";
import { TechRealityCard } from "./TechRealityCard";
import { track } from "../lib/analytics";
import { ResultInsights } from "./ResultInsights";
import { CashFlowPanel } from "./CashFlowPanel";
import { TaxBreakdownTable } from "./TaxBreakdownTable";
import { AnnualScheduleTable } from "./AnnualScheduleTable";
import { MonthlyCashFlowsTable } from "./MonthlyCashFlowsTable";
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
  quickMode?: boolean;
}) {
  const [selected, setSelected] = useState(0),
    activeYear = Math.min(selected, Number(state.shared.years) - 1);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [detailTab, setDetailTab] = useState<"all" | "cash" | "taxes" | "yearly">("all");
  const years = Number(state.shared.years),
    startYear = Number(state.shared.startYear);
  const first = series[0].projection.rows[activeYear],
    final = series.map((s) => s.projection.rows.at(-1)!);
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

  const accountDefs = [
    ["Taxable investments", "taxable", "aggregate"] as const,
    ["Vested employer shares", "employerStock", "aggregate"] as const,
    ...(Object.entries(retirementAccountLabels) as [RetirementAccountType, string][]).map(
      ([type, label]) => [label, type, "account"] as const,
    ),
  ];

  const getAccountVal = (key: string, kind: "aggregate" | "account", i: number) =>
    kind === "account"
      ? final[i].accountBalances[key as RetirementAccountType]
      : final[i].balances[key as "taxable" | "employerStock"];

  const activeAccounts = accountDefs.filter(
    ([, key, kind]) => key === "taxable" || series.some((_, i) => Math.abs(getAccountVal(key, kind, i)) > 0.005),
  );
  const inactiveAccounts = accountDefs.filter(
    ([, key, kind]) => key !== "taxable" && !series.some((_, i) => Math.abs(getAccountVal(key, kind, i)) > 0.005),
  );
  return (
    <div className="results-content">
      {/* 1. Top Section: Your Monthly Picture */}
      <section className="quick-read" aria-labelledby="monthly-picture-heading">
        <div className="quick-read-heading">
          <div>
            <p className="eyebrow">YOUR MONEY TODAY</p>
            <h2 id="monthly-picture-heading">Your monthly picture</h2>
          </div>
          <span className="period-tag">{first.calendarYear} average</span>
        </div>
        <div className="quick-read-grid" style={{ "--scenario-count": series.length } as React.CSSProperties}>
          {series.map((s) => {
            const row = s.projection.rows[activeYear];
            const items = [
              ["Take-home pay", row.takeHome, "After estimated taxes and payroll deductions"],
              ["Living costs", row.expenses, "Estimated monthly living expenses"],
              ["Remaining cash", row.surplus + row.stockContribution, "After living costs, retirement, and stock sold"],
            ] as const;
            return <article className="quick-read-card" key={s.index}>
              {series.length > 1 && <h3><i className={`dot series-${s.index}`} />{s.name}</h3>}
              <div className="quick-metrics-row monthly-metrics">
                {items.map(([label, value, description], i) => <div className={`quick-metric-box ${i === 2 ? "highlight" : ""}`} key={label}>
                  <span className="quick-metric-label">{label}</span>
                  <strong className={`quick-metric-val ${value < 0 ? "negative" : ""}`} data-testid={i === 2 ? `quick-cash-${s.index}` : undefined}>
                    {money(value / 12)}<span className="unit">/ mo</span>
                    {i === 2 && (
                      <span className="sr-only" data-testid={`quick-cash-stock-${s.index}`}>
                        {money(value / 12)}/ mo
                      </span>
                    )}
                  </strong>
                  <span className="monthly-metric-note">{description}</span>
                </div>)}
              </div>
            </article>;
          })}
        </div>
      </section>

      {/* 2. Portfolio & Wealth Over Time */}
      <section
        className="projection-panel"
        aria-labelledby="projection-heading"
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">PORTFOLIO & WEALTH</p>
            <h2 id="projection-heading">Your portfolio, over time</h2>
          </div>
          <span className="period-tag">{years}-year projection</span>
        </div>
        <div className="balance-heading">
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
            End of {startYear + years - 1} · estimated investments and vested stock, before future sale or withdrawal taxes · future dollars
          </p>
        </div>
        <ProjectionChart
          series={chartSeries}
          starting={series[0].projection.startingTotal}
        />
        {series.length === 1 && <div className="forecast-endpoints"><span>Starting balance <strong>{money(series[0].projection.startingTotal)}</strong></span><span>End of {startYear + years - 1} <strong>{money(final[0].endingBalance)}</strong></span></div>}
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
        {series.some((s) =>
          s.projection.months.some((m) => m.balances.taxable < 0),
        ) && (
          <p className="shortfall-note">
            A negative taxable-investment balance is an unfunded cash shortfall,
            not a loan. It earns no investment return. Held shares and
            retirement assets are not automatically sold to fund spending.
          </p>
        )}
        <div className="portfolio-breakdown" aria-labelledby="assets-heading">
          <div className="portfolio-breakdown-heading">
            <h3 id="assets-heading">What makes up that balance</h3>
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
                    <span>{s.name}</span>
                  </strong>
                ))}
              </div>
            )}
            {activeAccounts.map(([label, key, kind]) => (
              <div className="metric-row" key={key}>
                <span>{label}</span>
                {series.map((s, i) => (
                  <strong
                    className={getAccountVal(key, kind, i) < 0 ? "negative" : ""}
                    key={s.index}
                    data-testid={`${key}-${s.index}`}
                  >
                    {money(getAccountVal(key, kind, i))}
                  </strong>
                ))}
              </div>
            ))}
            {series.some((_, i) => Math.abs(final[i].unrealizedGain) > 0.005) && (
              <div className="metric-row">
                <span>
                  Unrealized employer-stock gain
                  <small>Already included above</small>
                </span>
                {series.map((s, i) => (
                  <strong key={s.index}>{money(final[i].unrealizedGain)}</strong>
                ))}
              </div>
            )}
            {inactiveAccounts.length > 0 && (
              <details className="empty-accounts-details">
                <summary className="empty-accounts-summary">
                  Show other account types ({inactiveAccounts.length} empty at $0)
                </summary>
                <div className="empty-accounts-list">
                  {inactiveAccounts.map(([label, key, kind]) => (
                    <div className="metric-row" key={key}>
                      <span>{label}</span>
                      {series.map((s, i) => (
                        <strong
                          className={getAccountVal(key, kind, i) < 0 ? "negative" : ""}
                          key={s.index}
                          data-testid={`${key}-${s.index}`}
                        >
                          {money(getAccountVal(key, kind, i))}
                        </strong>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
          <p className="hint monthly-note">
            These accounts have different access and tax rules. Totals do not
            deduct future liquidation or retirement withdrawal taxes. Unvested
            awards are excluded.
          </p>
        </div>
      </section>

      {/* 3. Explore the Numbers (Open by default) */}
      <details
          className="more-results"
          open={detailsExpanded}
          onToggle={(e) => setDetailsExpanded(e.currentTarget.open)}
        >
        <summary>
          Explore the numbers{" "}
          <span className="optional">Account, tax and monthly breakdowns</span>
        </summary>
        <div className="more-results-content">

          <div className="detail-tabs-bar" role="tablist" aria-label="Detailed results categories">
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "all"}
              className={`detail-tab-pill ${detailTab === "all" ? "active" : ""}`}
              onClick={() => setDetailTab("all")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "cash"}
              className={`detail-tab-pill ${detailTab === "cash" ? "active" : ""}`}
              onClick={() => setDetailTab("cash")}
            >
              Cash Flow & Budget
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "taxes"}
              className={`detail-tab-pill ${detailTab === "taxes" ? "active" : ""}`}
              onClick={() => setDetailTab("taxes")}
            >
              Tax Breakdown
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === "yearly"}
              className={`detail-tab-pill ${detailTab === "yearly" ? "active" : ""}`}
              onClick={() => setDetailTab("yearly")}
            >
              Annual Schedule
            </button>
          </div>

          {detailTab === "all" && (
            <>
              <ResultInsights series={series} year={activeYear} onYearChange={setSelected} />
              <TechRealityCard scenario={state.scenarios[0]} assumptions={state.shared} />
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
              <div className="overview-export-row">
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    exportProjection(series);
                    track("csv_exported", { period: "annual" });
                  }}
                >
                  <span aria-hidden="true">↓ </span>Export CSV
                </button>
              </div>
            </>
          )}

          {detailTab === "cash" && (
            <section className="yearly-section">
              <div className="table-toolbar">
                <h2>Cash Flow & Budget</h2>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    exportProjection(series);
                    track("csv_exported", { period: "annual" });
                  }}
                >
                  <span aria-hidden="true">↓ </span>Export CSV
                </button>
              </div>
              <CashFlowPanel
                state={state}
                series={series}
                activeYear={activeYear}
                onYearChange={setSelected}
              />
              <MonthlyCashFlowsTable
                series={series}
                activeYear={activeYear}
              />
            </section>
          )}

          {detailTab === "taxes" && (
            <section className="yearly-section">
              <div className="table-toolbar">
                <h2>Tax Breakdown</h2>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    exportProjection(series);
                    track("csv_exported", { period: "annual" });
                  }}
                >
                  <span aria-hidden="true">↓ </span>Export CSV
                </button>
              </div>
              <TaxBreakdownTable
                series={series}
                activeYear={activeYear}
                onYearChange={setSelected}
                isOpen={true}
              />
            </section>
          )}

          {detailTab === "yearly" && (
            <section className="yearly-section">
              <div className="table-toolbar">
                <h2>Annual Schedule</h2>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    exportProjection(series);
                    track("csv_exported", { period: "annual" });
                  }}
                >
                  <span aria-hidden="true">↓ </span>Export CSV
                </button>
              </div>
              <AnnualScheduleTable
                series={series}
                years={years}
                isOpen={true}
              />
            </section>
          )}
      </div>
      </details>
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
