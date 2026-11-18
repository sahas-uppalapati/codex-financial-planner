import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  CalendarDays,
  ChartNoAxesCombined,
} from "lucide-react";
import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { Destination } from "./ResultsNavigation";
import type { PlannerV2 } from "../lib/planner";
import { monthIndex } from "../lib/planner";
import type { Projection } from "../lib/projection";
import { money } from "../lib/format";
import { exportProjection } from "../lib/plannerCsv";
import { ProjectionChart } from "./ProjectionChart";
import { InvestmentGrowthChart } from "./InvestmentGrowthChart";
import { retirementAccountLabels } from "../lib/retirement";
import type { RetirementAccountType } from "../lib/retirement";
import { TechRealityCard } from "./TechRealityCard";
import { track } from "../lib/analytics";
import { ResultInsights } from "./ResultInsights";
import { CashFlowPanel } from "./CashFlowPanel";
import { TaxBreakdownTable } from "./TaxBreakdownTable";
import { AnnualScheduleTable } from "./AnnualScheduleTable";
import { MonthlyCashFlowsTable } from "./MonthlyCashFlowsTable";
import { DecisionTools } from "./DecisionTools";
import { StartupComparison } from "./StartupComparison";
import type { StartupInputs } from "../lib/startupComparison";
interface ResultSeries {
  name: string;
  index: number;
  projection: Projection;
}
export function Results({
  state,
  series,
  startupScenario,
  startupInput,
  destination,
  selectedYear,
  onYearChange,
  onOpenCalculators,
}: {
  state: PlannerV2;
  series: ResultSeries[];
  startupScenario: number | null;
  startupInput: StartupInputs;
  destination: Destination;
  selectedYear: number;
  onYearChange: (year: number) => void;
  onOpenCalculators: () => void;
}) {
  const [activeProjectionChart, setActiveProjectionChart] = useState(0);
  const activeYear = Math.min(selectedYear, Number(state.shared.years) - 1);
  const setSelected = onYearChange;
  const years = Number(state.shared.years),
    startYear = Number(state.shared.startYear);
  const final = series.map((s) => s.projection.rows.at(-1)!);
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
  const chartViews = [
    {
      label: "Balance over time",
      content: (
        <>
          <ProjectionChart
            series={chartSeries}
            starting={series[0].projection.startingTotal}
          />
          {series.length === 1 && (
            <div className="forecast-endpoints">
              <span>
                Starting balance{" "}
                <strong>{money(series[0].projection.startingTotal)}</strong>
              </span>
              <span>
                End of {startYear + years - 1}{" "}
                <strong>{money(final[0].endingBalance)}</strong>
              </span>
            </div>
          )}
          <div className="chart-legend">
            {series.map((s) => (
              <span key={s.index}>
                <i className={`legend-line series-${s.index}`} />
                <span className="truncate">{s.name}</span>
              </span>
            ))}
          </div>
        </>
      ),
    },
    {
      label: "Money added & growth",
      content: (
        <InvestmentGrowthChart
          series={series.map((s) => ({
            name: s.name,
            index: s.index,
            projection: s.projection,
          }))}
        />
      ),
    },
  ];

  const accountDefs = [
    ["Taxable investments", "taxable", "aggregate"] as const,
    ["Vested employer shares", "employerStock", "aggregate"] as const,
    ...(
      Object.entries(retirementAccountLabels) as [
        RetirementAccountType,
        string,
      ][]
    ).map(([type, label]) => [label, type, "account"] as const),
  ];

  const getAccountVal = (
    key: string,
    kind: "aggregate" | "account",
    i: number,
  ) =>
    kind === "account"
      ? final[i].accountBalances[key as RetirementAccountType]
      : final[i].balances[key as "taxable" | "employerStock"];

  const activeAccounts = accountDefs.filter(
    ([, key, kind]) =>
      key === "taxable" ||
      series.some((_, i) => Math.abs(getAccountVal(key, kind, i)) > 0.005),
  );
  const inactiveAccounts = accountDefs.filter(
    ([, key, kind]) =>
      key !== "taxable" &&
      !series.some((_, i) => Math.abs(getAccountVal(key, kind, i)) > 0.005),
  );

  return (
    <div className="results-content">
      <div className="results-toolbar">
        <div className="year-picker">
          <CalendarDays size={15} aria-hidden="true" />
          <Select
            value={String(activeYear)}
            onValueChange={(value) => setSelected(Number(value))}
          >
            <SelectTrigger
              aria-label="Results for calendar year"
              className="year-picker-trigger"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {series[0].projection.rows.map((row, index) => (
                <SelectItem key={row.calendarYear} value={String(index)}>
                  {row.calendarYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {destination !== "overview" && (
          <span className="toolbar-period">
            {destination === "cash"
              ? "Monthly & annual amounts"
              : "Annual amounts · nominal USD"}
          </span>
        )}
        <div className="export-actions">
          <Button
            size="sm"
            onClick={() => {
              exportProjection(series);
              track("csv_exported", { period: "annual" });
            }}
          >
            <Download aria-hidden="true" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportProjection(series, true);
              track("csv_exported", { period: "monthly" });
            }}
          >
            Export monthly CSV
          </Button>
        </div>
      </div>
      {destination === "overview" && (
        <>
          <DecisionTools
            state={state}
            year={activeYear}
            projections={series.map((s) => s.projection)}
            startup={startupScenario}
            startupInput={startupInput}
          />
          <StartupComparison
            series={series}
            startup={startupScenario}
            input={startupInput}
          />
          {/* 1. Top Section: Your Monthly Picture */}
          <section
            className="quick-read"
            aria-labelledby="monthly-picture-heading"
          >
            <details>
              <summary>About these monthly averages</summary>
              <p>
                Annual amounts are divided by twelve. Bonuses and stock may
                arrive unevenly. Remaining cash includes sold-stock proceeds;
                cash after costs in the decision summary excludes them and
                reflects other savings.
              </p>
            </details>
            <div className="quick-read-heading">
              <h3 id="monthly-picture-heading">Your monthly picture</h3>
            </div>
            <div
              className="quick-read-grid"
              style={
                { "--scenario-count": series.length } as React.CSSProperties
              }
            >
              {series.map((s) => {
                const row = s.projection.rows[activeYear];
                const additionalSavings =
                  row.traditionalIraContribution +
                  row.rothIraContribution +
                  row.megaBackdoorContribution;
                const items = [
                  [
                    "Take-home pay",
                    row.takeHome,
                    "After taxes and paycheck deductions",
                    Wallet,
                  ],
                  ...(row.stockContribution > 0
                    ? [
                        [
                          "Cash from shares sold",
                          row.stockContribution,
                          "After estimated taxes",
                          Wallet,
                        ] as const,
                      ]
                    : []),
                  [
                    "Living costs",
                    row.expenses,
                    "After payroll health premiums",
                    ArrowDownLeft,
                  ],
                  ...(additionalSavings > 0
                    ? [
                        [
                          "Other savings",
                          additionalSavings,
                          "Extra contributions from take-home pay",
                          ArrowDownLeft,
                        ] as const,
                      ]
                    : []),
                  [
                    "Money left over",
                    row.surplus + row.stockContribution,
                    "After living costs and other savings",
                    ArrowUpRight,
                  ],
                ] as const;
                return (
                  <article className="quick-read-card" key={s.index}>
                    {series.length > 1 && (
                      <h3>
                        <i className={`dot series-${s.index}`} />
                        {s.name}
                      </h3>
                    )}
                    <div className="quick-metrics-row monthly-metrics">
                      {items.map(([label, value, description, Icon]) => {
                        const flowClass =
                          label === "Take-home pay" ||
                          label === "Cash from shares sold"
                            ? "flow-in"
                            : label === "Living costs" ||
                                label === "Other savings"
                              ? "flow-out"
                              : value < 0
                                ? "flow-out"
                                : "flow-in";
                        return (
                          <Card
                            className={`quick-metric-box rounded-lg shadow-none ${flowClass} ${label === "Money left over" ? "highlight" : ""}`}
                            key={label}
                          >
                            <div className="metric-card-heading">
                              <span className="quick-metric-label">{label}</span>
                              <span className="metric-icon">
                                <Icon size={17} aria-hidden="true" />
                              </span>
                            </div>
                            <strong
                              className={`quick-metric-val ${value < 0 ? "negative" : ""}`}
                              data-testid={
                                label === "Money left over"
                                  ? `quick-cash-${s.index}`
                                  : undefined
                              }
                            >
                              {money(value / 12)}
                              <span className="unit">/ mo</span>
                            </strong>
                            <span className="monthly-metric-note">
                              {description}
                            </span>
                          </Card>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* 2. Portfolio & Wealth Over Time */}
          <div className="portfolio-grid">
            <Card
              className="projection-panel rounded-lg shadow-none"
              aria-labelledby="projection-heading"
            >
              <div className="panel-heading">
                <div>
                  <h3 id="projection-heading">
                    <ChartNoAxesCombined size={18} aria-hidden="true" />{" "}
                    Portfolio projection
                  </h3>
                </div>
                <Button variant="outline" onClick={onOpenCalculators}>Explore calculators</Button>
              </div>
              <details>
                <summary>About the portfolio projection</summary>
                <p>
                  Balances include investments and vested stock before future
                  sale or withdrawal taxes. Negative taxable balances are
                  unfunded shortfalls; held shares and retirement accounts are
                  not automatically sold to cover spending.
                </p>
              </details>
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
                  End of {startYear + years - 1} · before future taxes · future
                  dollars
                </p>
              </div>
              <div className="projection-chart-carousel">
                <div
                  className="chart-carousel-controls"
                  role="group"
                  aria-label="Projection charts"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Previous chart"
                    disabled={activeProjectionChart === 0}
                    onClick={() =>
                      setActiveProjectionChart((index) => Math.max(0, index - 1))
                    }
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <div aria-live="polite">
                    <strong>{chartViews[activeProjectionChart].label}</strong>
                    <span>
                      {activeProjectionChart + 1} of {chartViews.length}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Next chart"
                    disabled={activeProjectionChart === chartViews.length - 1}
                    onClick={() =>
                      setActiveProjectionChart((index) =>
                        Math.min(chartViews.length - 1, index + 1),
                      )
                    }
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
                <div className="chart-carousel-panel">
                  {chartViews[activeProjectionChart].content}
                </div>
              </div>
            </Card>
            <Card
              className="portfolio-breakdown rounded-lg shadow-none"
              aria-labelledby="assets-heading"
            >
              <div className="portfolio-breakdown-heading">
                <h3 id="assets-heading">Ending accounts</h3>
                <span className="period-tag">{startYear + years - 1}</span>
              </div>
              <div
                className="metrics-table"
                style={
                  { "--scenario-count": series.length } as React.CSSProperties
                }
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
                        className={
                          getAccountVal(key, kind, i) < 0 ? "negative" : ""
                        }
                        key={s.index}
                        data-testid={`${key}-${s.index}`}
                      >
                        {money(getAccountVal(key, kind, i))}
                      </strong>
                    ))}
                  </div>
                ))}
                {series.some(
                  (_, i) => Math.abs(final[i].unrealizedGain) > 0.005,
                ) && (
                  <div className="metric-row">
                    <span>
                      Unrealized employer-stock gain
                      <small>Already included above</small>
                    </span>
                    {series.map((s, i) => (
                      <strong key={s.index}>
                        {money(final[i].unrealizedGain)}
                      </strong>
                    ))}
                  </div>
                )}
                {inactiveAccounts.length > 0 && (
                  <details className="empty-accounts-details">
                    <summary className="empty-accounts-summary">
                      Show other account types ({inactiveAccounts.length} empty
                      at $0)
                    </summary>
                    <div className="empty-accounts-list">
                      {inactiveAccounts.map(([label, key, kind]) => (
                        <div className="metric-row" key={key}>
                          <span>{label}</span>
                          {series.map((s, i) => (
                            <strong
                              className={
                                getAccountVal(key, kind, i) < 0
                                  ? "negative"
                                  : ""
                              }
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
            </Card>
          </div>

          <ResultInsights series={series} year={activeYear} view="comparison" />

          {state.scenarios
            .slice(0, state.comparison ? 2 : 1)
            .some((s) => s.events.length > 0) && (
            <details className="cash-panel">
              <summary>Career timeline markers</summary>
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
            </details>
          )}
        </>
      )}
      {destination !== "overview" && (
        <section className="yearly-section">
          {destination === "cash" && (
            <>
              <CashFlowPanel
                state={state}
                series={series}
                activeYear={activeYear}
              />
              <ResultInsights series={series} year={activeYear} view="income" />
              <MonthlyCashFlowsTable series={series} activeYear={activeYear} />
              <TechRealityCard
                scenario={state.scenarios[0]}
                assumptions={state.shared}
              />
            </>
          )}
          {destination === "taxes" && (
            <TaxBreakdownTable series={series} activeYear={activeYear} />
          )}
          {destination === "yearly" && (
            <AnnualScheduleTable series={series} years={years} />
          )}
        </section>
      )}
      {warnings.length > 0 && (
        <details className="model-notes">
          <summary>Projection notes</summary>
          {warnings.map((w) => (
            <p className="hint" key={w}>
              {w}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
