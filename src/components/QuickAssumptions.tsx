import type { AssumptionsV2, ScenarioV2 } from "../lib/planner";
import { taxLocations } from "../lib/planner";
import { money } from "../lib/format";

const dollars = (value: string) => {
  const amount = Number(value);
  return value.trim() && Number.isFinite(amount) ? money(amount) : "Check input";
};

/** Describe the inputs actually used by the quick projection, including its overrides. */
export function QuickAssumptions({ scenario: s, assumptions: a }: {
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
}) {
  const location = taxLocations.find((item) => item.id === s.taxProfile.location)?.label ?? s.taxProfile.location;
  const target = s.retirementTargets.primary.workplace401k;
  // Quick mode uses grants if already selected, or when legacy stock is disabled.
  // Otherwise it uses the repeating annual stock amount.
  const hasGrants = (s.stockMode === "grants" || !s.includeStock) && s.grants.length > 0;
  const startingAccounts = a.startingAccounts.reduce((sum, account) => sum + Number(account.balance), 0)
    + Number(a.startingRetirement) + Number(a.startingHsa)
    + Number(a.startingSpouseRetirement) + Number(a.startingSpouseHsa);
  const startingShares = s.issuers.reduce((sum, issuer) => sum + Number(issuer.startingShares) * Number(issuer.price), 0);
  return (
    <details className="preset-section">
      <summary>View assumptions <span className="optional">How this estimate works</span></summary>
      <div className="details-body">
        <p className="hint">These are planning estimates, not guarantees. Changing the inputs or future conditions can change the result.</p>
        <dl>
          <dt><strong>Time and growth</strong></dt>
          <dd>The estimate begins January 2026 and runs for {a.years || "the chosen number of"} years. Starting salary is {dollars(s.base)}, with a recurring bonus of {dollars(s.bonus)} per year and sign-on payments of {dollars(s.signOnY1 ?? "0")} in year one and {dollars(s.signOnY2 ?? "0")} in year two. Base pay changes by {s.growth || "the entered rate"}% a year until a career change. Investments grow at {a.returns || "the entered rate"}% a year; living costs rise {a.inflation || "the entered rate"}% a year.</dd>
          <dt><strong>Taxes and household</strong></dt>
          <dd>{s.taxProfile.mode === "manual" ? `Uses the entered ${s.tax}% total effective tax rate.` : `Estimates taxes for ${location} using 2026 rules, with 2.5% annual growth for tax thresholds that are indexed.`} Filing status: {s.taxProfile.filing === "joint" ? `married filing jointly, including ${dollars(s.taxProfile.spouseWages)} of spouse wages with ${s.taxProfile.spouseGrowth}% annual growth` : "single"}. The estimate is not a complete tax return and does not predict later law changes.</dd>
          <dt><strong>Stock and career</strong></dt>
          <dd>{hasGrants ? `${s.grants.length} stock grant${s.grants.length === 1 ? " is" : "s are"} modeled using the entered vesting schedules and sell or hold choices.` : s.includeStock && Number(s.stock) > 0 ? `${dollars(s.stock)} per year in simplified stock is modeled as sold in December.` : "No starting grant or repeating stock amount is included; career changes may add stock awards."} {s.events.length ? `${s.events.length} career change${s.events.length === 1 ? " is" : "s are"} included in the forecast.` : "No promotions or job changes are included."} Recurring stock refreshers are omitted in Quick Estimate.</dd>
          {hasGrants && <dd>{s.grants.map((grant) => `${grant.name}: ${grant.treatment === "sell" ? "sell at vest" : "hold after estimated tax"}`).join("; ")}. Employer-share annual price changes: {s.issuers.map((issuer) => `${issuer.name}: ${issuer.appreciation}%`).join("; ")}.</dd>}
          {hasGrants && <dd>Grant timing and amounts: {s.grants.map((grant) => `${grant.name} starts ${grant.month}, ${grant.units === "dollars" ? dollars(grant.value) : `${grant.value} shares`}, ${grant.template} vesting`).join("; ")}. Detailed View shows each vesting date and percentage.</dd>}
          {s.events.length > 0 && <dd>{s.events.map((event) => `${event.month}: ${event.role || (event.kind === "job" ? "job change" : "promotion")}, ${dollars(event.base)} base pay`).join("; ")}.</dd>}
          <dt><strong>Retirement and starting savings</strong></dt>
          <dd>Starting taxable savings: {dollars(a.starting)}. Starting retirement and health-account balances, including a spouse's saved balances: {Number.isFinite(startingAccounts) ? money(startingAccounts) : "check inputs"}. Starting vested employer shares: {Number.isFinite(startingShares) ? money(startingShares) : "check inputs"}. Your 401(k) target is {target.mode === "percent" ? `${target.amount}% of pay` : `${dollars(target.amount)} per year`} ({target.traditionalSharePercent}% traditional and {target.rothSharePercent}% Roth); your HSA target is {dollars(s.benefits.hsa)} per year. Employer match: {s.employerMatch.type === "unsure" ? "unknown, so none is assumed" : s.employerMatch.type === "none" ? "none" : s.employerMatch.type === "simple" ? `${s.employerMatch.rate}% of contributions, up to ${s.employerMatch.payPercent}% of pay${Number(s.employerMatch.cap) > 0 ? ` and ${dollars(s.employerMatch.cap)} per year` : ""}` : `tiered: ${s.employerMatch.tiers.map((tier) => `${tier.rate}% match on ${tier.payPercent}% of pay`).join(", ")}`}. Actual contributions can be lower than targets.</dd>
          <dd>HSA eligibility: {s.taxProfile.hsaCoverage === "none" ? "not selected" : `${s.taxProfile.hsaCoverage} coverage`}. Annual IRA targets: {dollars(s.retirementTargets.primary.traditionalIra)} traditional, {dollars(s.retirementTargets.primary.rothIra)} Roth, and {dollars(s.retirementTargets.primary.backdoorRoth)} backdoor Roth. Mega backdoor target: {dollars(s.retirementTargets.primary.megaBackdoor)}. Eligibility and available cash can limit contributions.</dd>
        </dl>
        <p className="hint">Quick Estimate excludes detailed tax adjustments, payroll health premiums, spouse contributions and recurring equity refresher rules. Existing detailed settings are retained, and some are included again in Detailed View.</p>
      </div>
    </details>
  );
}
