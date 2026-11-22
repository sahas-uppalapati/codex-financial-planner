import {
  Download,
  ChartNoAxesCombined,
} from "lucide-react";
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
import { issuerPrice } from "../lib/equity";
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
    yearContext: s.projection.rows.map((row) => {
      const employerChange = [...state.scenarios[s.index].events]
        .filter((event) => event.kind === "job")
        .filter((event) => monthIndex(event.month, startYear) < row.year * 12)
        .at(-1);
      const issuerId = employerChange?.issuerId ?? state.scenarios[s.index].employerId;
      const employer = state.scenarios[s.index].issuers.find((issuer) => issuer.id === issuerId)?.name;
      return [employer, row.role].filter(Boolean).join(" · ");
    }),
    markers: state.scenarios[s.index].events.map((e) => ({
      year: monthIndex(e.month, startYear) / 12,
      label: `${e.month}: ${e.kind === "job" ? "Change employer" : "Promotion"} · ${e.role}`,
    })),
  }));
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

  const monthlyRows = series.map((scenario) => scenario.projection.rows[activeYear]);
  const monthlyMetrics = [
    {
      label: "Cash left over",
      note: "Includes cash from stock sold",
      values: monthlyRows.map((row) => row.surplus + row.stockContribution),
    },
    {
      label: "Take-home pay",
      note: "After taxes and paycheck deductions",
      values: monthlyRows.map((row) => row.takeHome),
    },
    {
      label: "Living costs",
      note: "After payroll health premiums",
      values: monthlyRows.map((row) => row.expenses),
    },
    {
      label: "Cash from shares sold",
      note: "After estimated taxes",
      values: monthlyRows.map((row) => row.stockContribution),
      optional: true,
    },
    {
      label: "Other savings",
      note: "Extra contributions from take-home pay",
      values: monthlyRows.map((row) => row.traditionalIraContribution + row.rothIraContribution + row.megaBackdoorContribution),
      optional: true,
    },
  ].filter((metric) => !metric.optional || metric.values.some((value) => value > 0));

  return (
    <div className="results-content">
      <div className="results-toolbar">
        {destination !== "yearly" ? (
          <div className="year-picker">
            <span>Results year</span>
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
        ) : (
          <span className="toolbar-period">All projection years · USD</span>
        )}
        <div className="export-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              exportProjection(series);
              track("csv_exported", { period: "annual" });
            }}
          >
            <Download aria-hidden="true" />
            Export annual CSV
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
          <section
            className="quick-read"
            aria-labelledby="monthly-picture-heading"
          >
            <div className="quick-read-heading">
              <h3 id="monthly-picture-heading">Your monthly picture</h3>
            </div>
            {series.length > 1 ? (
              <table className="monthly-comparison">
                <thead>
                  <tr>
                    <th scope="col">USD per month</th>
                    {series.map((scenario) => (
                      <th scope="col" key={scenario.index}>{scenario.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyMetrics.map(({ label, values }, index) => (
                    <tr key={label} className={index === 0 ? "highlight" : undefined}>
                      <th scope="row">{label}</th>
                      {series.map((scenario, column) => (
                        <td
                          key={scenario.index}
                          className={values[column] < 0 ? "negative" : undefined}
                          data-testid={index === 0 ? `quick-cash-${scenario.index}` : undefined}
                        >
                          {money(values[column] / 12)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="quick-metrics-row">
                {monthlyMetrics.map(({ label, note, values }, index) => (
                  <Card
                    className={`quick-metric-box rounded-lg shadow-none ${index === 0 ? "highlight" : ""}`}
                    key={label}
                  >
                    <span className="quick-metric-label">{label}</span>
                    <strong
                      className={`quick-metric-val ${values[0] < 0 ? "negative" : ""}`}
                      data-testid={index === 0 ? "quick-cash-0" : undefined}
                    >
                      {money(values[0] / 12)}
                      <span className="unit">/ mo</span>
                    </strong>
                    <span className="monthly-metric-note">{note}</span>
                  </Card>
                ))}
              </div>
            )}
            <details>
              <summary>About these monthly averages</summary>
              <p>
                Annual amounts are divided by twelve. Bonuses and stock may
                arrive unevenly. Remaining cash includes sold-stock proceeds.
                The decision summary also shows cash after costs excluding
                stock sold when you compare two offers.
              </p>
            </details>
          </section>

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
                <div className="chart-legend">
                  <span>
                    <i className="legend-line contribution-line" />
                    Contributions
                  </span>
                  <span>
                    <i className="legend-line shortfall-line" />
                    Cash shortfall
                  </span>
                  <span>
                    <i className="legend-line total-line" />
                    Total balance
                  </span>
                  {series.length > 1 && series.map((s) => (
                    <span key={s.index}>
                      <i className={`legend-line series-${s.index}`} />
                      <span className="truncate">{s.name} total</span>
                    </span>
                  ))}
                </div>
                <ProjectionChart
                  series={chartSeries}
                  starting={series[0].projection.startingTotal}
                />
              </div>
              <details>
                <summary>About the portfolio projection</summary>
                <p>
                  Balances include investments and vested stock before future
                  sale or withdrawal taxes. Negative taxable balances are
                  unfunded shortfalls; held shares and retirement accounts are
                  not automatically sold to cover spending. The area between
                  contributions after shortfalls and the total represents investment growth.
                </p>
              </details>
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

            <section className="cash-panel career-timeline" aria-labelledby="timeline-heading">
              <h3 id="timeline-heading">Career and compensation by year</h3>
              <p className="hint">Projected pay earned before taxes in each calendar year. If your role changes midyear, base pay includes time in both roles. Scroll to see all columns.</p>
              {series.map((item) => {
                const scenario = state.scenarios[item.index];
                return <div className="timeline-scenario" key={item.index}>
                  {series.length > 1 && <h4>{item.name}</h4>}
                  <div className="table-scroll timeline-scroll" role="region" aria-label={`${item.name} career and compensation`} tabIndex={0}>
                    <table>
                      <caption className="sr-only">Annual career and compensation for {item.name}</caption>
                      <thead><tr>
                        <th scope="col">Year</th><th scope="col">Role at year end</th><th scope="col">Base earned</th><th scope="col">Recurring bonus</th><th scope="col">Sign-on pay</th><th scope="col">Stock vested</th><th scope="col">Total compensation</th><th scope="col">Stock awarded</th>
                      </tr></thead>
                      <tbody>{item.projection.rows.map((row) => {
                        const awarded = item.projection.equity.grants
                          .filter((grant) => Number(grant.month.slice(0, 4)) === row.calendarYear)
                          .reduce((sum, grant) => {
                            if (grant.units === "dollars") return sum + Number(grant.value);
                            const issuer = scenario.issuers.find((entry) => entry.id === grant.issuerId);
                            return sum + (issuer ? Number(grant.value) * issuerPrice(issuer, monthIndex(grant.month, startYear)) : 0);
                          }, 0);
                        return <tr key={row.calendarYear}>
                          <th scope="row">{row.calendarYear}</th>
                          <td className="timeline-role">{row.role || scenario.role || scenario.name}</td>
                          <td>{money(row.base)}</td><td>{money(row.bonus - row.signOn)}</td><td>{money(row.signOn)}</td>
                          <td>{money(row.stockGross)}</td><td>{money(row.cashGross - row.spouseCash + row.stockGross)}</td><td>{money(awarded)}</td>
                        </tr>;
                      })}</tbody>
                    </table>
                  </div>
                </div>;
              })}
              <p className="hint timeline-note">Total compensation adds base pay, recurring bonus, sign-on pay and stock vested that year; it excludes spouse pay and employer benefits. Stock awarded is the value of new grants at award, not income for that year, and is not added to total compensation until it vests. Share grants use the modeled share price. A midyear change blends pay from both roles; the role shown is the one held at year end. Startup options are excluded.</p>
            </section>
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
          <ResultInsights series={series} year={activeYear} view="comparison" />

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
