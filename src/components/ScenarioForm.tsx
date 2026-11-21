import { QuickRetirementPresets } from "./QuickRetirementPresets";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { RetirementGuide } from "./RetirementGuide";
import type { Categories, Category } from "../lib/model";
import type { ScenarioV2 as Scenario, AssumptionsV2 } from "../lib/planner";
import {
  plannerScenarioErrors,
  plannerSharedErrors,
} from "../lib/planner";
import { AutoDetails } from "./EditorFields";
import { TaxEditor, BenefitsEditor } from "./TaxEditor";
import { EquityEditor } from "./EquityEditor";
import { CareerEditor } from "./CareerEditor";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import { applyLocation, locationPresets } from "../data/presets";
import { Field } from "./Field";
import { TechEstimatorHero } from "./TechEstimatorHero";

export const categoryLabels: Record<Category, string> = {
  housing: "Housing and utilities",
  food: "Food",
  transportation: "Transportation",
  healthcare: "Healthcare",
  other: "Other spending",
};

export interface TotalExpenseDraft {
  value: string;
  expenses: Categories;
  basis: Categories;
}

const decimalAmount = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumSignificantDigits: 17,
});

export function ScenarioForm({
  scenario: s,
  assumptions: a,
  onChange,
  totalExpenseDraft,
  onTotalExpenseChange,
  onAssumptionsChange,
  allowInitialPreset = false,
  showName = false,
  startup = false,
  startupFields,
}: {
  scenario: Scenario;
  assumptions: AssumptionsV2;
  onChange: (s: Scenario) => void;
  totalExpenseDraft?: TotalExpenseDraft;
  onTotalExpenseChange: (draft: TotalExpenseDraft) => void;
  onAssumptionsChange: (a: AssumptionsV2) => void;
  allowInitialPreset?: boolean;
  showName?: boolean;
  startup?: boolean;
  startupFields?: ReactNode;
}) {
  const [showSignOn, setShowSignOn] = useState(false);
  const errors = { ...plannerScenarioErrors(s, a), ...plannerSharedErrors(a) };
  const invalidCategory = categoryKeys.some((key) => !!errors[key]);
  const expenseValue = totalExpenseDraft?.value ??
    (invalidCategory ? "" : decimalAmount.format(monthlyExpenses(s)));
  const expenseDraftError = totalExpenseDraft && fieldError(expenseValue, "monthlyExpenses");
  const location = locationPresets.find((p) => p.id === s.location);
  const hasSignOn =
    (Number(s.signOnY1) || 0) > 0 || (Number(s.signOnY2) || 0) > 0;

  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) =>
    onChange({ ...s, [key]: value });

  const shared = <K extends keyof AssumptionsV2>(
    key: K,
    value: AssumptionsV2[K],
  ) => onAssumptionsChange({ ...a, [key]: value });

  function setTotalExpenses(value: string) {
    const basis = totalExpenseDraft?.basis ?? s.expenses;
    if (fieldError(value, "monthlyExpenses")) {
      onTotalExpenseChange({ value, expenses: s.expenses, basis });
      return;
    }
    const total = Number(value);
    const previous = monthlyExpenses({ ...s, expenses: basis });
    const useExistingSplit = previous > 0 &&
      categoryKeys.every((key) => !fieldError(basis[key], "monthlyExpenses"));
    const next = { ...s.expenses };
    let allocated = 0;
    categoryKeys.forEach((key, i) => {
      const share = useExistingSplit ? Number(basis[key]) / previous : 1 / categoryKeys.length;
      const remaining = Math.max(0, total - allocated);
      const amount =
        i === categoryKeys.length - 1
          ? remaining
          : Math.min(remaining, Math.floor(total * share * 100) / 100);
      next[key] = decimalAmount.format(amount);
      allocated += amount;
    });
    onTotalExpenseChange({ value, expenses: next, basis });
  }

  const formRef = useRef<HTMLDivElement>(null);
  const [allExpanded, setAllExpanded] = useState(false);
  useEffect(() => {
    formRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details.advanced-accordion")
      .forEach((section) => {
        const summary = section.querySelector(":scope > summary");
        if (summary)
          summary.toggleAttribute(
            "data-has-errors",
            !!section.querySelector('[aria-invalid="true"], .error'),
          );
      });
  });

  const toggleAllSections = () => {
    if (!formRef.current) return;
    const accordions = formRef.current.querySelectorAll<HTMLDetailsElement>(
      "details.advanced-accordion",
    );
    const anyClosed = Array.from(accordions).some((d) => !d.open);
    accordions.forEach((d) => {
      d.open = anyClosed;
    });
    setAllExpanded(anyClosed);
  };

  return (
    <div className="scenario-form" ref={formRef}>
      {showName && (
        <div className="field">
          <label htmlFor="scenario-name">Scenario name</label>
          <Input
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
      )}

      <h2 className="input-section-title">Offer</h2>
      {/* Core 4 Inputs */}
      <div className="essential-fields">
        <Field
          label="Annual base salary"
          unit="$ / year"
          value={s.base}
          onChange={(base) => set("base", base)}
          error={errors.base}
        />
        {!startup && (
          <Field
            label="Annual stock / RSUs"
            unit="$ / year"
            value={s.stock}
            onChange={(stock) => {
              const annualVal = Number(stock) || 0;
              const updatedGrants =
                s.grants &&
                s.grants.length === 1 &&
                s.grants[0].employmentId === "initial" &&
                s.grants[0].presetCompensation === "tech-quick"
                  ? [{ ...s.grants[0], value: String(annualVal * 4) }]
                  : s.grants;
              onChange({
                ...s,
                stock,
                includeStock: annualVal > 0 ? true : s.includeStock,
                grants: updatedGrants,
              });
            }}
            error={errors.stock}
          />
        )}
      </div>

      {hasSignOn || showSignOn ? (
        <div className="two-cols">
          <Field
            label="Year 1 sign-on bonus"
            unit="$"
            value={s.signOnY1 ?? "0"}
            onChange={(signOnY1) => set("signOnY1", signOnY1)}
            error={errors.signOnY1}
          />
          <Field
            label="Year 2 sign-on bonus"
            unit="$"
            value={s.signOnY2 ?? "0"}
            onChange={(signOnY2) => set("signOnY2", signOnY2)}
            error={errors.signOnY2}
          />
        </div>
      ) : (
        <div className="sign-on-toggle-row">
          <Button variant="text" size={null}
            type="button"
            className="link-btn sign-on-btn"
            onClick={() => setShowSignOn(true)}
          >
            + Add sign-on bonus
          </Button>
        </div>
      )}

      <div className="two-cols">
        <Field
          label="Yearly bonus"
          unit="$ / year"
          value={s.bonus}
          onChange={(bonus) => set("bonus", bonus)}
          error={errors.bonus}
        />
        <div>
          <Field
            label="Annual salary growth"
            unit="%"
            value={s.growth}
            onChange={(growth) => set("growth", growth)}
            error={errors.growth}
          />
        </div>
      </div>
      {startupFields}
      {!startup && (
        <details className="preset-section">
          <summary>
            Company presets <span className="optional">Optional</span>
          </summary>
          <TechEstimatorHero
            allowInitialPreset={allowInitialPreset}
            scenario={s}
            assumptions={a}
            onScenarioChange={onChange}
            onAssumptionsChange={onAssumptionsChange}
          />
        </details>
      )}

      <h2 className="input-section-title">Living costs</h2>
      <div className="essential-fields">
        <Field
          label="Monthly living expenses"
          unit="$ / month"
          value={expenseValue}
          onChange={setTotalExpenses}
          error={
            expenseDraftError ||
            errors.expenses ||
            (invalidCategory
              ? "Check the expense breakdown below."
              : undefined)
          }
        />
        <div data-shared-input>
          <Field
            label="Current invested savings"
            unit="$"
            value={a.starting}
            onChange={(starting) => shared("starting", starting)}
            error={errors.starting}
          />
        </div>
      </div>

      <div className="projection-length-row">
        <div data-shared-input>
          <Field
            label="Projection length"
            unit="years"
            value={a.years}
            onChange={(years) => shared("years", years)}
            error={errors.years}
            integer
          />
        </div>
        <div className="quick-chip-row" role="group" aria-label="Quick horizon">
          {["5", "10", "15", "20", "30"].map((y) => (
            <button
              key={y}
              type="button"
              className={`chip-btn ${a.years === y ? "active" : ""}`}
              onClick={() => shared("years", y)}
              title={`${y}-year projection`}
            >
              {y}y
            </button>
          ))}
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <p className="error advanced-error">
          Check highlighted fields in the sections below.
        </p>
      )}
      {/* 1-Click Expand/Collapse All Accordions */}
      <div className="accordion-toggle-bar">
        <Button variant="text" size={null}
          type="button"
          className="text-button small-text accordion-toggle-btn"
          onClick={toggleAllSections}
        >
          {allExpanded ? "Collapse all sections" : "Expand all sections"}
        </Button>
      </div>

      {/* Progressive Accordion 1: Living costs */}
      <details className="advanced-accordion">
        <summary>
          Living costs{" "}
          <span className="optional">Categories & location budgets</span>
          <span className="section-error">Check inputs</span>
        </summary>
        <div className="details-body">
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
            <Button variant="secondary" size={null}
              type="button"
              className="secondary small"
              disabled={!location}
              onClick={() => {
                if (location) {
                  onChange({ ...s, ...applyLocation(s, location) });
                }
              }}
            >
              Apply budget
            </Button>
          </div>
          <AutoDetails hasErrors={invalidCategory}>
            <summary>Expense category breakdown</summary>
            <div className="details-body">
              {categoryKeys.map((k) => (
                <Field
                  key={k}
                  label={categoryLabels[k]}
                  value={s.expenses[k]}
                  onChange={(v) => set("expenses", { ...s.expenses, [k]: v })}
                  error={errors[k]}
                />
              ))}
            </div>
          </AutoDetails>
        </div>
      </details>

      {/* Progressive Accordion 2: Retirement & Benefits */}
      <details className="advanced-accordion">
        <summary>
          Retirement & benefits{" "}
          <span className="optional">401(k), Match, HSA, Health</span>
          <span className="section-error">Check inputs</span>
        </summary>
        <div className="details-body">
          {/* 1-Click 401(k) Match Preset Bar */}
          <div className="quick-match-row">
            <span className="quick-match-label">401(k) match:</span>
            <div
              className="pill-selector"
              role="group"
              aria-label="401(k) employer match presets"
            >
              <button
                type="button"
                className={`pill-btn ${s.employerMatch.type === "none" || (s.employerMatch.type === "simple" && Number(s.employerMatch.rate) === 0) ? "active" : ""}`}
                onClick={() =>
                  set("employerMatch", {
                    type: "none",
                    rate: "0",
                    payPercent: "0",
                    cap: "0",
                    tiers: [],
                    vestingType: "immediate",
                    vestingSchedule: ["100"],
                  })
                }
              >
                None (0%)
              </button>
              <button
                type="button"
                className={`pill-btn ${s.employerMatch.type === "simple" && s.employerMatch.rate === "50" && s.employerMatch.payPercent === "6" && (!s.employerMatch.cap || s.employerMatch.cap === "0") ? "active" : ""}`}
                onClick={() =>
                  set("employerMatch", {
                    type: "simple",
                    rate: "50",
                    payPercent: "6",
                    cap: "0",
                    tiers: [],
                    vestingType: "immediate",
                    vestingSchedule: ["100"],
                  })
                }
              >
                50% up to 6%
              </button>
              <button
                type="button"
                className={`pill-btn ${s.employerMatch.type === "simple" && s.employerMatch.rate === "100" && s.employerMatch.payPercent === "4" ? "active" : ""}`}
                onClick={() =>
                  set("employerMatch", {
                    type: "simple",
                    rate: "100",
                    payPercent: "4",
                    cap: "0",
                    tiers: [],
                    vestingType: "immediate",
                    vestingSchedule: ["100"],
                  })
                }
              >
                100% up to 4%
              </button>
              <button
                type="button"
                className={`pill-btn ${s.employerMatch.type === "simple" && s.employerMatch.rate === "100" && s.employerMatch.payPercent === "6" ? "active" : ""}`}
                onClick={() =>
                  set("employerMatch", {
                    type: "simple",
                    rate: "100",
                    payPercent: "6",
                    cap: "0",
                    tiers: [],
                    vestingType: "immediate",
                    vestingSchedule: ["100"],
                  })
                }
              >
                100% up to 6%
              </button>
            </div>
          </div>

          <QuickRetirementPresets
            scenario={s}
            assumptions={a}
            onScenarioChange={onChange}
          />
          <BenefitsEditor
            s={s}
            a={a}
            onChange={onChange}
            canEstimateSavings={!expenseDraftError && Object.keys(errors).length === 0}
          />
          <RetirementGuide />
        </div>
      </details>

      {/* Progressive Accordion 3: Taxes */}
      <details className="advanced-accordion">
        <summary>
          Taxes{" "}
          <span className="optional">
            Filing status, standard/itemized, state
          </span>
          <span className="section-error">Check inputs</span>
        </summary>
        <div className="details-body">
          <TaxEditor s={s} a={a} onChange={onChange} />
        </div>
      </details>

      {/* Progressive Accordion 4: Equity Grants & Schedules */}
      <details className="advanced-accordion">
        <summary>
          Equity{" "}
          <span className="optional">Vesting, refreshers, hold vs sell</span>
          <span className="section-error">Check inputs</span>
        </summary>
        <div className="details-body">
          <div id="starting-employer-shares">
            <EquityEditor s={s} a={a} onChange={onChange} />
          </div>
        </div>
      </details>

      {/* Progressive Accordion 5: Career changes */}
      <details className="advanced-accordion">
        <summary>
          Career changes{" "}
          <span className="optional">Promotions, employer changes</span>
          <span className="section-error">Check inputs</span>
        </summary>
        <div className="details-body">
          <CareerEditor s={s} a={a} onChange={onChange} />
        </div>
      </details>

    </div>
  );
}
