import { useEffect, useState } from "react";
import { plannerScenarioErrors, plannerSharedErrors, type ScenarioV2, type AssumptionsV2 } from "../lib/planner";
import { money } from "../lib/format";
import {
  calculateRetirementStrategy,
  applyRetirementStrategy,
  getStrategyPresets,
} from "../lib/retirementStrategy";
export function QuickRetirementPresets({
  scenario,
  assumptions,
  onScenarioChange,
}: {
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
}) {
  const [strategyNotice, setStrategyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!strategyNotice) return;
    const timer = setTimeout(() => setStrategyNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [strategyNotice]);

  if (Object.keys(plannerScenarioErrors(scenario, assumptions)).length || Object.keys(plannerSharedErrors(assumptions)).length)
    return null;

  const strategyPresets = getStrategyPresets(scenario, assumptions);
  const standardMaximum = strategyPresets.find((preset) => preset.id === "max-401k");
  const maximum = strategyPresets.find((preset) => preset.id === "max-all");
  if (!standardMaximum || !maximum) return null;

  const applyPresetStrategy = (
    presetId: "match-only" | "max-401k" | "max-all",
  ) => {
    const targetPreset = strategyPresets.find((preset) => preset.id === presetId);
    if (!targetPreset) return;
    const amount = targetPreset.amount;
    const optStrategy = calculateRetirementStrategy(scenario, assumptions, {
      targetSavings: amount,
      taxPreference: "traditional",
      enableBackdoor: presetId === "max-all",
      enableMegaBackdoor: presetId === "max-all",
    });
    const updated = applyRetirementStrategy(scenario, optStrategy);
    onScenarioChange(updated);
    const label =
      presetId === "match-only"
        ? "employer match only"
        : presetId === "max-401k"
          ? "max 401(k)"
          : "optimal tax-advantaged accounts";
    setStrategyNotice(`Applied ${label} (${money(amount)}/yr)!`);
  };

  const handleMaxOptimal = () => {
    applyPresetStrategy("max-all");
  };

  return (
    <div className="hero-control-group hero-full-width">
      <label className="hero-label">1-Click Retirement Savings Strategy</label>
      <div className="hero-strategy-row">
        <div
          className="pill-selector"
          role="group"
          aria-label="Retirement savings target"
        >
          <button
            type="button"
            className="pill-btn"
            title="Contribute just enough to capture 100% of employer 401(k) match"
            onClick={() => applyPresetStrategy("match-only")}
          >
            Employer Match Only
          </button>
          <button
            type="button"
            className="pill-btn"
            title={standardMaximum.description}
            onClick={() => applyPresetStrategy("max-401k")}
          >
            {standardMaximum.label}
          </button>
          <button
            type="button"
            className="max-optimal-hero-btn"
            title={maximum.description}
            onClick={handleMaxOptimal}
          >
            Max Out Retirement Accounts ({money(maximum.amount)}/yr)
          </button>
        </div>
        {strategyNotice && (
          <span className="applied-pill" role="status">
            {strategyNotice}
          </span>
        )}
      </div>
    </div>
  );
}
