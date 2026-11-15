import { useId, useState } from "react";
import type { AssumptionsV2, ScenarioV2 } from "../lib/planner";
import { money } from "../lib/format";
import {
  applyRetirementStrategy,
  calculateRetirementStrategy,
  getStrategyPresets,
} from "../lib/retirementStrategy";
import type { TaxStrategyPreference } from "../lib/retirementStrategy";
import {
  annualAge,
  annualRetirementLimits,
  employeeDeferralLimit,
} from "../lib/retirement";
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

  const year = Number(a.startYear) || 2026;
  const inflation = Number(a.taxInflation) || 0;
  const limits = annualRetirementLimits(year, inflation);
  const age = annualAge(s.retirementProfiles.primary, 0);
  const allowsCatchUp = s.retirementProfiles.primary.allowsCatchUp === true;
  const max401kOnly = employeeDeferralLimit(limits, age, allowsCatchUp);

  const matchPreset = presets.find((p) => p.id === "match-only");
  const maxAllPreset = presets.find((p) => p.id === "max-all");

  const simplifiedPresets = [
    ...(matchPreset && matchPreset.amount > 0
      ? [{ id: "match", label: "Full Match", amount: matchPreset.amount, description: matchPreset.description }]
      : []),
    { id: "max-401k", label: "Max 401(k)", amount: max401kOnly, description: `Max employee 401(k) limit (${money(max401kOnly)})` },
    ...(maxAllPreset && maxAllPreset.amount > max401kOnly
      ? [{ id: "max-all", label: "Max All", amount: maxAllPreset.amount, description: maxAllPreset.description }]
      : []),
  ];

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

  const advisorId = useId();

  return (
    <div className="strategy-advisor-card" aria-labelledby={`${advisorId}-heading`}>
      <div className="strategy-controls">
        <div className="strategy-control-row">
          <label className="field-label" id={`${advisorId}-heading`}>Target milestone</label>
          <div className="pill-selector" role="group" aria-label="Savings target presets">
            {simplifiedPresets.map((p) => {
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
            hint={`${money(Math.round(targetAmount / 12))}/mo`}
          />

          <div>
            <label className="field-label">Tax advantage preference</label>
            <div className="pill-selector preference-selector" role="group" aria-label="Tax preference">
              <button
                type="button"
                className={`pill-btn ${taxPreference === "traditional" ? "active" : ""}`}
                onClick={() => setTaxPreference("traditional")}
                title="Traditional: Maximize immediate income tax deduction"
              >
                Traditional
              </button>
              <button
                type="button"
                className={`pill-btn ${taxPreference === "roth" ? "active" : ""}`}
                onClick={() => setTaxPreference("roth")}
                title="Roth: Tax-free retirement growth and withdrawals"
              >
                Roth
              </button>
            </div>
          </div>
        </div>

        <details className="strategy-advanced-toggles">
          <summary>Advanced options <span className="optional">Backdoor & Mega Backdoor</span></summary>
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
