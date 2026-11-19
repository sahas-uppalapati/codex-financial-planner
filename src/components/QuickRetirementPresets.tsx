import { useState } from "react";
import type { ScenarioV2, AssumptionsV2 } from "../lib/planner";
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

  const strategyPresets = getStrategyPresets(scenario, assumptions);
  const optimalMaxTotal =
    strategyPresets.find((p) => p.id === "max-all")?.amount ||
    strategyPresets.find((p) => p.id === "max-401k")?.amount ||
    36400;

  const applyPresetStrategy = (
    presetId: "match-only" | "max-401k" | "max-all",
  ) => {
    const targetPreset = strategyPresets.find((p) => p.id === presetId);
    const amount =
      targetPreset?.amount ??
      (presetId === "max-all" ? optimalMaxTotal : 23500);
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
    setTimeout(() => setStrategyNotice(null), 4000);
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
            title="Max out employee 401(k) deferral limit ($23,500/yr)"
            onClick={() => applyPresetStrategy("max-401k")}
          >
            Max 401(k)
          </button>
          <button
            type="button"
            className="max-optimal-hero-btn"
            title={`Max out optimal accounts: 401(k), ${scenario.taxProfile.hsaCoverage !== "none" ? "HSA, " : ""}IRA, and Mega Backdoor (${money(optimalMaxTotal)} / year)`}
            onClick={handleMaxOptimal}
          >
            Max Out Retirement Accounts ({money(optimalMaxTotal)}/yr)
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
