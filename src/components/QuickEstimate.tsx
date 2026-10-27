import { useState } from "react";
import type { ScenarioV2, AssumptionsV2, TaxLocation } from "../lib/planner";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import { taxLocations } from "../lib/planner";
import { Field } from "./Field";

export function QuickEstimate({
  scenario,
  assumptions,
  onScenarioChange,
  onAssumptionsChange,
  salaryError,
  expensesError,
  investmentsError,
  yearsError,
}: {
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
  onAssumptionsChange: (assumptions: AssumptionsV2) => void;
  salaryError?: string;
  expensesError?: string;
  investmentsError?: string;
  yearsError?: string;
}) {
  const [expenses, setExpenses] = useState(() => String(monthlyExpenses(scenario)));
  const selectedTaxLocation = taxLocations.find((location) => location.id === scenario.taxProfile.location);
  function updateExpenses(value: string) {
    setExpenses(value);
    if (fieldError(value, "monthlyExpenses")) {
      onScenarioChange({ ...scenario, expenses: { ...scenario.expenses, housing: value } });
      return;
    }
    const total = Number(value);
    const previous = monthlyExpenses(scenario);
    let allocated = 0;
    const next = { ...scenario.expenses };
    categoryKeys.forEach((key, index) => {
      const amount = index === categoryKeys.length - 1
        ? total - allocated
        : Math.floor(total * (previous > 0 ? Number(scenario.expenses[key]) / previous : 1 / categoryKeys.length) * 100) / 100;
      next[key] = String(amount);
      allocated += amount;
    });
    onScenarioChange({ ...scenario, expenses: next });
  }
  return (
    <div className="quick-estimate-form">
      <p className="quick-estimate-intro">Start with four numbers. You can add bonuses, equity, accounts and career changes later.</p>
      <Field label="Annual salary before tax" unit="USD / year" value={scenario.base} onChange={(base) => onScenarioChange({ ...scenario, base })} error={salaryError} />
      <Field label="Monthly living costs" unit="USD / month" value={expenses} onChange={updateExpenses} error={expensesError || fieldError(expenses, "monthlyExpenses")} hint="Include housing, food, transportation, healthcare and other spending." />
      <Field label="Current invested savings" unit="USD" value={assumptions.starting} onChange={(starting) => onAssumptionsChange({ ...assumptions, starting })} error={investmentsError} hint="Taxable investments. Retirement accounts can be added in detailed mode." />
      <Field label="Years to project" unit="years" value={assumptions.years} onChange={(years) => onAssumptionsChange({ ...assumptions, years })} error={yearsError} integer />
      <details className="quick-assumptions">
        <summary>Estimate assumptions <span className="optional">Optional</span></summary>
        <div className="details-body">
          <div className="field">
            <label htmlFor="quick-tax-location">Tax location <span className="unit-label">Optional</span></label>
            <select id="quick-tax-location" value={scenario.taxProfile.location} onChange={(e) => onScenarioChange({ ...scenario, taxProfile: { ...scenario.taxProfile, location: e.target.value as TaxLocation } })}>
              {taxLocations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
            </select>
          </div>
          <p className="hint">Tax estimate uses {selectedTaxLocation?.label ?? "Columbus, OH"}.</p>
          <p className="hint">Assumes 3% annual salary growth, 5% investment return and 2.5% expense inflation. Taxes use an estimated single-filer profile for the selected location. Bonuses, equity and retirement accounts are excluded. Future tax law and investment returns are not predicted.</p>
        </div>
      </details>
    </div>
  );
}
