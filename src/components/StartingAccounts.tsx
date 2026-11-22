import economicPresets from "../data/economicPresets.json";
import { Field } from "./Field";
import { NumberField, SelectField } from "./EditorFields";
import { Button } from "./ui/button";
import { plannerSharedErrors, uid, type AssumptionsV2 } from "../lib/planner";
import { retirementAccountLabels } from "../lib/retirement";
import type { RetirementAccountType } from "../lib/retirement";
import { money } from "../lib/format";

export function StartingAccounts({
  assumptions: a,
  onChange,
}: {
  assumptions: AssumptionsV2;
  onChange: (assumptions: AssumptionsV2) => void;
}) {
  const errors = plannerSharedErrors(a);
  const shared = <K extends keyof AssumptionsV2>(key: K, value: AssumptionsV2[K]) =>
    onChange({ ...a, [key]: value });
  const startingAccountTotal =
    Number(a.starting) +
    a.startingAccounts.reduce((sum, row) => sum + Number(row.balance), 0) +
    Number(a.startingRetirement) +
    Number(a.startingHsa) +
    Number(a.startingSpouseRetirement) +
    Number(a.startingSpouseHsa);

  return (
    <details className="advanced-accordion starting-accounts-section" id="shared-assumptions" tabIndex={-1}>
      <summary><h2>Starting balances &amp; assumptions</h2></summary>
      <div className="details-body">
        <h3>Starting balances</h3>
        <p className="hint">Shared by both scenarios. Taxable investments are entered above.</p>
        {a.startingAccounts.length > 0 && (
          <div className="metric-row starting-total">
            <span>Starting assets <small>Taxable + retirement accounts</small></span>
            <strong>{Number.isFinite(startingAccountTotal) ? money(startingAccountTotal) : "Check balances"}</strong>
          </div>
        )}
        {a.startingAccounts.map((account, index) => (
          <div className="starting-account-row" key={account.id}>
            <SelectField
              label={`Account ${index + 1} type`}
              value={account.type}
              onChange={(value) => onChange({ ...a, startingAccounts: a.startingAccounts.map((row) => row.id === account.id ? { ...row, type: value as RetirementAccountType } : row) })}
            >
              {(Object.entries(retirementAccountLabels) as [RetirementAccountType, string][]).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
            </SelectField>
            <SelectField
              label={`Account ${index + 1} owner`}
              value={account.owner}
              onChange={(value) => onChange({ ...a, startingAccounts: a.startingAccounts.map((row) => row.id === account.id ? { ...row, owner: value as "primary" | "spouse" } : row) })}
            >
              <option value="primary">You</option><option value="spouse">Spouse</option>
            </SelectField>
            <Field
              label={`${account.owner === "spouse" ? "Spouse" : "Your"} ${retirementAccountLabels[account.type]} balance`}
              value={account.balance}
              onChange={(balance) => onChange({ ...a, startingAccounts: a.startingAccounts.map((row) => row.id === account.id ? { ...row, balance } : row) })}
              error={errors[`startingAccounts.${index}.balance`]}
            />
            <Button variant="text" size={null} type="button" className="text-button small-text" aria-label={`Remove ${retirementAccountLabels[account.type]} starting balance`} onClick={() => onChange({ ...a, startingAccounts: a.startingAccounts.filter((row) => row.id !== account.id) })}>Remove</Button>
          </div>
        ))}
        <Button variant="secondary" size={null} type="button" className="secondary small" disabled={a.startingAccounts.length >= 40} onClick={() => onChange({ ...a, startingAccounts: [...a.startingAccounts, { id: uid(), owner: "primary", type: "traditional-401k", balance: "0" }] })}>+ Add retirement account balance</Button>
        {errors.startingAccounts && <p className="error">{errors.startingAccounts}</p>}
        <div className="economic-assumptions">
          <NumberField label="Projection start calendar year" unit="January 1" min={2026} max={2036} integer value={a.startYear} onChange={(v) => shared("startYear", v)} />
          <div className="two-cols">
            {(["returns", "inflation"] as const).map((field) => {
              const preset = economicPresets[field];
              return (
                <div key={field}>
                  <Field label={preset.label} unit="%" value={a[field]} onChange={(value) => shared(field, value)} error={errors[field]} />
                  <div className="quick-chip-row" role="group" aria-label={preset.groupLabel}>
                    {preset.values.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={a[field] === value ? "chip-btn active" : "chip-btn"}
                        aria-pressed={a[field] === value}
                        onClick={() => shared(field, value)}
                        title={value + '% ' + preset.description}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <NumberField label="Annual tax-threshold inflation" unit="%" max={10} value={a.taxInflation} onChange={(v) => shared("taxInflation", v)} />
        </div>
      </div>
    </details>
  );
}
