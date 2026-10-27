import type {
  AssumptionsV2,
  Benefits,
  ScenarioV2,
  TaxProfile,
} from "../lib/planner";
import { plannerScenarioErrors, taxLocations } from "../lib/planner";
import { taxSources } from "../data/taxRules";
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
        label={`${prefix} annual traditional 401(k)`}
        value={s[who].retirement}
        onChange={(v) => set("retirement", v)}
        error={errors[`${who}.retirement`]}
      />
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
  return (
    <AutoDetails
      className="advanced-section"
      hasErrors={
        Object.keys(errors).some(
          (k) => k.startsWith("benefits") || k.startsWith("spouseBenefits"),
        ) || undefined
      }
    >
      <summary>
        Pretax benefits <span className="optional">401(k), health & HSA</span>
      </summary>
      <div className="details-body">
        <p className="hint">
          Annual targets, spread monthly and capped at cash pay and contribution
          limits across all employers. 401(k) and HSA assets are tracked
          separately. No employer match, catch-up contributions, withdrawals or
          reimbursements are modeled.
        </p>
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
