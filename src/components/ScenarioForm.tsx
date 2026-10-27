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
  compensationProgressionEvents,
  compensationStatus,
  companies,
  compensationRegions,
  findCompensation,
  hasCompensationProgression,
  levelExperience,
  levelExperienceSource,
  levelMappings,
  locationPresets,
  locationStatus,
  stages,
} from "../data/presets";
import { Field } from "./Field";
import { money } from "../lib/format";
import { templateSchedule } from "../data/vesting";
import { monthLabel, uid } from "../lib/planner";
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
  function applyCompanyPreset(preset: (typeof compensationPresets)[number]) {
    const manualEvents = s.events.filter((event) => !event.presetProgression),
      proposed = compensationProgressionEvents(
        s,
        preset,
        Number(a.startYear),
        Number(a.years),
      ),
      collision = proposed.findIndex((event) =>
        manualEvents.some((manual) => manual.month <= event.month),
      ),
      generated = proposed.slice(0, collision < 0 ? proposed.length : collision),
      next = applyCompensation(s, preset),
      presetGrant = preset.stockGrantMultiplier > 0
        ? [{ id: uid(), name: `${preset.company} ${preset.level} preset equity`, issuerId: s.employerId, employmentId: "initial", month: monthLabel(0, Number(a.startYear)), units: "dollars" as const, value: String(preset.stock * preset.stockGrantMultiplier), priceMode: "modeled" as const, grantPrice: "100", schedule: templateSchedule(preset.vestingTemplate), template: preset.vestingTemplate, treatment: "sell" as const, keepOnDeparture: false, presetCompensation: preset.id }]
        : [];
    onChange({
      ...s,
      ...next,
      role: `${preset.company} ${preset.level} · Software engineer`,
      issuers: s.issuers.map((issuer) =>
        issuer.id === s.employerId
          ? { ...issuer, name: preset.company }
          : issuer,
      ),
      events: [...manualEvents, ...generated],
      grants: [...s.grants.filter((grant) => !grant.presetCompensation), ...presetGrant],
      stockMode: presetGrant.length ? "grants" : s.stockMode,
    });
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
          <p className="hint">Software engineer · Reported regional averages</p>
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
              {compensationRegions.map((region) => <option key={region}>{region}</option>)}
            </select>
            <p className="hint">
              Compensation and progression use this region’s reported figures.
            </p>
          </div>
          {candidate ? (
            <p className="preset-preview">
              {money(candidate.base)} base + {money(candidate.bonusProjection)} modeled recurring bonus (reported: {money(candidate.bonus)}) +{" "}
              {money(candidate.stock)} reported stock / year
            </p>
          ) : (
            <p className="hint">
              {s.company === "Google"
                ? "Google’s public snapshot combines bonus with sign-on pay and uses first-year stock. A recurring breakdown could not be verified."
                : "A comparable recurring breakdown for this level was not verified."}{" "}
              Use manual entry or choose another level.
            </p>
          )}
          <div className="progression-preview">
            <strong>Reported level progression</strong>
            {levelExperience[s.company] ? (
              <>
                <p className="hint">
                  Average years of experience by level in Levels.fyi submissions.
                  Gaps between these averages time modeled promotions when you
                  apply the preset; they are not observed promotion durations.
                </p>
                <ol>
                  {stages.map((stage, index) => {
                    const row = compensationPresets.find(
                      (p) => p.company === s.company && p.stage === stage.id && p.scope === s.compensationLocation,
                    );
                    const experience = levelExperience[s.company][index];
                    return (
                      <li key={stage.id}>
                        <span>
                          {stage.label} · {levelMappings[s.company][index]}
                        </span>
                        <span>Avg. {experience} years’ experience</span>
                        <span>
                          {row
                          ? `${money(row.base)} base + ${money(row.bonusProjection)} recurring bonus + ${money(row.stock)} stock / yr`
                            : "Compensation breakdown unavailable"}
                        </span>
                        {index > 0 && (
                          <span className="hint">
                            +{(experience - levelExperience[s.company][index - 1]).toFixed(1)}
                            yrs between level averages
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <p className="hint">
                No comparable public level-by-experience breakdown found for {s.company}.
              </p>
            )}
            <p className="hint source">
              <a href={levelExperienceSource} target="_blank" rel="noreferrer">
                Levels.fyi community analysis ↗
              </a>
            </p>
          </div>
          <button
            type="button"
            className="secondary small"
            disabled={!candidate}
            onClick={() => candidate && applyCompanyPreset(candidate)}
          >
            Apply pay and progression
          </button>
          {candidate && (
            <p className="hint">
              {hasCompensationProgression(candidate)
                ? "Models next-level base, eligible recurring bonus, and a representative four-year equity award at each available promotion. Promotion timing uses level experience averages; edit or remove events under Career progression."
                : "No next-level promotion path is available for this preset; the reported pay fills the starting role only."}{" "}
              Initial and promotion equity uses the company vesting template. No annual refreshers are assumed. Google first-year stock and combined bonus/sign-on are excluded from recurring projections; Amazon sign-on bonus is excluded.
            </p>
          )}
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
          Applied: {applied.company} {applied.level} · {applied.scope} ·{" "}
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
          Reported annualized stock reference: {money(applied.stock)}. The preset models an estimated four-year grant of {money(applied.stock * applied.stockGrantMultiplier)} using {applied.vestingTemplate} vesting; this is an estimate, not a disclosed individual grant.
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
