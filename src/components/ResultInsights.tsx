import type { Projection } from "../lib/projection";
import { comparisonIndicators, incomeBreakdown } from "../lib/resultInsights";
import { money } from "../lib/format";
import { SelectField } from "./EditorFields";

interface Series { name: string; index: number; projection: Projection }

export function ResultInsights({ series, year, onYearChange }: { series: Series[]; year: number; onYearChange: (year: number) => void }) {
  const comparison = series.length === 2 ? series.map((s) => comparisonIndicators(s.projection)) : null;
  return <>
    {comparison && <section className="cash-panel" aria-labelledby="comparison-insights-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SCENARIO COMPARISON</p>
          <h2 id="comparison-insights-heading">What differs between scenarios</h2>
        </div>
        <span className="period-tag">Full projection</span>
      </div>
      <p className="hint">Totals over the full projection. Differences are {series[1].name} minus {series[0].name}; these related figures do not add up to the ending balance difference.</p>
      <div className="insight-list">
        {comparison[0].map((item, i) => {
          const delta = comparison[1][i].value - item.value;
          return <div className="insight-line" key={item.label}><span>{item.label}</span><strong>{delta > 0 ? "+" : ""}{money(delta)}</strong></div>;
        })}
      </div>
      <p className="hint">Investment gains exclude changes in employer share prices. Tax and living-cost increases reduce assets; other factors include employer match and forfeitures.</p>
    </section>}
    <section className="cash-panel" aria-labelledby="income-breakdown-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CASH FLOW WATERFALL</p>
          <h2 id="income-breakdown-heading">From income to remaining cash</h2>
        </div>
        <div className="result-year">
          <SelectField label="Income breakdown year" value={String(year)} onChange={(value) => onYearChange(Number(value))}>
            {series[0].projection.rows.map((row, index) => (
              <option value={index} key={row.calendarYear}>
                {row.calendarYear} · Year {row.year}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
      <p className="hint">Annual cash flow. Payroll benefits include health premiums; living costs exclude the premiums already paid through payroll. Equity and employer match are tracked separately.</p>
      <div className="flow-grid">
        {series.map((s) => {
          const rows = incomeBreakdown(s.projection.rows[year]);
          const scale = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
          return <div className="flow-scenario" key={s.index}>
            {series.length > 1 && <h3>{s.name}</h3>}
            {rows.map((row) => <div className="flow-row" key={row.label}>
              <div className="insight-line"><span>{row.label}</span><strong>{money(row.value)}</strong></div>
              <div className="flow-track" aria-hidden="true"><div className={row.value < 0 ? "flow-bar outflow" : "flow-bar"} style={{ width: `${Math.abs(row.value) / scale * 100}%` }} /></div>
            </div>)}
          </div>;
        })}
      </div>
    </section>
  </>;
}
