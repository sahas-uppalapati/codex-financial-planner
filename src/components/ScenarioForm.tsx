import { QuickRetirementPresets } from "./QuickRetirementPresets";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState, useEffect, useRef } from "react";
import type { Category } from "../lib/model";
import type { ScenarioV2 as Scenario, AssumptionsV2 } from "../lib/planner";
import {
  plannerScenarioErrors,
  plannerSharedErrors,
  uid,
} from "../lib/planner";
import { AutoDetails, NumberField, SelectField } from "./EditorFields";
import { TaxEditor, BenefitsEditor } from "./TaxEditor";
import { EquityEditor } from "./EquityEditor";
import { CareerEditor } from "./CareerEditor";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import { applyLocation, locationPresets } from "../data/presets";
import { Field } from "./Field";
import { TechEstimatorHero } from "./TechEstimatorHero";
import { retirementAccountLabels } from "../lib/retirement";
import type { RetirementAccountType } from "../lib/retirement";
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
  onAssumptionsChange,
  allowInitialPreset = false,
  showName = false,
  startup = false,
}: {
  scenario: Scenario;
  assumptions: AssumptionsV2;
  onChange: (s: Scenario) => void;
  onAssumptionsChange: (a: AssumptionsV2) => void;
  allowInitialPreset?: boolean;
  showName?: boolean;
  startup?: boolean;
}) {
  const [expenseDraft, setExpenseDraft] = useState(() =>
    categoryKeys.every((k) => !fieldError(s.expenses[k], "monthlyExpenses")) &&
    Number.isFinite(monthlyExpenses(s))
      ? String(monthlyExpenses(s))
      : "",
  );
  const [showSignOn, setShowSignOn] = useState(false);

  useEffect(() => {
    setExpenseDraft(String(monthlyExpenses(s)));
  }, [s.expenses]);

  const errors = {
    ...plannerScenarioErrors(s, a),
    ...plannerSharedErrors(a),
  };
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
    const total = Number(value);
    const previous = monthlyExpenses(s);
    const next = { ...s.expenses };
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

  const startingAccountTotal =
    Number(a.starting) +
    a.startingAccounts.reduce((sum, row) => sum + Number(row.balance), 0) +
    Number(a.startingRetirement) +
    Number(a.startingHsa) +
    Number(a.startingSpouseRetirement) +
    Number(a.startingSpouseHsa);

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

      {/* 1-Click Company & Role Preset Hero */}
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
      <h2 className="input-section-title">Living costs</h2>
      <div className="essential-fields">
        <Field
          label="Monthly living expenses"
          unit="$ / month"
          value={expenseDraft}
          onChange={setTotalExpenses}
          error={
            fieldError(expenseDraft, "monthlyExpenses") ||
            errors.expenses ||
            (categoryKeys.some((k) => errors[k])
              ? "Check the expense breakdown below."
              : undefined)
          }
        />
        <Field
          label="Current invested savings"
          unit="$"
          value={a.starting}
          onChange={(starting) => shared("starting", starting)}
          error={errors.starting}
        />
      </div>

      <div className="projection-length-row">
        <Field
          label="Projection length"
          unit="years"
          value={a.years}
          onChange={(years) => shared("years", years)}
          error={errors.years}
          integer
        />
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
                  setExpenseDraft(
                    String(
                      monthlyExpenses({ ...s, expenses: location.expenses }),
                    ),
                  );
                }
              }}
            >
              Apply budget
            </Button>
          </div>
          <AutoDetails hasErrors={categoryKeys.some((k) => !!errors[k])}>
            <summary>Expense category breakdown</summary>
            <div className="details-body">
              {categoryKeys.map((k) => (
                <Field
                  key={k}
                  label={categoryLabels[k]}
                  value={s.expenses[k]}
                  onChange={(v) => setCategory(k, v)}
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
          <BenefitsEditor s={s} a={a} onChange={onChange} />
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

      {/* Progressive Accordion 6: Starting Accounts & Assumptions */}
      <details className="advanced-accordion">
        <summary>
          Starting balances & assumptions{" "}
          <span className="optional">
            Past 401(k) balances, return %, inflation
          </span>
          <span className="section-error">Check inputs</span>
        </summary>
        <div className="details-body">
          <h3>Starting balances</h3>
          <p className="hint">
            Shared by both scenarios. Taxable investments are entered above.
          </p>
          {a.startingAccounts.length > 0 && (
            <div className="metric-row starting-total">
              <span>
                Starting assets <small>Taxable + retirement accounts</small>
              </span>
              <strong>
                {Number.isFinite(startingAccountTotal)
                  ? money(startingAccountTotal)
                  : "Check balances"}
              </strong>
            </div>
          )}
          {a.startingAccounts.map((account, index) => (
            <div className="starting-account-row" key={account.id}>
              <SelectField
                label={`Account ${index + 1} type`}
                value={account.type}
                onChange={(value) =>
                  onAssumptionsChange({
                    ...a,
                    startingAccounts: a.startingAccounts.map((row) =>
                      row.id === account.id
                        ? { ...row, type: value as RetirementAccountType }
                        : row,
                    ),
                  })
                }
              >
                {(
                  Object.entries(retirementAccountLabels) as [
                    RetirementAccountType,
                    string,
                  ][]
                ).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label={`Account ${index + 1} owner`}
                value={account.owner}
                onChange={(value) =>
                  onAssumptionsChange({
                    ...a,
                    startingAccounts: a.startingAccounts.map((row) =>
                      row.id === account.id
                        ? { ...row, owner: value as "primary" | "spouse" }
                        : row,
                    ),
                  })
                }
              >
                <option value="primary">You</option>
                <option value="spouse">Spouse</option>
              </SelectField>
              <Field
                label={`${account.owner === "spouse" ? "Spouse" : "Your"} ${retirementAccountLabels[account.type]} balance`}
                value={account.balance}
                onChange={(value) =>
                  onAssumptionsChange({
                    ...a,
                    startingAccounts: a.startingAccounts.map((row) =>
                      row.id === account.id ? { ...row, balance: value } : row,
                    ),
                  })
                }
                error={errors[`startingAccounts.${index}.balance`]}
              />
              <Button variant="text" size={null}
                type="button"
                className="text-button small-text"
                aria-label={`Remove ${retirementAccountLabels[account.type]} starting balance`}
                onClick={() =>
                  onAssumptionsChange({
                    ...a,
                    startingAccounts: a.startingAccounts.filter(
                      (row) => row.id !== account.id,
                    ),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" size={null}
            type="button"
            className="secondary small"
            disabled={a.startingAccounts.length >= 40}
            onClick={() =>
              onAssumptionsChange({
                ...a,
                startingAccounts: [
                  ...a.startingAccounts,
                  {
                    id: uid(),
                    owner: "primary",
                    type: "traditional-401k",
                    balance: "0",
                  },
                ],
              })
            }
          >
            + Add retirement account balance
          </Button>
          {errors.startingAccounts && (
            <p className="error">{errors.startingAccounts}</p>
          )}

          <div className="economic-assumptions">
            <NumberField
              label="Projection start calendar year"
              unit="January 1"
              min={2026}
              max={2036}
              integer
              value={a.startYear}
              onChange={(v) => shared("startYear", v)}
            />
            <div className="two-cols">
              <div>
                <Field
                  label="Annual investment return"
                  unit="%"
                  value={a.returns}
                  onChange={(v) => shared("returns", v)}
                  error={errors.returns}
                />
                <div
                  className="quick-chip-row"
                  role="group"
                  aria-label="Investment return presets"
                >
                  {["5", "7", "8.5", "10", "12"].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`chip-btn ${a.returns === pct ? "active" : ""}`}
                      onClick={() => shared("returns", pct)}
                      title={`${pct}% annual return`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Field
                  label="Annual expense inflation"
                  unit="%"
                  value={a.inflation}
                  onChange={(v) => shared("inflation", v)}
                  error={errors.inflation}
                />
                <div
                  className="quick-chip-row"
                  role="group"
                  aria-label="Expense inflation presets"
                >
                  {["2", "2.5", "3", "4"].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      className={`chip-btn ${a.inflation === pct ? "active" : ""}`}
                      onClick={() => shared("inflation", pct)}
                      title={`${pct}% annual expense inflation`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <NumberField
              label="Annual tax-threshold inflation"
              unit="%"
              max={10}
              value={a.taxInflation}
              onChange={(v) => shared("taxInflation", v)}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
