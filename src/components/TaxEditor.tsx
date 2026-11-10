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
  annualAge,
  annualRetirementLimits,
  employeeDeferralLimit,
} from "../lib/retirement";
import {
  AutoDetails,
  ErrorList,
  NumberField,
  SelectField,
  Toggle,
} from "./EditorFields";
import { EmployerMatchFields } from "./EmployerMatchEditor";
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
              deductions without senior-specific provisions; no dependents.
              Age-based contribution catch-ups are estimated separately. Planning liability, not
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
  const employeeRate = Number(
    s.retirementTargets.primary.workplace401k.mode === "percent"
      ? s.retirementTargets.primary.workplace401k.amount
      : Number(s.base) > 0
        ? (Number(s.retirementTargets.primary.workplace401k.amount) / Number(s.base)) * 100
        : 0,
  );
  const eligibleAnnualPay = Number(s.base);
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
            <p className="hint">Medicare enrollment is assumed to begin in this month of the year you turn 65 and continue thereafter; if you are already over 65, it is assumed active from the start. Enrollment before 65 or after the year you turn 65 is not modeled. Eligibility estimates use modeled W-2 income and payroll deductions only. Other income, tax adjustments, and other part-year HSA coverage are not modeled.</p>
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
            k.startsWith("spouseEmployerMatch") ||
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
          <EmployerMatchFields
            match={s.employerMatch}
            prefix="employerMatch"
            errors={errors}
            onChange={(employerMatch) => onChange({ ...s, employerMatch })}
            baseSalary={eligibleAnnualPay}
            annualBasicDeferralLimit={annualRetirementLimits(Number(a.startYear), Number(a.taxInflation)).employeeDeferral}
            employeeRate={employeeRate}
            onApplyTarget={(requiredRate) => {
              const target = s.retirementTargets.primary;
              const nextAmount =
                target.workplace401k.mode === "percent"
                  ? String(requiredRate)
                  : String(Math.round((eligibleAnnualPay * requiredRate) / 100));
              onChange({
                ...s,
                retirementTargets: {
                  ...s.retirementTargets,
                  primary: {
                    ...target,
                    workplace401k: {
                      ...target.workplace401k,
                      amount: nextAmount,
                    },
                  },
                },
              });
            }}
            onMaximizeTarget={() => {
              const limits = annualRetirementLimits(
                Number(a.startYear),
                Number(a.taxInflation),
              );
              const age = annualAge(s.retirementProfiles.primary, 0);
              const maxCap = employeeDeferralLimit(
                limits,
                age,
                s.retirementProfiles.primary.allowsCatchUp === true,
              );
              const target = s.retirementTargets.primary;
              const nextAmount =
                target.workplace401k.mode === "percent"
                  ? eligibleAnnualPay > 0
                    ? Math.min(100, (maxCap / eligibleAnnualPay) * 100).toFixed(1)
                    : "100"
                  : String(maxCap);
              onChange({
                ...s,
                retirementTargets: {
                  ...s.retirementTargets,
                  primary: {
                    ...target,
                    workplace401k: {
                      ...target.workplace401k,
                      amount: nextAmount,
                    },
                  },
                },
              });
            }}
          />
        </fieldset>
        {s.taxProfile.filing === "joint" && <fieldset className="benefits-group">
          <legend>Spouse employer match</legend>
          <p className="hint">One spouse employer is modeled throughout the projection; spouse job changes and prior service are not modeled.</p>
          <EmployerMatchFields
            match={s.spouseEmployerMatch}
            prefix="spouseEmployerMatch"
            errors={errors}
            onChange={(spouseEmployerMatch) => onChange({ ...s, spouseEmployerMatch })}
            baseSalary={Number(s.taxProfile.spouseWages)}
            annualBasicDeferralLimit={annualRetirementLimits(Number(a.startYear), Number(a.taxInflation)).employeeDeferral}
            employeeRate={s.retirementTargets.spouse.workplace401k.mode === "percent"
              ? Number(s.retirementTargets.spouse.workplace401k.amount)
              : Number(s.taxProfile.spouseWages) > 0
                ? Number(s.retirementTargets.spouse.workplace401k.amount) / Number(s.taxProfile.spouseWages) * 100 : 0}
          />
        </fieldset>}
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
