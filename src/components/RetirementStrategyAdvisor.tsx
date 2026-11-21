import { useEffect, useId, useState } from "react";
import { numberError, type AssumptionsV2, type ScenarioV2 } from "../lib/planner";
import { money } from "../lib/format";
import {
  applyRetirementStrategy,
  calculateRetirementStrategy,
  getStrategyPresets,
  retirementConversionAvailability,
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

  const targetError = numberError(targetSavingsDraft, 0, 10_000_000);
  const targetAmount = targetError ? 0 : Number(targetSavingsDraft);

  useEffect(() => {
    if (!appliedNotice) return;
    const timer = setTimeout(() => setAppliedNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [appliedNotice]);

  const apply = (amount: number, label: string) => {
    const strategy = calculateRetirementStrategy(s, a, {
      targetSavings: amount,
      taxPreference,
      enableBackdoor,
      enableMegaBackdoor,
    });
    onChange(applyRetirementStrategy(s, strategy));
    setAppliedNotice(`Applied ${label} (${money(amount)}/yr)!`);
  };

  const handleSelectMilestone = (amount: number, label: string) => {
    setTargetSavingsDraft(String(amount));
    apply(amount, label);
  };

  const advisorId = useId();
  const conversions = retirementConversionAvailability(s, a);

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
                  onClick={() => handleSelectMilestone(p.amount, p.label)}
                  title={`${p.description} · Click to apply immediately`}
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
            hint={targetError ? undefined : `${money(Math.round(targetAmount / 12))}/mo`}
          />

          <div>
            <label className="field-label">Tax advantage preference</label>
            <div className="pill-selector preference-selector" role="group" aria-label="Tax preference">
              <button
                type="button"
                className={`pill-btn ${taxPreference === "traditional" ? "active" : ""}`}
                onClick={() => setTaxPreference("traditional")}
                aria-pressed={taxPreference === "traditional"}
                title="Traditional: Maximize immediate income tax deduction"
              >
                Traditional
              </button>
              <button
                type="button"
                className={`pill-btn ${taxPreference === "roth" ? "active" : ""}`}
                onClick={() => setTaxPreference("roth")}
                aria-pressed={taxPreference === "roth"}
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
                checked={enableBackdoor && conversions.backdoor}
                disabled={!conversions.backdoor}
                onChange={(e) => setEnableBackdoor(e.target.checked)}
              />
              <span>Enable Backdoor Roth IRA</span>
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={enableMegaBackdoor && conversions.megaBackdoor}
                disabled={!conversions.megaBackdoor}
                onChange={(e) => setEnableMegaBackdoor(e.target.checked)}
              />
              <span>Enable Mega Backdoor Roth</span>
            </label>
            {(!conversions.backdoor || !conversions.megaBackdoor) && (
              <p className="hint">Confirm eligibility in Age, eligibility &amp; additional accounts to include these routes.</p>
            )}
          </div>
        </details>

        <div className="strategy-action-bar">
          <button
            type="button"
            className="primary-button apply-strategy-btn"
            onClick={() => apply(targetAmount, "savings strategy")}
            disabled={!!targetError}
          >
            Apply Strategy to Scenario
          </button>
          {appliedNotice && <span className="applied-pill" role="status">{appliedNotice}</span>}
        </div>
      </div>
    </div>
  );
}
