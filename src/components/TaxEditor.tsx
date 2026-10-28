import type {
  AssumptionsV2,
  Benefits,
  ScenarioV2,
  TaxProfile,
} from "../lib/planner";
import { plannerScenarioErrors, taxLocations } from "../lib/planner";
import { taxSources } from "../data/taxRules";
import { money } from "../lib/format";
import {
  AutoDetails,
  ErrorList,
  NumberField,
  SelectField,
  Toggle,
} from "./EditorFields";
export function TaxEditor({
  s,
  a,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  onChange: (s: ScenarioV2) => void;
}) {
  const errors = plannerScenarioErrors(s, a),
    t = s.taxProfile;
  const set = <K extends keyof TaxProfile>(k: K, v: TaxProfile[K]) =>
    onChange({ ...s, taxProfile: { ...t, [k]: v } });
  return (
    <AutoDetails
      className="advanced-section"
      hasErrors={
        Object.keys(errors).some((k) => k.startsWith("taxProfile")) || undefined
      }
    >
      <summary>
        Taxes{" "}
        <span className="optional">
          {t.mode === "manual"
            ? "Manual estimate"
            : `${taxLocations.find((l) => l.id === t.location)?.label} · Calculated`}
        </span>
      </summary>
      <div className="details-body">
        <SelectField
          label="Tax calculation"
          value={t.mode}
          onChange={(v) => set("mode", v as TaxProfile["mode"])}
        >
          <option value="calculated">Calculated annual tax liability</option>
          <option value="manual">Manual effective rate</option>
        </SelectField>
        <SelectField
          label="Tax residence and work location"
          value={t.location}
          onChange={(v) => set("location", v as TaxProfile["location"])}
          hint="Full-year resident and work in this same city throughout the projection. This does not change your budget."
        >
          {taxLocations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Filing status"
          value={t.filing}
          onChange={(v) => set("filing", v as TaxProfile["filing"])}
        >
          <option value="single">Single</option>
          <option value="joint">
            Married filing jointly · household results
          </option>
        </SelectField>
        {t.filing === "joint" && (
          <>
            <NumberField
              label="Spouse annual cash wages"
              value={t.spouseWages}
              onChange={(v) => set("spouseWages", v)}
              error={errors["taxProfile.spouseWages"]}
            />
            <NumberField
              label="Spouse annual wage growth"
              unit="%"
              min={-100}
              max={20}
              value={t.spouseGrowth}
              onChange={(v) => set("spouseGrowth", v)}
            />
            <p className="hint">
              Spouse wages, taxes, benefits and savings are included in
              household results. Spouse wages are paid evenly each month.
            </p>
          </>
        )}
        {t.mode === "manual" ? (
          <NumberField
            label="Effective tax rate"
            value={s.tax}
            unit="%"
            max={100}
            onChange={(tax) => onChange({ ...s, tax })}
            hint="Total assumed tax rate on compensation after pretax benefits. No additional bracket/payroll tax is added in manual mode."
          />
        ) : (
          <>
            <p className="hint">
              2026 published rules projected forward. Includes federal,
              state/local, payroll and applicable employee premiums. Standard
              deductions; under age 50; no dependents. Planning liability, not
              paycheck withholding or tax filing.
            </p>
            <Toggle
              label="Employee pays statutory leave/disability premiums"
              checked={t.employeePremiums}
              onChange={(v) => set("employeePremiums", v)}
              hint="Turn off if your employer covers the employee share. WA Cares is controlled separately."
            />
            {t.location === "seattle" && (
              <Toggle
                label="Exempt from WA Cares"
                checked={t.waCaresExempt}
                onChange={(v) => set("waCaresExempt", v)}
              />
            )}{" "}
            {t.location === "new-york" && (
              <Toggle
                label="Employer deducts optional NY disability premium"
                checked={t.nyDisability}
                onChange={(v) => set("nyDisability", v)}
                hint="Up to $0.60/week; employers are not required to deduct it."
              />
            )}
          </>
        )}
        <details>
          <summary>Annual tax adjustments</summary>
          <div className="details-body">
            <p className="hint">
              Signed dollars: positive adds tax; negative reduces it. These are
              final liability adjustments, not deductions from income. Each
              component is floored at zero; refundable credit payouts are not
              modeled.
            </p>
            {(
              [
                "federalAdjustment",
                "stateAdjustment",
                "localAdjustment",
              ] as const
            ).map((k, i) => (
              <NumberField
                key={k}
                label={`${["Federal", "State", "Local"][i]} annual tax adjustment`}
                value={t[k]}
                min={-1000000}
                max={1000000}
                onChange={(v) => set(k, v)}
              />
            ))}
          </div>
        </details>
        <details>
          <summary>Tax rule sources and coverage</summary>
          <div className="details-body prose">
            <p>
              Snapshot accessed October 27, 2026. Future values project 2026
              law, not enacted future laws. CA personal-credit phaseout starts
              are derived from the announced 3.4% indexing pending the complete
              2026 booklet. NY/NYC use continuous schedules rather than $50
              tax-table intervals. Family/earned-income credits, itemized
              deductions, refunds above liability, and investment-income taxes
              are excluded.
            </p>
            <ul className="source-list">
              {taxSources.map((source) => (
                <li key={source.label}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.label} ↗
                  </a>
                  <small>{source.note}</small>
                </li>
              ))}
            </ul>
          </div>
        </details>
        <ErrorList errors={errors} prefix="taxProfile" />
      </div>
    </AutoDetails>
  );
}
function BenefitFields({
  s,
  who,
  onChange,
  errors,
}: {
  s: ScenarioV2;
  who: "benefits" | "spouseBenefits";
  onChange: (s: ScenarioV2) => void;
  errors: Record<string, string>;
}) {
  const prefix = who === "benefits" ? "Your" : "Spouse";
  const set = (k: keyof Benefits, v: string) =>
    onChange({ ...s, [who]: { ...s[who], [k]: v } });
  return (
    <fieldset className="benefits-group">
      <legend>{prefix} payroll benefits</legend>
      <NumberField
        label={`${prefix} annual pretax health premiums`}
        value={s[who].health}
        onChange={(v) => set("health", v)}
        error={errors[`${who}.health`]}
      />
      <NumberField
        label={`${prefix} annual payroll HSA contribution`}
        value={s[who].hsa}
        onChange={(v) => set("hsa", v)}
        error={errors[`${who}.hsa`]}
      />
    </fieldset>
  );
}
export function BenefitsEditor({
  s,
  a,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  onChange: (s: ScenarioV2) => void;
}) {
  const errors = plannerScenarioErrors(s, a);
  const setMatch = (key: "rate" | "payPercent" | "cap", value: string) =>
    onChange({ ...s, employerMatch: { ...s.employerMatch, [key]: value } });
  const employeeRate = Number(s.retirementTargets.primary.workplace401k.mode === "percent"
    ? s.retirementTargets.primary.workplace401k.amount
    : Number(s.base) > 0 ? Number(s.retirementTargets.primary.workplace401k.amount) / Number(s.base) * 100 : 0);
  const eligibleAnnualPay = Number(s.base);
  const maximumMatch = s.employerMatch.type === "simple"
    ? Math.min(100, Number(s.employerMatch.payPercent)) * Number(s.employerMatch.rate) / 100 * eligibleAnnualPay / 100
    : s.employerMatch.type === "tiered"
      ? s.employerMatch.tiers.reduce((total, tier) => total + Number(tier.payPercent) * Number(tier.rate) / 100 * eligibleAnnualPay / 100, 0)
      : 0;
  const estimatedMatch = s.employerMatch.type === "simple"
    ? Math.min(employeeRate, Number(s.employerMatch.payPercent)) * Number(s.employerMatch.rate) / 100 * eligibleAnnualPay / 100
    : s.employerMatch.type === "tiered"
      ? s.employerMatch.tiers.reduce((value, tier) => {
          const bandStart = s.employerMatch.tiers.slice(0, s.employerMatch.tiers.indexOf(tier)).reduce((sum, row) => sum + Number(row.payPercent), 0);
          const covered = Math.max(0, Math.min(employeeRate, bandStart + Number(tier.payPercent)) - bandStart);
          return value + covered * Number(tier.rate) / 100 * eligibleAnnualPay / 100;
        }, 0)
      : 0;
  const retirementTargets = (owner: "primary" | "spouse") => {
    const target = s.retirementTargets[owner];
    const profile = s.retirementProfiles[owner];
    const label = owner === "primary" ? "You" : "Spouse";
    const setTarget = (next: typeof target) => onChange({ ...s, retirementTargets: { ...s.retirementTargets, [owner]: next } });
    const setProfile = (next: typeof profile) => onChange({ ...s, retirementProfiles: { ...s.retirementProfiles, [owner]: next } });
    const annualPay = Number(owner === "primary" ? s.base : s.taxProfile.spouseWages);
    const annualEstimate = target.workplace401k.mode === "percent" ? annualPay * Number(target.workplace401k.amount) / 100 : Number(target.workplace401k.amount);
    return (
      <fieldset className="benefits-group" key={owner}>
        <legend>{label} workplace retirement</legend>
        <div className="two-cols">
          <SelectField label={`${label} 401(k) target type`} value={target.workplace401k.mode} onChange={(mode) => setTarget({ ...target, workplace401k: { ...target.workplace401k, mode: mode as "percent" | "dollars" } })}>
            <option value="percent">Percent of eligible pay</option><option value="dollars">Annual dollars</option>
          </SelectField>
          <NumberField label={`${label} annual 401(k) target`} unit={target.workplace401k.mode === "percent" ? "% of eligible pay" : "USD / year"} max={target.workplace401k.mode === "percent" ? 100 : 10000000} value={target.workplace401k.amount} onChange={(amount) => setTarget({ ...target, workplace401k: { ...target.workplace401k, amount } })} error={errors[`retirementTargets.${owner}.workplace401k.amount`]} />
        </div>
        <div className="two-cols">
          <NumberField label={`${label} traditional share`} unit="%" max={100} value={target.workplace401k.traditionalSharePercent} onChange={(traditionalSharePercent) => setTarget({ ...target, workplace401k: { ...target.workplace401k, traditionalSharePercent } })} />
          <NumberField label={`${label} Roth 401(k) share`} unit="%" max={100} value={target.workplace401k.rothSharePercent} onChange={(rothSharePercent) => setTarget({ ...target, workplace401k: { ...target.workplace401k, rothSharePercent } })} />
        </div>
        <p className="hint">Estimated target: {money(annualEstimate)} per year ({money(annualEstimate / 12)} per month), before limits and available-pay caps. Traditional contributions generally lower current taxable income; Roth contributions are taxed now. Which fits depends on current and future tax rates.</p>
        {errors[`retirementTargets.${owner}.workplace401k.split`] && <p className="error">{errors[`retirementTargets.${owner}.workplace401k.split`]}</p>}
        <details>
          <summary>Age, eligibility & additional accounts <span className="optional">Optional</span></summary>
          <div className="details-body">
            <NumberField label={`${label} age at end of first projection year`} unit="years old" max={120} integer value={profile.ageAtFirstYearEnd} onChange={(ageAtFirstYearEnd) => setProfile({ ...profile, ageAtFirstYearEnd })} />
            <Toggle label={`Confirm ${label.toLowerCase()} age for age-based contribution limits`} checked={profile.ageConfirmed} onChange={(ageConfirmed) => setProfile({ ...profile, ageConfirmed })} />
            <SelectField label={`${label} plan allows catch-up contributions?`} value={String(profile.allowsCatchUp)} onChange={(value) => setProfile({ ...profile, allowsCatchUp: value === "unsure" ? "unsure" : value === "true" })}>
              <option value="unsure">Unsure · use regular limit</option><option value="true">Yes</option><option value="false">No</option>
            </SelectField>
            <SelectField label={`${label} covered by a workplace retirement plan?`} value={String(profile.workplacePlanCoverage)} onChange={(value) => setProfile({ ...profile, workplacePlanCoverage: value === "unsure" ? "unsure" : value === "true" })}>
              <option value="unsure">Unsure</option><option value="true">Yes</option><option value="false">No</option>
            </SelectField>
            <NumberField label={`${label} initial prior-year FICA wages from this employer`} value={profile.priorYearFicaWages} onChange={(priorYearFicaWages) => setProfile({ ...profile, priorYearFicaWages })} hint="Used for required Roth catch-up treatment when applicable. Do not enter wages from unrelated employers." />
            <SelectField label={`${label} Medicare enrollment month (optional)`} value={profile.medicareMonth} onChange={(medicareMonth) => setProfile({ ...profile, medicareMonth })}>
              <option value="">Not enrolled in Medicare</option>{Array.from({ length: 12 }, (_, i) => <option value={String(i + 1)} key={i + 1}>{new Date(2026, i, 1).toLocaleString("en-US", { month: "long" })}</option>)}
            </SelectField>
            <p className="hint">Eligibility estimates use modeled W-2 income and payroll deductions only. Other income, tax adjustments, and part-year HSA coverage are not modeled.</p>
            <div className="two-cols">
              {(["traditionalIra", "rothIra", "backdoorRoth", "megaBackdoor"] as const).map((key) => (
                <NumberField key={key} label={`${label} annual ${({ traditionalIra: "traditional IRA", rothIra: "Roth IRA", backdoorRoth: "backdoor Roth IRA", megaBackdoor: "mega backdoor Roth" })[key]} target`} value={target[key]} onChange={(value) => setTarget({ ...target, [key]: value })} />
              ))}
            </div>
            <Toggle label={`${label}: confirm backdoor Roth strategy and Form 8606 reporting`} checked={target.backdoorConfirmed} onChange={(backdoorConfirmed) => setTarget({ ...target, backdoorConfirmed })} />
            <Toggle label={`${label}: confirm aggregate traditional, rollover, SEP, and SIMPLE IRA balances are $0`} checked={target.iraBalanceZeroConfirmed} onChange={(iraBalanceZeroConfirmed) => setTarget({ ...target, iraBalanceZeroConfirmed })} />
            <Toggle label={`${label}: confirm plan supports after-tax workplace contributions and Roth conversion`} checked={target.megaBackdoorSupported} onChange={(megaBackdoorSupported) => setTarget({ ...target, megaBackdoorSupported })} />
            <SelectField label={`${label} mega backdoor conversion route`} value={target.megaBackdoorRoute} onChange={(megaBackdoorRoute) => setTarget({ ...target, megaBackdoorRoute: megaBackdoorRoute as typeof target.megaBackdoorRoute })}>
              <option value="none">Not configured</option><option value="in-plan">Immediate in-plan Roth 401(k)</option><option value="roth-ira">Immediate rollover to Roth IRA</option>
            </SelectField>
            <p className="hint">Backdoor Roth assumes an immediate conversion of new nondeductible contributions and requires $0 aggregate traditional, rollover, SEP, and SIMPLE IRA balances, including accounts outside this planner. Form 8606 reporting applies. Existing balances or delayed conversions are not modeled. Mega backdoor contributions require confirmed plan support and immediate conversion; no match is assumed.</p>
          </div>
        </details>
      </fieldset>
    );
  };
  return (
    <AutoDetails
      className="advanced-section"
      hasErrors={
        Object.keys(errors).some(
          (k) =>
            k.startsWith("benefits") ||
            k.startsWith("spouseBenefits") ||
            k.startsWith("employerMatch") ||
            k.startsWith("retirementTargets") ||
            k.startsWith("retirementProfiles"),
        ) || undefined
      }
    >
      <summary>
        Pretax benefits <span className="optional">401(k), health & HSA</span>
      </summary>
      <div className="details-body">
        <p className="hint">
          Payroll targets are limited by available pay and annual limits. Annual-dollar targets remain fixed; percentage targets follow modeled compensation.
        </p>
        {retirementTargets("primary")}
        {s.taxProfile.filing === "joint" && retirementTargets("spouse")}
        <fieldset className="benefits-group">
          <legend>Your employer match</legend>
          <SelectField
            label="Match formula"
            value={s.employerMatch.type}
            onChange={(value) => onChange({ ...s, employerMatch: { ...s.employerMatch, type: value as ScenarioV2["employerMatch"]["type"] } })}
            hint="Unsure adds no assumed match. Check your plan document for the exact formula."
          >
            <option value="unsure">Unsure · assume no match</option>
            <option value="none">No match</option>
            <option value="simple">Simple match</option>
            <option value="tiered">Tiered match</option>
          </SelectField>
          {s.employerMatch.type === "simple" && (
            <div className="two-cols">
              <NumberField label="Employer match rate" unit="% of your contribution" max={100} value={s.employerMatch.rate} onChange={(v) => setMatch("rate", v)} />
              <NumberField label="On the first percent of eligible pay" unit="%" max={100} value={s.employerMatch.payPercent} onChange={(v) => setMatch("payPercent", v)} />
            </div>
          )}
          {s.employerMatch.type === "tiered" && (
            <>
              {s.employerMatch.tiers.map((tier, index) => (
                <div className="two-cols" key={index}>
                  <NumberField label={`Tier ${index + 1}: match rate`} unit="% of your contribution" max={100} value={tier.rate} onChange={(v) => onChange({ ...s, employerMatch: { ...s.employerMatch, tiers: s.employerMatch.tiers.map((row, i) => i === index ? { ...row, rate: v } : row) } })} />
                  <NumberField label={`Tier ${index + 1}: next eligible pay`} unit="%" max={100} value={tier.payPercent} onChange={(v) => onChange({ ...s, employerMatch: { ...s.employerMatch, tiers: s.employerMatch.tiers.map((row, i) => i === index ? { ...row, payPercent: v } : row) } })} />
                </div>
              ))}
              <button type="button" className="secondary small" disabled={s.employerMatch.tiers.length >= 20} onClick={() => onChange({ ...s, employerMatch: { ...s.employerMatch, tiers: [...s.employerMatch.tiers, { rate: "50", payPercent: "1" }] } })}>Add match tier</button>
            </>
          )}
          <NumberField label="Optional annual employer match cap" value={s.employerMatch.cap} onChange={(v) => setMatch("cap", v)} hint="Enter 0 when there is no separate dollar cap. The cap applies to the whole formula." />
          <p className="hint">Example: at $100,000 eligible pay, a 50% match on the first 6% can add up to $3,000 when you contribute $6,000. Current model uses base salary and monthly matching at the initial employer; it does not model exact payroll dates, true-ups, catch-ups, or total annual-additions limits.</p>
          {s.employerMatch.type === "simple" || s.employerMatch.type === "tiered" ? <p className="hint">At your current target, estimated employer match is {money(Math.min(estimatedMatch, Number(s.employerMatch.cap) > 0 ? Number(s.employerMatch.cap) : Infinity))} per year; maximum under this formula is {money(Math.min(maximumMatch, Number(s.employerMatch.cap) > 0 ? Number(s.employerMatch.cap) : Infinity))}. Eligible pay uses base salary only.</p> : null}
          {errors.employerMatch && <p className="error">{errors.employerMatch}</p>}
        </fieldset>
        <SelectField
          label="HSA eligible coverage (full year)"
          value={s.taxProfile.hsaCoverage}
          onChange={(v) =>
            onChange({
              ...s,
              taxProfile: {
                ...s.taxProfile,
                hsaCoverage: v as TaxProfile["hsaCoverage"],
              },
            })
          }
        >
          <option value="none">Not eligible / no HSA</option>
          <option value="self">
            Self-only eligible coverage · per contributing worker
          </option>
          <option value="family">
            Family eligible coverage · shared limit
          </option>
        </SelectField>
        <BenefitFields
          s={s}
          who="benefits"
          onChange={onChange}
          errors={errors}
        />
        {s.taxProfile.filing === "joint" && (
          <BenefitFields
            s={s}
            who="spouseBenefits"
            onChange={onChange}
            errors={errors}
          />
        )}
        <p className="hint">
          Healthcare budgets include payroll premiums. The results subtract
          premiums already paid through payroll from budgeted healthcare once;
          they are never counted twice. California does not deduct HSA
          contributions for state income tax or SDI.
        </p>
        <ErrorList errors={errors} prefix="benefits" />
        <ErrorList errors={errors} prefix="spouseBenefits" />
      </div>
    </AutoDetails>
  );
}
