import { money, percent } from "../lib/format";
import { SelectField } from "./EditorFields";
import type { PlannerV2 } from "../lib/planner";
import type { TaxResultSeries } from "./TaxBreakdownTable";

export function CashFlowPanel({
  state,
  series,
  activeYear,
  onYearChange,
}: {
  state: PlannerV2;
  series: TaxResultSeries[];
  activeYear: number;
  onYearChange: (year: number) => void;
}) {
  return (
    <section className="cash-panel" aria-labelledby="cash-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">MONTHLY & ANNUAL CASH FLOW</p>
          <h2 id="cash-heading">The cash & compensation picture</h2>
        </div>
        <div className="result-year">
          <SelectField
            label="Results for calendar year"
            value={String(activeYear)}
            onChange={(v) => onYearChange(Number(v))}
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
        Monthly equivalents smooth annual bonuses; actual cash bonuses are paid in
        December.
      </p>
      <div
        className="metrics-table"
        style={{ "--scenario-count": series.length } as React.CSSProperties}
      >
        {series.length === 2 && (
          <div className="metric-row metric-head">
            <span>Monthly equivalent</span>
            {series.map((s) => (
              <strong key={s.index}>
                <span>{s.name}</span>
              </strong>
            ))}
          </div>
        )}
        <div className="metric-row">
          <span>
            Cash take-home
            <span className="freq-badge monthly">/ mo</span>
            <small>After taxes and payroll benefits</small>
          </span>
          {series.map((s) => (
            <strong key={s.index} data-testid={`take-home-${s.index}`}>
              {money(s.projection.rows[activeYear].takeHome / 12)}
            </strong>
          ))}
        </div>
        {series.some(
          (s) => s.projection.rows[activeYear].healthcareOffset > 0,
        ) ? (
          <>
            <div className="metric-row">
              <span>
                Budgeted living expenses
                <span className="freq-badge monthly">/ mo</span>
              </span>
              {series.map((s) => (
                <strong key={s.index}>
                  {money(s.projection.rows[activeYear].budgetExpenses / 12)}
                </strong>
              ))}
            </div>
            <div className="metric-row">
              <span>
                Healthcare already paid in payroll
                <span className="freq-badge monthly">/ mo</span>
                <small>Removed once from living expenses</small>
              </span>
              {series.map((s) => (
                <strong key={s.index}>
                  {money(s.projection.rows[activeYear].healthcareOffset / 12)}
                </strong>
              ))}
            </div>
            <div className="metric-row">
              <span>
                Post-payroll living expenses
                <span className="freq-badge monthly">/ mo</span>
              </span>
              {series.map((s) => (
                <strong key={s.index}>
                  {money(s.projection.rows[activeYear].expenses / 12)}
                </strong>
              ))}
            </div>
          </>
        ) : (
          <div className="metric-row">
            <span>
              Living expenses
              <span className="freq-badge monthly">/ mo</span>
            </span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].expenses / 12)}
              </strong>
            ))}
          </div>
        )}
        <div className="metric-row savings-row">
          <span>
            Cash savings / shortfall
            <span className="freq-badge monthly">/ mo</span>
          </span>
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
            <span className="freq-badge annual">/ yr</span>
            {series.some(
              (s) => s.projection.rows[activeYear].stockGross > 0,
            ) && <small>Annual · includes retained shares</small>}
          </span>
          {series.map((s) => (
            <strong key={s.index} data-testid={`stock-${s.index}`}>
              {money(s.projection.rows[activeYear].stockGross)}
            </strong>
          ))}
        </div>
        {series.some((s) => s.projection.rows[activeYear].stockGross > 0) && (
          <>
            <div className="metric-row">
              <span>
                Stock proceeds invested
                <span className="freq-badge annual">/ yr</span>
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
                Equity retained at vest
                <span className="freq-badge annual">/ yr</span>
                <small>Annual · after sell-to-cover</small>
              </span>
              {series.map((s) => (
                <strong key={s.index}>
                  {money(s.projection.rows[activeYear].heldContribution)}
                </strong>
              ))}
            </div>
          </>
        )}
        {series.some(
          (s) => s.projection.rows[activeYear].employerMatch > 0,
        ) && (
          <div className="metric-row">
            <span>
              Employer match
              <span className="freq-badge annual">/ yr</span>
              <small>Annual · deposited in the traditional 401(k)</small>
            </span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].employerMatch)}
              </strong>
            ))}
          </div>
        )}
        {series.some(
          (s) => s.projection.rows[activeYear].unvestedMatch > 0,
        ) && (
          <div className="metric-row">
            <span>
              Unvested employer match
              <span className="freq-badge annual">/ yr</span>
              <small>
                Vesting in progress · unvested balance forfeits on departure
              </small>
            </span>
            {series.map((s) => (
              <strong key={s.index}>
                {money(s.projection.rows[activeYear].unvestedMatch)}
              </strong>
            ))}
          </div>
        )}
        {series.some(
          (s) => s.projection.rows[activeYear].forfeitedMatch > 0,
        ) && (
          <div className="metric-row">
            <span>
              Forfeited unvested match
              <span className="freq-badge annual">/ yr</span>
              <small>Deducted on job departure before vesting</small>
            </span>
            {series.map((s) => (
              <strong key={s.index} className="negative">
                -{money(s.projection.rows[activeYear].forfeitedMatch)}
              </strong>
            ))}
          </div>
        )}
        {series.some(
          (s) =>
            s.projection.rows[activeYear].retirementContribution +
              s.projection.rows[activeYear].hsaContribution >
            0,
        ) && (
          <div className="metric-row">
            <span>
              401(k) + HSA contributions
              <span className="freq-badge annual">/ yr</span>
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
        )}
      </div>
    </section>
  );
}
