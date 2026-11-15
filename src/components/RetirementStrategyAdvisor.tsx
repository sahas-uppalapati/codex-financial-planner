import { useId, useState } from "react";
import type { AssumptionsV2, ScenarioV2 } from "../lib/planner";
import { money } from "../lib/format";
import {
  applyRetirementStrategy,
  calculateRetirementStrategy,
  getStrategyPresets,
} from "../lib/retirementStrategy";
import type { TaxStrategyPreference } from "../lib/retirementStrategy";
import { NumberField } from "./EditorFields";

export function RetirementStrategyAdvisor({
  s,
  a,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  onChange: (s: ScenarioV2) => void;
}) {
  const presets = getStrategyPresets(s, a);
  const optimalMaxTotal = presets.find((p) => p.id === "max-401k")?.amount || 36400;
  const defaultTarget = optimalMaxTotal;

  const [targetSavingsDraft, setTargetSavingsDraft] = useState<string>(() =>
    String(Math.max(1000, defaultTarget)),
  );
  const [taxPreference, setTaxPreference] = useState<TaxStrategyPreference>("auto");
  const [enableBackdoor, setEnableBackdoor] = useState(true);
  const [enableMegaBackdoor, setEnableMegaBackdoor] = useState(
    s.retirementTargets.primary.megaBackdoorSupported,
  );
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const targetAmount = Math.max(0, Number(targetSavingsDraft) || 0);

  const strategy = calculateRetirementStrategy(s, a, {
    targetSavings: targetAmount,
    taxPreference,
    enableBackdoor,
    enableMegaBackdoor,
  });

  const marginalPct = (strategy.marginalTaxRate * 100).toFixed(1);

  const handleApply = () => {
    const updated = applyRetirementStrategy(s, strategy);
    onChange(updated);
    setAppliedNotice("Strategy targets applied to this scenario!");
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  const handleMaxOptimal = () => {
    const optStrategy = calculateRetirementStrategy(s, a, {
      targetSavings: optimalMaxTotal,
      taxPreference,
      enableBackdoor: true,
      enableMegaBackdoor,
    });
    const updated = applyRetirementStrategy(s, optStrategy);
    onChange(updated);
    setTargetSavingsDraft(String(optimalMaxTotal));
    setAppliedNotice(`Maxed out optimal accounts (${money(optimalMaxTotal)}/yr)!`);
    setTimeout(() => setAppliedNotice(null), 4000);
  };

  const advisorId = useId();

  return (
    <div className="strategy-advisor-card" aria-labelledby={`${advisorId}-heading`}>
      <div className="max-optimal-card">
        <div className="max-optimal-info">
          <span className="max-optimal-title">One-Click Optimal Retirement Strategy</span>
          <p className="max-optimal-sub">
            Max out 100% of employer match{s.taxProfile.hsaCoverage !== "none" ? ", HSA," : ""} and IRA in optimal tax order ({money(optimalMaxTotal)} / year).
          </p>
        </div>
        <div className="max-optimal-action-group">
          <button
            type="button"
            className="primary-button max-optimal-btn"
            onClick={handleMaxOptimal}
          >
            Max Out Optimal Accounts
          </button>
          {appliedNotice && <span className="applied-pill" role="status">{appliedNotice}</span>}
        </div>
      </div>

      <div className="strategy-advisor-header">
        <div>
          <h3 id={`${advisorId}-heading`}>Retirement Contribution Strategy</h3>
          <p className="hint">
            Tax-efficient savings waterfall based on the standard financial order of operations:
            capture employer match first, maximize triple-tax-free HSA, utilize IRAs, max workplace 401(k),
            and invest remaining surplus.
          </p>
        </div>
        <div className="marginal-rate-badge" title="Estimated combined Federal and State marginal tax bracket on base salary">
          <span className="badge-label">Marginal Tax Rate</span>
          <strong>{marginalPct}%</strong>
          <span className="badge-sub">
            {strategy.recommendedTaxPreference === "traditional"
              ? "Traditional 401(k) provides high current-year tax relief"
              : "Roth 401(k) favored for low-bracket tax-free growth"}
          </span>
        </div>
      </div>

      <div className="strategy-controls">
        <div className="strategy-control-row">
          <label className="field-label">Target annual retirement savings</label>
          <div className="pill-selector" role="group" aria-label="Savings target presets">
            {presets.map((p) => {
              const isActive = Math.abs(p.amount - targetAmount) < 10;
              return (
                <button
                  type="button"
                  key={p.id}
                  className={`pill-btn ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setTargetSavingsDraft(String(p.amount));
                    setAppliedNotice(null);
                  }}
                  title={p.description}
                >
                  {p.label} ({money(p.amount)})
                </button>
              );
            })}
          </div>
        </div>

        <div className="two-cols strategy-inputs">
          <NumberField
            label="Annual savings budget"
            unit="USD / year"
            value={targetSavingsDraft}
            onChange={(v) => {
              setTargetSavingsDraft(v);
              setAppliedNotice(null);
            }}
            hint={`${money(Math.round(targetAmount / 12))} / month equivalent`}
          />

          <div>
            <label className="field-label">Tax advantage preference</label>
            <div className="pill-selector preference-selector" role="group" aria-label="Tax preference">
              <button
                type="button"
                className={`pill-btn ${taxPreference === "auto" ? "active" : ""}`}
                onClick={() => setTaxPreference("auto")}
                title={`Auto recommended based on marginal tax rate: ${strategy.recommendedTaxPreference}`}
              >
                Auto ({strategy.recommendedTaxPreference === "traditional" ? "Traditional" : "Roth"})
              </button>
              <button
                type="button"
                className={`pill-btn ${taxPreference === "traditional" ? "active" : ""}`}
                onClick={() => setTaxPreference("traditional")}
                title="Prioritize Traditional 401(k) to maximize immediate income tax deduction"
              >
                Tax Relief Now (Traditional)
              </button>
              <button
                type="button"
                className={`pill-btn ${taxPreference === "roth" ? "active" : ""}`}
                onClick={() => setTaxPreference("roth")}
                title="Prioritize Roth 401(k) for tax-free retirement growth and withdrawals"
              >
                Tax-Free Later (Roth)
              </button>
              <button
                type="button"
                className={`pill-btn ${taxPreference === "balanced" ? "active" : ""}`}
                onClick={() => setTaxPreference("balanced")}
                title="50% Traditional and 50% Roth split"
              >
                50 / 50 Split
              </button>
            </div>
            <p className="hint">
              Traditional lowers current taxes; Roth grows tax-free. Which is optimal depends on your current vs. retirement tax bracket.
            </p>
          </div>
        </div>

        <details className="strategy-advanced-toggles">
          <summary>Advanced strategy options <span className="optional">Backdoor & Mega Backdoor</span></summary>
          <div className="details-body strategy-toggles-body">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={enableBackdoor}
                onChange={(e) => setEnableBackdoor(e.target.checked)}
              />
              <span>Enable Backdoor Roth IRA if phased out of direct Roth (requires $0 traditional IRA balance)</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={enableMegaBackdoor}
                onChange={(e) => setEnableMegaBackdoor(e.target.checked)}
              />
              <span>Enable Mega Backdoor Roth after-tax 401(k) conversion (if plan allows)</span>
            </label>
          </div>
        </details>
      </div>

      <div className="strategy-waterfall">
        <h4>Optimal Savings Allocation Breakdown</h4>
        <div className="waterfall-list">
          {strategy.tiers.map((tier) => {
            const isFilled = tier.status === "filled";
            const isPartial = tier.status === "partial";
            const isIneligible = tier.status === "ineligible";

            const statusClass = isFilled
              ? "status-filled"
              : isPartial
                ? "status-partial"
                : isIneligible
                  ? "status-ineligible"
                  : "status-skipped";

            const statusLabel = isFilled
              ? "Full Target Funded"
              : isPartial
                ? "Partially Funded"
                : isIneligible
                  ? "Not Configured / Ineligible"
                  : "Skipped (Budget Reached)";

            const maxDisplay = Number.isFinite(tier.maxCap) ? money(tier.maxCap) : "Unlimited";
            const pctBar = Number.isFinite(tier.maxCap) && tier.maxCap > 0
              ? Math.min(100, (tier.allocated / tier.maxCap) * 100)
              : tier.allocated > 0
                ? 100
                : 0;

            return (
              <div className={`waterfall-row ${statusClass}`} key={tier.id}>
                <div className="waterfall-row-header">
                  <div className="waterfall-title-group">
                    <span className="waterfall-name">{tier.name}</span>
                    <span className="waterfall-badge-advantage">{tier.taxAdvantage}</span>
                    <span className={`waterfall-badge-status ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="waterfall-amounts">
                    <strong>{money(tier.allocated)}</strong>
                    <span className="waterfall-cap">/ {maxDisplay}</span>
                  </div>
                </div>
                <div className="flow-track" aria-hidden="true">
                  <div
                    className={tier.allocated > 0 ? "flow-bar" : "flow-bar empty"}
                    style={{ width: `${pctBar}%` }}
                  />
                </div>
                <div className="waterfall-details">
                  <span>{tier.details}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="strategy-comparison-card">
        <h4>Strategy vs. Current Scenario Comparison</h4>
        <div className="strategy-comparison-grid">
          <div className="comparison-metric">
            <span className="metric-title">Employer Match Captured</span>
            <div className="metric-values">
              <div>
                <span className="val-label">Current:</span>
                <strong>{money(strategy.comparison.current.matchCaptured)}</strong>
              </div>
              <div className="arrow-sep">→</div>
              <div>
                <span className="val-label">Strategy:</span>
                <strong className="strategy-val">{money(strategy.comparison.strategy.matchCaptured)}</strong>
              </div>
            </div>
            {strategy.comparison.deltas.matchDifference !== 0 && (
              <div className={`metric-delta ${strategy.comparison.deltas.matchDifference > 0 ? "positive" : "neutral"}`}>
                {strategy.comparison.deltas.matchDifference > 0 ? "+" : ""}
                {money(strategy.comparison.deltas.matchDifference)} free match
              </div>
            )}
          </div>

          <div className="comparison-metric">
            <span className="metric-title">Tax-Advantaged Saved</span>
            <div className="metric-values">
              <div>
                <span className="val-label">Current:</span>
                <strong>{money(strategy.comparison.current.totalRetirementSaved)}</strong>
              </div>
              <div className="arrow-sep">→</div>
              <div>
                <span className="val-label">Strategy:</span>
                <strong className="strategy-val">{money(strategy.comparison.strategy.totalRetirementSaved)}</strong>
              </div>
            </div>
            {strategy.comparison.deltas.taxAdvantagedDifference !== 0 && (
              <div className="metric-delta">
                {strategy.comparison.deltas.taxAdvantagedDifference > 0 ? "+" : ""}
                {money(strategy.comparison.deltas.taxAdvantagedDifference)} / year
              </div>
            )}
          </div>

          <div className="comparison-metric">
            <span className="metric-title">Est. Current-Year Tax Savings</span>
            <div className="metric-values">
              <div>
                <span className="val-label">Current:</span>
                <strong>{money(strategy.comparison.current.estimatedCashTaxSavings)}</strong>
              </div>
              <div className="arrow-sep">→</div>
              <div>
                <span className="val-label">Strategy:</span>
                <strong className="strategy-val">{money(strategy.comparison.strategy.estimatedCashTaxSavings)}</strong>
              </div>
            </div>
            {strategy.comparison.deltas.taxSavingsDifference !== 0 && (
              <div className={`metric-delta ${strategy.comparison.deltas.taxSavingsDifference > 0 ? "positive" : ""}`}>
                {strategy.comparison.deltas.taxSavingsDifference > 0 ? "+" : ""}
                {money(strategy.comparison.deltas.taxSavingsDifference)} cash tax savings
              </div>
            )}
          </div>

          <div className="comparison-metric">
            <span className="metric-title">401(k) Employee Contribution</span>
            <div className="metric-values">
              <div>
                <span className="val-label">Current:</span>
                <strong>{money(strategy.comparison.current.total401k)} ({strategy.comparison.current.percent401k.toFixed(1)}%)</strong>
              </div>
              <div className="arrow-sep">→</div>
              <div>
                <span className="val-label">Strategy:</span>
                <strong className="strategy-val">
                  {money(strategy.comparison.strategy.total401k)} ({strategy.comparison.strategy.percent401k.toFixed(1)}%)
                </strong>
              </div>
            </div>
            <div className="metric-sub">
              {strategy.comparison.strategy.traditionalSharePercent}% Trad / {strategy.comparison.strategy.rothSharePercent}% Roth
            </div>
          </div>
        </div>

        <div className="strategy-action-bar">
          <button
            type="button"
            className="primary-button apply-strategy-btn"
            onClick={handleApply}
          >
            Apply Strategy to Scenario
          </button>
          {appliedNotice && <span className="applied-pill" role="status">{appliedNotice}</span>}
        </div>
      </div>
    </div>
  );
}
