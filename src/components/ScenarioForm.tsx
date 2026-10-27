import { useState } from "react";
import type { Category } from "../lib/model";
import type { ScenarioV2 as Scenario, AssumptionsV2 } from "../lib/planner";
import { plannerScenarioErrors } from "../lib/planner";
import { AutoDetails } from "./EditorFields";
import { TaxEditor, BenefitsEditor } from "./TaxEditor";
import { EquityEditor } from "./EquityEditor";
import { CareerEditor } from "./CareerEditor";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import {
  applyCompensation,
  applyLocation,
  compensationPresets,
  compensationStatus,
  companies,
  findCompensation,
  levelMappings,
  locationPresets,
  locationStatus,
  stages,
} from "../data/presets";
import { Field } from "./Field";
import { money } from "../lib/format";
export const categoryLabels: Record<Category, string> = {
  housing: "Housing and utilities",
  food: "Food",
  transportation: "Transportation",
  healthcare: "Healthcare",
  other: "Other spending",
};
export function ScenarioForm({
  scenario: s,
  assumptions: a,
  onChange,
}: {
  scenario: Scenario;
  assumptions: AssumptionsV2;
  onChange: (s: Scenario) => void;
}) {
  const [expenseDraft, setExpenseDraft] = useState(() =>
    categoryKeys.every((k) => !fieldError(s.expenses[k], "monthlyExpenses")) &&
    Number.isFinite(monthlyExpenses(s))
      ? String(monthlyExpenses(s))
      : "",
  );
  const errors = plannerScenarioErrors(s, a),
    candidate = findCompensation(s);
  const applied = compensationPresets.find(
    (p) => p.id === s.appliedCompensation,
  );
  const location = locationPresets.find((p) => p.id === s.location);
  const appliedBudget = locationPresets.find((p) => p.id === s.appliedLocation);
  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) =>
    onChange({ ...s, [key]: value });
  function setTotal(value: string) {
    setExpenseDraft(value);
    if (fieldError(value, "monthlyExpenses")) {
      onChange({
        ...s,
        expenses: {
          housing: value,
          food: "0",
          transportation: "0",
          healthcare: "0",
          other: "0",
        },
      });
      return;
    }
    const total = Number(value),
      previous = monthlyExpenses(s),
      next = { ...s.expenses };
    let allocated = 0;
    categoryKeys.forEach((key, i) => {
      const amount =
        i === categoryKeys.length - 1
          ? total - allocated
          : Math.floor(
              total *
                (Number.isFinite(previous) && previous > 0
                  ? Number(s.expenses[key]) / previous
                  : 1 / 5) *
                100,
            ) / 100;
      next[key] = String(amount);
      allocated += amount;
    });
    onChange({ ...s, expenses: next });
  }
  function setCategory(key: Category, value: string) {
    const next = { ...s, expenses: { ...s.expenses, [key]: value } };
    const sum = monthlyExpenses(next);
    setExpenseDraft(
      categoryKeys.some(
        (k) => !!fieldError(next.expenses[k], "monthlyExpenses"),
      )
        ? ""
        : String(Number(sum.toFixed(8))),
    );
    onChange(next);
  }
  const totalValid = !["base", "bonus"].some((k) => errors[k]);
  return (
    <div className="scenario-form">
      <div className="field">
        <label htmlFor="scenario-name">Scenario name</label>
        <input
          id="scenario-name"
          type="text"
          maxLength={100}
          value={s.name}
          onChange={(e) => set("name", e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name && (
          <p id="name-error" className="error">
            {errors.name}
          </p>
        )}
      </div>
      <details className="preset-section">
        <summary>
          Start with a company preset <span className="optional">Optional</span>
        </summary>
        <div className="details-body">
          <p className="hint">Software engineer · Reported US averages</p>
          <div className="two-cols">
            <div className="field">
              <label htmlFor="company">Company</label>
              <select
                id="company"
                value={s.company}
                onChange={(e) => set("company", e.target.value)}
              >
                {companies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="stage">Career level</label>
              <select
                id="stage"
                value={s.stage}
                onChange={(e) => set("stage", e.target.value)}
              >
                {stages.map((st, i) => (
                  <option value={st.id} key={st.id}>
                    {st.label} · {levelMappings[s.company][i]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="comp-location">Compensation geography</label>
            <select
              id="comp-location"
              value={s.compensationLocation}
              onChange={(e) => set("compensationLocation", e.target.value)}
            >
              <option>United States</option>
            </select>
            <p className="hint">
              Nationwide figures; city-specific compensation is not bundled.
            </p>
          </div>
          {candidate ? (
            <p className="preset-preview">
              {money(candidate.base)} base + {money(candidate.bonus)} bonus +{" "}
              {money(candidate.stock)} stock / year
            </p>
          ) : (
            <p className="hint">
              {s.company === "Google"
                ? "Google’s public snapshot combines bonus with sign-on pay and uses first-year stock. A recurring breakdown could not be verified."
                : "A comparable recurring breakdown for this level was not verified."}{" "}
              Use manual entry or choose another level.
            </p>
          )}
          <button
            type="button"
            className="secondary small"
            disabled={!candidate}
            onClick={() =>
              candidate &&
              onChange({ ...s, ...applyCompensation(s, candidate) })
            }
          >
            Apply preset
          </button>
          {candidate && (
            <p className="hint source">
              <a href={candidate.source} target="_blank" rel="noreferrer">
                Levels.fyi ↗
              </a>{" "}
              · {candidate.statistic} · accessed Oct 27, 2026
            </p>
          )}
        </div>
      </details>
      <div className="section-label">
        <h3>Compensation</h3>
        <span className="status-tag">{compensationStatus(s)}</span>
      </div>
      {applied && (
        <p className="hint">
          Applied: {applied.company} {applied.level} · United States ·{" "}
          <a href={applied.source} target="_blank" rel="noreferrer">
            Source ↗
          </a>
        </p>
      )}
      <Field
        label="Annual base salary"
        unit="USD / year"
        value={s.base}
        onChange={(v) => set("base", v)}
        error={errors.base}
      />
      <div className="two-cols">
        <Field
          label="Recurring cash bonus"
          unit="USD / year"
          value={s.bonus}
          onChange={(v) => set("bonus", v)}
          error={errors.bonus}
        />
        <Field
          label="Annual salary growth"
          unit="%"
          value={s.growth}
          onChange={(v) => set("growth", v)}
          error={errors.growth}
        />
      </div>
      <div className="comp-total">
        <span>Annual cash compensation</span>
        <strong>
          {totalValid ? money(Number(s.base) + Number(s.bonus)) : "—"}
        </strong>
      </div>
      {applied && (
        <p className="hint">
          Reported annual stock reference: {money(applied.stock)}. Add actual
          grants below; an annual average does not establish award size or
          vesting.
        </p>
      )}
      <div className="section-label">
        <h3>Living expenses</h3>
        <span className="status-tag">{locationStatus(s)}</span>
      </div>
      <div className="location-picker">
        <div className="field">
          <label htmlFor="budget-location">
            Location budget <span className="unit-label">Optional</span>
          </label>
          <select
            id="budget-location"
            value={s.location}
            onChange={(e) => set("location", e.target.value)}
          >
            <option value="">Choose a location</option>
            {locationPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="secondary small"
          disabled={!location}
          onClick={() => {
            if (location) {
              onChange({ ...s, ...applyLocation(s, location) });
              setExpenseDraft(
                String(monthlyExpenses({ ...s, expenses: location.expenses })),
              );
            }
          }}
        >
          Apply budget
        </button>
      </div>
      <p className="hint">
        Minimum-needs budgets · One adult, no children, renting.
        {s.location &&
          " Review your separate tax residence for this location; compensation and taxes are unchanged."}
      </p>
      {appliedBudget && (
        <p className="hint source">
          {appliedBudget.scope} · 2026 ·{" "}
          <a href={appliedBudget.source} target="_blank" rel="noreferrer">
            Living Wage Institute ↗
          </a>
        </p>
      )}
      <Field
        label="Monthly living expenses"
        unit="USD / month"
        value={expenseDraft}
        onChange={setTotal}
        error={
          fieldError(expenseDraft, "monthlyExpenses") ||
          errors.expenses ||
          (categoryKeys.some((k) => errors[k])
            ? "Check the expense breakdown below."
            : undefined)
        }
      />
      <AutoDetails hasErrors={categoryKeys.some((k) => !!errors[k])}>
        <summary>Expense breakdown</summary>
        <div className="details-body">
          <p className="hint">
            Edit categories individually. Changing the total redistributes the
            budget proportionally.
          </p>
          {categoryKeys.map((k) => (
            <Field
              key={k}
              label={categoryLabels[k]}
              unit="USD / month"
              value={s.expenses[k]}
              onChange={(v) => setCategory(k, v)}
              error={errors[k]}
            />
          ))}
          <p className="hint">
            Housing includes rent, utilities, internet and mobile. Other
            includes civic engagement and other necessities in sourced budgets;
            add discretionary spending for your lifestyle. Healthcare includes
            payroll premiums; these are offset once in results. Income taxes and
            savings are excluded.
          </p>
        </div>
      </AutoDetails>
      <TaxEditor s={s} a={a} onChange={onChange} />
      <BenefitsEditor s={s} a={a} onChange={onChange} />
      <CareerEditor s={s} a={a} onChange={onChange} />
      <EquityEditor s={s} a={a} onChange={onChange} />
    </div>
  );
}
