import { useState, useEffect } from "react";
import type { AssumptionsV2, ScenarioV2 } from "../lib/planner";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import { Field } from "./Field";
import { TechEstimatorHero } from "./TechEstimatorHero";
import { QuickAssumptions } from "./QuickAssumptions";

export function QuickEstimate({
  scenario,
  assumptions,
  onScenarioChange,
  onAssumptionsChange,
  errors,
  allowInitialPreset,
}: {
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
  onAssumptionsChange: (assumptions: AssumptionsV2) => void;
  errors: Record<string, string>;
  allowInitialPreset: boolean;
}) {
  const [expenses, setExpenses] = useState(() => String(monthlyExpenses(scenario)));
  const [showSignOn, setShowSignOn] = useState(false);

  const hasSignOn = (Number(scenario.signOnY1) || 0) > 0 || (Number(scenario.signOnY2) || 0) > 0;

  useEffect(() => {
    setExpenses(String(monthlyExpenses(scenario)));
  }, [scenario.expenses]);

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

  return (
    <div className="quick-estimate-form">
      <TechEstimatorHero
        allowInitialPreset={allowInitialPreset}
        scenario={scenario}
        assumptions={assumptions}
        onScenarioChange={onScenarioChange}
        onAssumptionsChange={onAssumptionsChange}
      />
      <div className="two-cols">
        <Field
          label="Annual salary before tax"
          value={scenario.base}
          onChange={(base) => onScenarioChange({ ...scenario, base })}
          error={errors.base}
          hint="Annual base pay before taxes (USD / year)."
        />
        <Field
          label="Annual stock / RSUs"
          value={scenario.stock}
          onChange={(stock) => {
            const annualVal = Number(stock) || 0;
            const updatedGrants =
              scenario.grants &&
              scenario.grants.length === 1 &&
              scenario.grants[0].employmentId === "initial" &&
              scenario.grants[0].presetCompensation === "tech-quick"
                ? [{ ...scenario.grants[0], value: String(annualVal * 4) }]
                : scenario.grants;
            onScenarioChange({
              ...scenario,
              stock,
              includeStock: annualVal > 0 ? true : scenario.includeStock,
              grants: updatedGrants,
            });
          }}
          error={errors.stock}
          hint={scenario.grants.some((grant) => grant.presetCompensation !== "tech-quick") ? "Detailed stock grants are in use. Edit them in Detailed View; this field does not replace them." : "Annual RSU vesting value (USD / year, e.g. 4-year grant divided by 4)."}
        />
      </div>
      {hasSignOn || showSignOn ? (
        <div className="two-cols">
          <Field
            label="Year 1 sign-on bonus"
            value={scenario.signOnY1 ?? "0"}
            onChange={(signOnY1) => onScenarioChange({ ...scenario, signOnY1 })}
            error={errors.signOnY1}
            hint="First-year cash sign-on bonus (USD in Year 1)."
          />
          <Field
            label="Year 2 sign-on bonus"
            value={scenario.signOnY2 ?? "0"}
            onChange={(signOnY2) => onScenarioChange({ ...scenario, signOnY2 })}
            error={errors.signOnY2}
            hint="Second-year cash sign-on bonus (USD in Year 2, common at Amazon)."
          />
        </div>
      ) : (
        <div className="sign-on-toggle-row">
          <button
            type="button"
            className="link-btn sign-on-btn"
            onClick={() => setShowSignOn(true)}
          >
            + Add sign-on bonus
          </button>
        </div>
      )}
      <div className="two-cols">
        <Field
          label="Monthly living costs"
          value={expenses}
          onChange={updateExpenses}
          error={errors.expenses || fieldError(expenses, "monthlyExpenses")}
          hint="Estimated monthly living costs (USD / month) for selected location. Includes housing, food, transportation, healthcare and other spending."
        />
        <Field
          label="Current invested savings"
          value={assumptions.starting}
          onChange={(starting) => onAssumptionsChange({ ...assumptions, starting })}
          error={errors.starting}
          hint="Taxable investments in USD. Retirement accounts are available in detailed view."
        />
      </div>
      <Field
        label="Years to project"
        unit="years"
        value={assumptions.years}
        onChange={(years) => onAssumptionsChange({ ...assumptions, years })}
        error={errors.years}
        integer
      />
      <QuickAssumptions scenario={scenario} assumptions={assumptions} />
      <p className="hint">
        Detailed View adds account, tax, career and stock controls. Your inputs
        carry over; if you have annual stock but no grant, it creates an
        estimated four-year quarterly grant. The detailed projection may differ
        because it includes settings omitted here.
      </p>
    </div>
  );
}
