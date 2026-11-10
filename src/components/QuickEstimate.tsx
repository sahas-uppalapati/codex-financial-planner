import { useEffect, useState } from "react";
import type { AssumptionsV2, ScenarioV2 } from "../lib/planner";
import { categoryKeys, fieldError, monthlyExpenses } from "../lib/model";
import { taxLocations } from "../lib/planner";
import { Field } from "./Field";
import { SelectField } from "./EditorFields";
import { TechEstimatorHero, presetCompanyFor } from "./TechEstimatorHero";

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
  const [showSignOn, setShowSignOn] = useState(false);
  const hasSignOn = (Number(scenario.signOnY1) || 0) > 0 || (Number(scenario.signOnY2) || 0) > 0;
  const companyPreset = presetCompanyFor(scenario);
  const matchPolicy = companyPreset?.matchPolicy;
  const match = scenario.employerMatch;
  const matchDisclosure = !matchPolicy
    ? ""
    : matchPolicy.sourceStatus === "verified"
      ? match.type === "simple"
        ? `Published plan terms: ${matchPolicy.description} The projection uses the editable terms shown.`
        : match.type === "none"
          ? `You set this plan to no match. Published terms for ${companyPreset?.name} are shown below for reference.`
        : `Published plan terms: ${matchPolicy.description} The current estimate includes $0 match until those terms are selected.`
      : match.type === "simple"
        ? "The official company match formula was not verified; this estimate uses the terms you entered."
        : matchPolicy.description;
  const workplace401k = scenario.retirementTargets.primary.workplace401k;
  const typed401kBalances = assumptions.startingAccounts.filter(
    (account) => account.owner === "primary" &&
      (account.type === "traditional-401k" || account.type === "roth-401k"),
  );
  const typed401kTotal = typed401kBalances.reduce(
    (total, account) => total + (Number(account.balance) || 0),
    0,
  );
  const starting401kTotal = typed401kTotal + (Number(assumptions.startingRetirement) || 0);

  useEffect(() => {
    setExpenses(String(monthlyExpenses(scenario)));
  }, [scenario.expenses]);

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
        : Math.floor(
            total * (previous > 0
              ? Number(scenario.expenses[key]) / previous
              : 1 / categoryKeys.length) * 100,
          ) / 100;
      next[key] = String(amount);
      allocated += amount;
    });
    onScenarioChange({ ...scenario, expenses: next });
  }

  function updateStarting401k(value: string) {
    const requested = Number(value);
    if (!Number.isFinite(requested) || requested < 0 || typed401kBalances.length === 0) {
      onAssumptionsChange({ ...assumptions, startingRetirement: value });
      return;
    }
    if (starting401kTotal <= 0) {
      onAssumptionsChange({ ...assumptions, startingRetirement: value });
      return;
    }
    const ratio = requested / starting401kTotal;
    const typedIds = new Set(typed401kBalances.map((account) => account.id));
    onAssumptionsChange({
      ...assumptions,
      startingRetirement: String((Number(assumptions.startingRetirement) || 0) * ratio),
      startingAccounts: assumptions.startingAccounts.map((account) =>
        typedIds.has(account.id)
          ? { ...account, balance: String((Number(account.balance) || 0) * ratio) }
          : account,
      ),
    });
  }

  function updateMatchType(value: string) {
    if (value === "custom") {
      onScenarioChange({
        ...scenario,
        employerMatch: {
          ...match,
          type: "simple",
          rate: match.type === "simple" ? match.rate : "0",
          payPercent: match.type === "simple" ? match.payPercent : "0",
          cap: "0",
          capBasis: "fixed",
          tiers: [],
        },
      });
      return;
    }
    onScenarioChange({
      ...scenario,
      employerMatch: { ...match, type: value as "unsure" | "none", capBasis: "fixed" },
    });
  }

  function updateStock(stock: string) {
    const annualValue = Number(stock) || 0;
    onScenarioChange({
      ...scenario,
      stock,
      includeStock: annualValue > 0 ? true : scenario.includeStock,
      grants: scenario.grants.map((grant) => grant.presetCompensation
        ? { ...grant, value: String(annualValue * 4) }
        : grant),
    });
  }

  return (
    <div className="quick-estimate-form">
      <p className="hint">
        Quick estimate starts in 2026 and uses 2.5% tax-threshold inflation. It excludes detailed tax adjustments, payroll health premiums, spouse contributions, and recurring equity refresher rules. Open the detailed planner to include those settings; your saved inputs are retained.
      </p>
      <TechEstimatorHero
        scenario={scenario}
        startYear={assumptions.startYear}
        onScenarioChange={onScenarioChange}
      />
      <div className="two-cols">
        <SelectField
          label="Tax residence and work location"
          value={scenario.taxProfile.location}
          onChange={(location) => onScenarioChange({
            ...scenario,
            taxProfile: { ...scenario.taxProfile, location: location as ScenarioV2["taxProfile"]["location"] },
          })}
        >
          {taxLocations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
        </SelectField>
        <SelectField
          label="Tax filing status"
          value={scenario.taxProfile.filing}
          onChange={(filing) => onScenarioChange({
            ...scenario,
            taxProfile: { ...scenario.taxProfile, filing: filing as "single" | "joint" },
          })}
        >
          <option value="single">Single</option>
          <option value="joint">Married filing jointly</option>
        </SelectField>
      </div>
      <div className="two-cols">
        <Field
          label="Annual salary before tax"
          value={scenario.base}
          onChange={(base) => onScenarioChange({ ...scenario, base })}
          error={errors.base}
          hint="Annual base pay before taxes (USD / year)."
        />
        <Field
          label="Annual cash bonus"
          value={scenario.bonus}
          onChange={(bonus) => onScenarioChange({ ...scenario, bonus })}
          error={errors.bonus}
          hint="Recurring annual bonus before tax (USD / year)."
        />
      </div>
      <div className="two-cols">
        <Field
          label="Annual stock / RSUs"
          value={scenario.stock}
          onChange={updateStock}
          error={errors.stock}
          hint="Annual RSU vesting value (USD / year). Leave at zero if your offer has no stock."
        />
        <Field
          label="Monthly living costs"
          value={expenses}
          onChange={updateExpenses}
          error={errors.expenses || fieldError(expenses, "monthlyExpenses")}
          hint="Estimated monthly living costs for your household."
        />
      </div>
      {hasSignOn || showSignOn ? (
        <div className="two-cols">
          <Field
            label="Year 1 sign-on bonus"
            value={scenario.signOnY1 ?? "0"}
            onChange={(signOnY1) => onScenarioChange({ ...scenario, signOnY1 })}
            error={errors.signOnY1}
          />
          <Field
            label="Year 2 sign-on bonus"
            value={scenario.signOnY2 ?? "0"}
            onChange={(signOnY2) => onScenarioChange({ ...scenario, signOnY2 })}
            error={errors.signOnY2}
          />
        </div>
      ) : (
        <div className="sign-on-toggle-row">
          <button type="button" className="link-btn sign-on-btn" onClick={() => setShowSignOn(true)}>
            + Add sign-on bonus
          </button>
        </div>
      )}
      <div className="two-cols">
        <Field
          label="Current invested savings"
          value={assumptions.starting}
          onChange={(starting) => onAssumptionsChange({ ...assumptions, starting })}
          error={errors.starting}
          hint="Taxable investments and liquid savings (USD)."
        />
        <Field
          label="Years to project"
          unit="years"
          value={assumptions.years}
          onChange={(years) => onAssumptionsChange({ ...assumptions, years })}
          error={errors.years}
          integer
        />
      </div>
      <section className="quick-401k-panel" aria-labelledby="quick-401k-heading">
        <div className="section-label">
          <h3 id="quick-401k-heading">401(k) savings <span className="optional">Optional</span></h3>
        </div>
        <div className="two-cols">
          <Field
            label="Your contribution"
            unit="% of salary"
            value={workplace401k.amount}
            onChange={(amount) => onScenarioChange({
              ...scenario,
              retirementTargets: {
                ...scenario.retirementTargets,
                primary: {
                  ...scenario.retirementTargets.primary,
                  workplace401k: { ...workplace401k, mode: "percent", amount },
                },
              },
            })}
            error={errors["retirementTargets.primary.workplace401k.amount"]}
            hint="Traditional and Roth contributions share the annual 401(k) limit."
          />
          <Field
            label="Current 401(k) balance"
            value={String(starting401kTotal)}
            onChange={updateStarting401k}
            error={errors.startingRetirement}
            hint="Combined traditional and Roth 401(k) starting balances. Other account balances stay unchanged."
          />
        </div>
        <SelectField
          label="Employer match"
          value={match.type === "simple" || match.type === "tiered"
            ? "custom"
            : companyPreset && matchPolicy?.sourceStatus !== "verified" && match.type === "none"
              ? "unsure"
              : match.type}
          onChange={updateMatchType}
          hint="Not sure? Keep the conservative zero-match estimate until you check your plan."
        >
          <option value="unsure">Not sure yet — assume $0</option>
          <option value="none">My plan has no match</option>
          <option value="custom">Enter or edit my match</option>
        </SelectField>
        {match.type === "simple" && (
          match.capBasis === "half-basic-deferral-limit" ? (
            <p className="match-source-note">
              The match cap follows half of the annual basic deferral limit for the projection start year.
            </p>
          ) : (
            <div className="two-cols">
              <Field
                label="Match rate"
                unit="% of your contribution"
                value={match.rate}
                onChange={(rate) => onScenarioChange({ ...scenario, employerMatch: { ...match, rate } })}
                error={errors["employerMatch.rate"]}
              />
              <Field
                label="Match applies to first"
                unit="% of salary you contribute"
                value={match.payPercent}
                onChange={(payPercent) => onScenarioChange({ ...scenario, employerMatch: { ...match, payPercent } })}
                error={errors["employerMatch.payPercent"]}
              />
            </div>
          )
        )}
        {companyPreset && matchPolicy && (
          <p className="match-source-note">
            {matchDisclosure} {" "}
            <a href={matchPolicy.sourceUrl} target="_blank" rel="noreferrer">{matchPolicy.sourceTitle}</a>
            {matchPolicy.sourceYear ? ` · ${matchPolicy.sourceYear}` : ""} · checked {matchPolicy.verifiedOn}
          </p>
        )}
      </section>
    </div>
  );
}
