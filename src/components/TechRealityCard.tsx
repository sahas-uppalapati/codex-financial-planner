import type { ScenarioV2, AssumptionsV2 } from "../lib/planner";
import { computeTechReality, computeVestingSchedule } from "../lib/techComp";
import { money } from "../lib/format";

interface TechRealityCardProps {
  scenario: ScenarioV2;
  assumptions?: AssumptionsV2;
}

export function TechRealityCard({ scenario, assumptions: _assumptions }: TechRealityCardProps) {
  const base = Number(scenario.base) || 0;
  const annualRsu = Number(scenario.stock) || 0;
  const bonus = Number(scenario.bonus) || 0;
  const rent = Number(scenario.expenses.housing) || 0;
  const otherLivingExpenses = Object.entries(scenario.expenses).reduce(
    (sum, [k, v]) => (k !== "housing" ? sum + (Number(v) || 0) : sum),
    0,
  );

  const companyName = scenario.role?.includes("Meta")
    ? "meta"
    : scenario.role?.includes("Amazon")
      ? "amazon"
      : scenario.role?.includes("Apple")
        ? "apple"
        : scenario.role?.includes("Microsoft")
          ? "microsoft"
          : "google";

  const reality = computeTechReality({
    base,
    annualRsu,
    bonus,
    rent,
    otherLivingExpenses,
    locationId: scenario.taxProfile.location,
    filing: scenario.taxProfile.filing,
    companyId: companyName,
  });

  const primaryGrant = scenario.grants?.[0];
  const grantSchedule = primaryGrant?.schedule;
  const totalGrantValue = Number(primaryGrant?.value) || annualRsu * 4;
  const vestingYears = computeVestingSchedule(annualRsu, grantSchedule, totalGrantValue);

  const signOnY1 = Number(scenario.signOnY1) || 0;
  const signOnY2 = Number(scenario.signOnY2) || 0;
  const totalSignOn = signOnY1 + signOnY2;

  const rentPct = Math.round(reality.rentToTakeHomeRatio * 100);

  return (
    <details className="tech-breakdown-details" aria-label="Equity vesting and tech compensation details">
      <summary className="tech-breakdown-summary">
        <div className="summary-left">
          <span className="summary-title">Tech Details</span>
          <span className="summary-chips">
            {annualRsu > 0 && <span>4-Yr RSUs: {money(totalGrantValue)}</span>}
            {totalSignOn > 0 && (
              <>
                <span className="dot-sep">·</span>
                <span>Sign-on: {money(totalSignOn)}</span>
              </>
            )}
            <span className="dot-sep">·</span>
            <span>Rent: {rentPct}% of base</span>
            {reality.annualSurpriseTaxBill > 500 && (
              <>
                <span className="dot-sep">·</span>
                <span className="tax-gap-chip">Tax gap: ~{money(reality.annualSurpriseTaxBill)}</span>
              </>
            )}
          </span>
        </div>
      </summary>

      <div className="tech-breakdown-body">
        {/* 1. 4-Year Equity Vesting Schedule (condensed) */}
        {annualRsu > 0 && (
          <div className="condensed-vesting-section">
            <div className="condensed-section-header">
              <strong>4-Year Equity Vesting Schedule</strong>
              <span className="hint">Total Grant: {money(totalGrantValue)} over 48 months</span>
            </div>
            <div className="condensed-vesting-grid">
              {vestingYears.map((v) => {
                const yearSignOn = v.year === 1 ? signOnY1 : v.year === 2 ? signOnY2 : 0;
                return (
                  <div className="condensed-vesting-col" key={v.year}>
                    <span className="col-year">Year {v.year}</span>
                    <strong className="col-value">{money(v.value)}</strong>
                    <span className="col-pct">{v.percent}%</span>
                    {yearSignOn > 0 && (
                      <span className="col-signon">+{money(yearSignOn)} sign-on</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Housing Affordability on Base Salary */}
        <div className="condensed-housing-section">
          <div className="housing-top-row">
            <span>
              <strong>Housing on Base Salary:</strong> Rent takes <strong>{rentPct}%</strong> of base take-home ({reality.housingSafetyTier})
            </span>
            {reality.annualEmployerMatch > 0 && (
              <span className="match-pill">401(k) Match: +{money(reality.annualEmployerMatch)}/yr</span>
            )}
          </div>
          <div className="safety-progress-track">
            <div
              className={`safety-progress-fill tier-${reality.housingSafetyTier.toLowerCase()}`}
              style={{ width: `${Math.min(100, Math.max(5, rentPct))}%` }}
            />
          </div>
          <p className="safety-desc">{reality.housingSafetyMessage}</p>
        </div>

        {/* 3. April Supplemental Underwithholding Check */}
        {reality.annualSurpriseTaxBill > 500 && (
          <div className="condensed-tax-alert">
            <div className="alert-top">
              <strong>April Tax Gap Check: Supplemental Underwithholding</strong>
            </div>
            <p>
              IRS supplemental RSU withholding is 22% federal (+state), but your estimated marginal bracket is ~{Math.round(reality.actualEffectiveTaxOnStock * 100)}%.
              Estimated tax gap: <strong>{money(reality.annualSurpriseTaxBill)}</strong> due at tax time.
            </p>
            <div className="alert-disclaimers">
              <h4>Planning Disclaimers & Assumptions</h4>
              <ul>
                <li>Planning estimates only; not a formal tax return or CPA counsel.</li>
                <li>Actual withholding varies by employer payroll elections and Form W-4 settings.</li>
                <li>Calculations use 2026 statutory tax brackets without future speculation.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
