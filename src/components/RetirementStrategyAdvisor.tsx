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
  const optimalMaxTotal = presets.find((p) => p.id === "max-all")?.amount || presets.find((p) => p.id === "max-401k")?.amount || 36400;
  const defaultTarget = optimalMaxTotal;

  const [targetSavingsDraft, setTargetSavingsDraft] = useState<string>(() =>
    String(Math.max(1000, defaultTarget)),
  );
  const [taxPreference, setTaxPreference] = useState<TaxStrategyPreference>("traditional");
  const [enableBackdoor, setEnableBackdoor] = useState(true);
  const [enableMegaBackdoor, setEnableMegaBackdoor] = useState(true);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const targetAmount = Math.max(0, Number(targetSavingsDraft) || 0);

  const strategy = calculateRetirementStrategy(s, a, {
    targetSavings: targetAmount,
    taxPreference,
    enableBackdoor,
    enableMegaBackdoor,
  });

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
      <div className="max-optimal-action-group">
        <button
          type="button"
          className="primary-button max-optimal-btn"
          title={`Max out all optimal accounts: 401(k), ${s.taxProfile.hsaCoverage !== "none" ? "HSA, " : ""}IRA, and Mega Backdoor Roth (${money(optimalMaxTotal)} / year)`}
          onClick={handleMaxOptimal}
        >
          ⚡ Max Out Optimal Accounts ({money(optimalMaxTotal)}/yr)
        </button>
        {appliedNotice && <span className="applied-pill" role="status">{appliedNotice}</span>}
      </div>

      <div className="strategy-controls">
        <div className="strategy-control-row">
          <label className="field-label" id={`${advisorId}-heading`}>Customize annual retirement target</label>
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
                className={`pill-btn ${taxPreference === "traditional" ? "active" : ""}`}
                onClick={() => setTaxPreference("traditional")}
                title="Prioritize Traditional 401(k) to maximize immediate income tax deduction"
              >
                Traditional (Tax Relief Now)
              </button>
              <button
                type="button"
                className={`pill-btn ${taxPreference === "roth" ? "active" : ""}`}
                onClick={() => setTaxPreference("roth")}
                title="Prioritize Roth 401(k) for tax-free retirement growth and withdrawals"
              >
                Roth (Tax-Free Later)
              </button>
            </div>
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
              <span>Enable Backdoor Roth IRA</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={enableMegaBackdoor}
                onChange={(e) => setEnableMegaBackdoor(e.target.checked)}
              />
              <span>Enable Mega Backdoor Roth</span>
            </label>
          </div>
        </details>

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
