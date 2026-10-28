import { useState } from "react";
import type { AssumptionsV2, ScenarioV2, TaxLocation } from "../lib/planner";
import { taxLocations } from "../lib/planner";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import { Field } from "./Field";
import { Toggle } from "./EditorFields";

export function QuickEstimate({
  scenario,
  assumptions,
  onScenarioChange,
  onAssumptionsChange,
  errors,
}: {
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
  onAssumptionsChange: (assumptions: AssumptionsV2) => void;
  errors: Record<string, string>;
}) {
  const [expenses, setExpenses] = useState(() => String(monthlyExpenses(scenario)));
  const selectedTaxLocation = taxLocations.find(
    (location) => location.id === scenario.taxProfile.location,
  );

  function updateExpenses(value: string) {
    setExpenses(value);
    if (fieldError(value, "monthlyExpenses")) {
      onScenarioChange({
        ...scenario,
        expenses: { ...scenario.expenses, housing: value },
      });
      return;
    }

    const total = Number(value);
    const previous = monthlyExpenses(scenario);
    let allocated = 0;
    const next = { ...scenario.expenses };
    categoryKeys.forEach((key, index) => {
      const amount = index === categoryKeys.length - 1
        ? total - allocated
        : Math.floor(
            total *
              (previous > 0
                ? Number(scenario.expenses[key]) / previous
                : 1 / categoryKeys.length) *
              100,
          ) / 100;
      next[key] = String(amount);
      allocated += amount;
    });
    onScenarioChange({ ...scenario, expenses: next });
  }

  function updateTaxLocation(location: TaxLocation) {
    onScenarioChange({
      ...scenario,
      taxProfile: { ...scenario.taxProfile, location },
    });
  }

  function updateFiling(filing: "single" | "joint") {
    onScenarioChange({
      ...scenario,
      taxProfile: { ...scenario.taxProfile, filing },
    });
  }

  function updateTaxMode(mode: "calculated" | "manual") {
    onScenarioChange({
      ...scenario,
      taxProfile: { ...scenario.taxProfile, mode },
    });
  }

  return (
    <div className="quick-estimate-form">
      <p className="quick-estimate-intro">
        Start with four numbers. You can add assumptions below or build a detailed plan.
      </p>
      <Field
        label="Annual salary before tax"
        unit="USD / year"
        value={scenario.base}
        onChange={(base) => onScenarioChange({ ...scenario, base })}
        error={errors.base}
      />
      <Field
        label="Monthly living costs"
        unit="USD / month"
        value={expenses}
        onChange={updateExpenses}
        error={errors.expenses || fieldError(expenses, "monthlyExpenses")}
        hint="Include housing, food, transportation, healthcare and other spending."
      />
      <Field
        label="Current invested savings"
        unit="USD"
        value={assumptions.starting}
        onChange={(starting) => onAssumptionsChange({ ...assumptions, starting })}
        error={errors.starting}
        hint="Taxable investments. Retirement accounts are optional below."
      />
      <Field
        label="Years to project"
        unit="years"
        value={assumptions.years}
        onChange={(years) => onAssumptionsChange({ ...assumptions, years })}
        error={errors.years}
        integer
      />

      <details className="quick-assumptions">
        <summary>
          Assumptions: {scenario.growth}% salary growth · {assumptions.returns}% return · {assumptions.inflation}% cost inflation
          <span className="optional">Edit</span>
        </summary>
        <div className="details-body">
          <section className="assumption-group" aria-labelledby="income-assumptions">
            <h3 id="income-assumptions">Income and household</h3>
            <div className="two-cols">
              <Field
                label="Annual salary growth"
                unit="% / year"
                value={scenario.growth}
                onChange={(growth) => onScenarioChange({ ...scenario, growth })}
                error={errors.growth}
              />
              <Field
                label="Annual cash bonus"
                unit="USD / year"
                value={scenario.bonus}
                onChange={(bonus) => onScenarioChange({ ...scenario, bonus })}
                error={errors.bonus}
              />
            </div>
            <div className="two-cols">
              <Field
                label="Annual investment return"
                unit="% / year"
                value={assumptions.returns}
                onChange={(returns) => onAssumptionsChange({ ...assumptions, returns })}
                error={errors.returns}
              />
              <Field
                label="Annual expense inflation"
                unit="% / year"
                value={assumptions.inflation}
                onChange={(inflation) => onAssumptionsChange({ ...assumptions, inflation })}
                error={errors.inflation}
              />
            </div>
          </section>

          <section className="assumption-group" aria-labelledby="tax-assumptions">
            <h3 id="tax-assumptions">Tax estimate</h3>
            <div className="field">
              <label htmlFor="quick-tax-mode">How should taxes be estimated?</label>
              <select
                id="quick-tax-mode"
                value={scenario.taxProfile.mode}
                onChange={(event) => updateTaxMode(event.target.value as "calculated" | "manual")}
              >
                <option value="calculated">Estimate from location and filing status</option>
                <option value="manual">Use my total effective tax rate</option>
              </select>
            </div>
            {scenario.taxProfile.mode === "calculated" ? (
              <>
                <div className="two-cols">
                  <div className="field">
                    <label htmlFor="quick-tax-location">Tax location</label>
                    <select
                      id="quick-tax-location"
                      value={scenario.taxProfile.location}
                      onChange={(event) => updateTaxLocation(event.target.value as TaxLocation)}
                    >
                      {taxLocations.map((location) => (
                        <option key={location.id} value={location.id}>{location.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="quick-filing-status">Filing status</label>
                    <select
                      id="quick-filing-status"
                      value={scenario.taxProfile.filing}
                      onChange={(event) => updateFiling(event.target.value as "single" | "joint")}
                    >
                      <option value="single">Single</option>
                      <option value="joint">Married filing jointly</option>
                    </select>
                  </div>
                </div>
                {scenario.taxProfile.filing === "joint" && (
                  <div className="two-cols">
                    <Field
                      label="Spouse annual salary"
                      unit="USD / year"
                      value={scenario.taxProfile.spouseWages}
                      onChange={(spouseWages) => onScenarioChange({
                        ...scenario,
                        taxProfile: { ...scenario.taxProfile, spouseWages },
                      })}
                      error={errors["taxProfile.spouseWages"]}
                    />
                    <Field
                      label="Spouse salary growth"
                      unit="% / year"
                      value={scenario.taxProfile.spouseGrowth}
                      onChange={(spouseGrowth) => onScenarioChange({
                        ...scenario,
                        taxProfile: { ...scenario.taxProfile, spouseGrowth },
                      })}
                      error={errors["taxProfile.spouseGrowth"]}
                    />
                  </div>
                )}
                <p className="hint">
                  Uses an estimate of 2026 federal, state and local income/payroll taxes for {selectedTaxLocation?.label ?? "the selected location"}. Future tax law is not predicted.
                </p>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="quick-manual-filing-status">Household filing status</label>
                  <select
                    id="quick-manual-filing-status"
                    value={scenario.taxProfile.filing}
                    onChange={(event) => updateFiling(event.target.value as "single" | "joint")}
                  >
                    <option value="single">Single</option>
                    <option value="joint">Married filing jointly</option>
                  </select>
                </div>
                {scenario.taxProfile.filing === "joint" && (
                  <div className="two-cols">
                    <Field
                      label="Spouse annual salary"
                      unit="USD / year"
                      value={scenario.taxProfile.spouseWages}
                      onChange={(spouseWages) => onScenarioChange({
                        ...scenario,
                        taxProfile: { ...scenario.taxProfile, spouseWages },
                      })}
                      error={errors["taxProfile.spouseWages"]}
                    />
                    <Field
                      label="Spouse salary growth"
                      unit="% / year"
                      value={scenario.taxProfile.spouseGrowth}
                      onChange={(spouseGrowth) => onScenarioChange({
                        ...scenario,
                        taxProfile: { ...scenario.taxProfile, spouseGrowth },
                      })}
                      error={errors["taxProfile.spouseGrowth"]}
                    />
                  </div>
                )}
                <Field
                  label="Total effective tax rate"
                  unit="%"
                  value={scenario.tax}
                  onChange={(tax) => onScenarioChange({ ...scenario, tax })}
                  error={errors.tax}
                />
                <p className="hint">
                  Applies one effective rate to cash and stock compensation. Use your own estimate; this mode does not model tax brackets or location rules.
                </p>
              </>
            )}
          </section>

          <section className="assumption-group" aria-labelledby="accounts-assumptions">
            <h3 id="accounts-assumptions">Equity and retirement accounts</h3>
            <Toggle
              label="Include annual stock compensation"
              checked={scenario.includeStock}
              onChange={(includeStock) => onScenarioChange({ ...scenario, includeStock })}
              hint="A simplified annual amount, treated as sold in December. Detailed grant schedules are available in the full planner."
            />
            {scenario.includeStock && (
              <Field
                label="Annual stock value"
                unit="USD / year"
                value={scenario.stock}
                onChange={(stock) => onScenarioChange({ ...scenario, stock })}
                error={errors.stock}
              />
            )}
            <div className="two-cols">
              <Field
                label="Starting 401(k) balance"
                unit="USD"
                value={assumptions.startingRetirement}
                onChange={(startingRetirement) => onAssumptionsChange({ ...assumptions, startingRetirement })}
                error={errors.startingRetirement}
              />
              <Field
                label="Annual 401(k) contribution"
                unit="USD / year"
                value={scenario.benefits.retirement}
                onChange={(retirement) => onScenarioChange({
                  ...scenario,
                  benefits: { ...scenario.benefits, retirement },
                })}
                error={errors["benefits.retirement"]}
              />
            </div>
            <div className="two-cols">
              <Field
                label="Starting HSA balance"
                unit="USD"
                value={assumptions.startingHsa}
                onChange={(startingHsa) => onAssumptionsChange({ ...assumptions, startingHsa })}
                error={errors.startingHsa}
              />
              <Field
                label="Annual HSA contribution"
                unit="USD / year"
                value={scenario.benefits.hsa}
                onChange={(hsa) => onScenarioChange({
                  ...scenario,
                  benefits: { ...scenario.benefits, hsa },
                })}
              error={errors["benefits.hsa"]}
              />
            </div>
            <div className="field">
              <label htmlFor="quick-hsa-coverage">HSA coverage</label>
              <select
                id="quick-hsa-coverage"
                value={scenario.taxProfile.hsaCoverage}
                onChange={(event) => onScenarioChange({
                  ...scenario,
                  taxProfile: {
                    ...scenario.taxProfile,
                    hsaCoverage: event.target.value as ScenarioV2["taxProfile"]["hsaCoverage"],
                  },
                })}
              >
                <option value="none">Not HSA-eligible / no contributions</option>
                <option value="self">Self-only eligible</option>
                <option value="family">Family eligible</option>
              </select>
            </div>
            <p className="hint">
              Starting balances and primary-worker contributions only. Payroll health premiums and spouse benefits are available in the full planner. Investment returns and future tax treatment are estimates, not guarantees.
            </p>
          </section>
        </div>
      </details>
    </div>
  );
}
