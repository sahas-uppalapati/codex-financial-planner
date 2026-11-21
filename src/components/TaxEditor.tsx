import type {
  AssumptionsV2,
  Benefits,
  ScenarioV2,
  TaxProfile,
} from "../lib/planner";
import { plannerScenarioErrors, taxLocations } from "../lib/planner";
import { taxSources } from "../data/taxRules";
import {
  ErrorList,
  NumberField,
  SelectField,
  Toggle,
} from "./EditorFields";
import { EmployerMatchFields } from "./EmployerMatchEditor";
import { RetirementStrategyAdvisor } from "./RetirementStrategyAdvisor";
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
    <div className="tax-editor-body">
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
      {s.taxProfile.hsaCoverage !== "none" && (
        <NumberField
          label={`${prefix} annual payroll HSA contribution`}
          value={s[who].hsa}
          onChange={(v) => set("hsa", v)}
          error={errors[`${who}.hsa`]}
        />
      )}
    </fieldset>
  );
}
export function BenefitsEditor({
  s,
  a,
  onChange,
  canEstimateSavings,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  onChange: (s: ScenarioV2) => void;
  canEstimateSavings: boolean;
}) {
  const errors = plannerScenarioErrors(s, a);
  const retirementTargets = (owner: "primary" | "spouse") => {
    const target = s.retirementTargets[owner];
    const profile = s.retirementProfiles[owner];
    const label = owner === "primary" ? "Your" : "Spouse's";
    const possessive = owner === "primary" ? "your" : "spouse's";
    const setTarget = (next: typeof target) => onChange({ ...s, retirementTargets: { ...s.retirementTargets, [owner]: next } });
    const setProfile = (next: typeof profile) => onChange({ ...s, retirementProfiles: { ...s.retirementProfiles, [owner]: next } });
    return (
      <fieldset className="benefits-group" key={owner}>
        <legend>{owner === "primary" ? "Your workplace retirement" : "Spouse workplace retirement"}</legend>
        <SelectField
          label={`${label} 401(k) target type`}
          value={target.workplace401k.mode}
          onChange={(mode) =>
            setTarget({
              ...target,
              workplace401k: {
                ...target.workplace401k,
                mode: mode as "percent" | "dollars",
              },
            })
          }
        >
          <option value="percent">Percent of eligible pay (%)</option>
          <option value="dollars">Annual dollars ($)</option>
        </SelectField>
        <NumberField
          label={`${label} annual 401(k) target`}
          unit={target.workplace401k.mode === "percent" ? "%" : "USD / yr"}
          max={target.workplace401k.mode === "percent" ? 100 : 10000000}
          value={target.workplace401k.amount}
          onChange={(amount) =>
            setTarget({
              ...target,
              workplace401k: { ...target.workplace401k, amount },
            })
          }
          error={errors[`retirementTargets.${owner}.workplace401k.amount`]}
        />
        <div className="two-cols">
          <NumberField label={`${label} traditional share`} unit="%" max={100} value={target.workplace401k.traditionalSharePercent} onChange={(traditionalSharePercent) => setTarget({ ...target, workplace401k: { ...target.workplace401k, traditionalSharePercent } })} />
          <NumberField label={`${label} Roth 401(k) share`} unit="%" max={100} value={target.workplace401k.rothSharePercent} onChange={(rothSharePercent) => setTarget({ ...target, workplace401k: { ...target.workplace401k, rothSharePercent } })} />
        </div>
        {errors[`retirementTargets.${owner}.workplace401k.split`] && <p className="error">{errors[`retirementTargets.${owner}.workplace401k.split`]}</p>}
        <details>
          <summary>Age, eligibility & additional accounts <span className="optional">Optional</span></summary>
          <div className="details-body">
            <NumberField label={`${label} age at end of first projection year`} unit="years old" max={120} integer value={profile.ageAtFirstYearEnd} onChange={(ageAtFirstYearEnd) => setProfile({ ...profile, ageAtFirstYearEnd })} />
            <Toggle label={`Confirm ${possessive} age for age-based contribution limits`} checked={profile.ageConfirmed} onChange={(ageConfirmed) => setProfile({ ...profile, ageConfirmed })} />
            <SelectField label={`${label} plan allows catch-up contributions?`} value={String(profile.allowsCatchUp)} onChange={(value) => setProfile({ ...profile, allowsCatchUp: value === "unsure" ? "unsure" : value === "true" })}>
              <option value="unsure">Unsure · use regular limit</option><option value="true">Yes</option><option value="false">No</option>
            </SelectField>
            <SelectField label={`${owner === "primary" ? "Are you" : "Is spouse"} covered by a workplace retirement plan?`} value={String(profile.workplacePlanCoverage)} onChange={(value) => setProfile({ ...profile, workplacePlanCoverage: value === "unsure" ? "unsure" : value === "true" })}>
              <option value="unsure">Unsure</option><option value="true">Yes</option><option value="false">No</option>
            </SelectField>
            <NumberField label={`${label} initial prior-year FICA wages from this employer`} value={profile.priorYearFicaWages} onChange={(priorYearFicaWages) => setProfile({ ...profile, priorYearFicaWages })} hint="Used for required Roth catch-up treatment when applicable. Do not enter wages from unrelated employers." />
            <SelectField label={`${label} Medicare enrollment month (optional)`} value={profile.medicareMonth} onChange={(medicareMonth) => setProfile({ ...profile, medicareMonth })}>
              <option value="">Not enrolled in Medicare</option>{Array.from({ length: 12 }, (_, i) => <option value={String(i + 1)} key={i + 1}>{new Date(2026, i, 1).toLocaleString("en-US", { month: "long" })}</option>)}
            </SelectField>
            <div className="two-cols">
              {(["traditionalIra", "rothIra", "backdoorRoth", "megaBackdoor"] as const).map((key) => (
                <NumberField key={key} label={`${label} annual ${({ traditionalIra: "traditional IRA", rothIra: "Roth IRA", backdoorRoth: "backdoor Roth IRA", megaBackdoor: "mega backdoor Roth" })[key]} target`} value={target[key]} onChange={(value) => setTarget({ ...target, [key]: value })} />
              ))}
            </div>
            <Toggle label={`${owner === "primary" ? "You" : "Spouse"}: confirm backdoor Roth strategy and Form 8606 reporting`} checked={target.backdoorConfirmed} onChange={(backdoorConfirmed) => setTarget({ ...target, backdoorConfirmed })} />
            <Toggle label={`${owner === "primary" ? "You" : "Spouse"}: confirm aggregate traditional, rollover, SEP, and SIMPLE IRA balances are $0`} checked={target.iraBalanceZeroConfirmed} onChange={(iraBalanceZeroConfirmed) => setTarget({ ...target, iraBalanceZeroConfirmed })} />
            <Toggle label={`${label} plan supports after-tax workplace contributions and Roth conversion`} checked={target.megaBackdoorSupported} onChange={(megaBackdoorSupported) => setTarget({ ...target, megaBackdoorSupported })} />
            <SelectField label={`${label} mega backdoor conversion route`} value={target.megaBackdoorRoute} onChange={(megaBackdoorRoute) => setTarget({ ...target, megaBackdoorRoute: megaBackdoorRoute as typeof target.megaBackdoorRoute })}>
              <option value="none">Not configured</option><option value="in-plan">Immediate in-plan Roth 401(k)</option><option value="roth-ira">Immediate rollover to Roth IRA</option>
            </SelectField>
          </div>
        </details>
      </fieldset>
    );
  };
  return (
    <div className="advanced-section">
      <div className="details-body">
        {canEstimateSavings
          ? <RetirementStrategyAdvisor s={s} a={a} onChange={onChange} />
          : <p className="hint">Correct invalid planner inputs to use the savings strategy.</p>}
        {retirementTargets("primary")}
        {s.taxProfile.filing === "joint" && retirementTargets("spouse")}
        <fieldset className="benefits-group">
          <legend>Your employer match</legend>
          <EmployerMatchFields
            match={s.employerMatch}
            prefix="employerMatch"
            errors={errors}
            onChange={(employerMatch) => onChange({ ...s, employerMatch })}
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
            employeeRate={s.retirementTargets.spouse.workplace401k.mode === "percent"
              ? Number(s.retirementTargets.spouse.workplace401k.amount)
              : Number(s.taxProfile.spouseWages) > 0
                ? Number(s.retirementTargets.spouse.workplace401k.amount) / Number(s.taxProfile.spouseWages) * 100 : 0}
          />
        </fieldset>}
        <SelectField
          label="HSA eligible coverage (full year)"
          value={s.taxProfile.hsaCoverage}
          onChange={(v) => {
            const nextCoverage = v as TaxProfile["hsaCoverage"];
            onChange({
              ...s,
              taxProfile: {
                ...s.taxProfile,
                hsaCoverage: nextCoverage,
              },
              ...(nextCoverage === "none"
                ? {
                    benefits: { ...s.benefits, hsa: "0" },
                    spouseBenefits: { ...s.spouseBenefits, hsa: "0" },
                  }
                : {}),
            });
          }}
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
        <ErrorList errors={errors} prefix="benefits" />
        <ErrorList errors={errors} prefix="spouseBenefits" />
      </div>
    </div>
  );
}
