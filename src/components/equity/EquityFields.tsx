import type { AssumptionsV2, SaleTreatment, ScenarioV2 } from "../../lib/planner";
import { employmentPeriods } from "../../lib/equity";
import { vestingTemplates } from "../../data/vesting";
import { SelectField } from "../EditorFields";

export function TreatmentField({
  value,
  onChange,
  label = "Vested-share treatment",
}: {
  value: SaleTreatment;
  onChange: (v: SaleTreatment) => void;
  label?: string;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={(v) => onChange(v as SaleTreatment)}
    >
      <option value="sell">Sell at vest and invest proceeds</option>
      <option value="hold">Sell to cover taxes, hold remaining shares</option>
    </SelectField>
  );
}

export function TemplateField({
  value,
  onChange,
  label = "Vesting template",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <SelectField label={label} value={value} onChange={onChange}>
      {value === "custom" && <option value="custom">Custom schedule</option>}
      {vestingTemplates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </SelectField>
  );
}

export function EmploymentField({
  s,
  a,
  value,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  value: string;
  onChange: (id: string, issuerId: string) => void;
}) {
  const periods = employmentPeriods(
    s,
    Number(a.startYear),
    Number(a.years) * 12,
  );
  return (
    <SelectField
      label="Employment linked to award"
      value={value}
      onChange={(v) => {
        const p = periods.find((item) => item.id === v);
        if (p) onChange(p.id, p.issuerId);
      }}
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {s.issuers.find((i) => i.id === p.issuerId)?.name} · {p.label}
        </option>
      ))}
    </SelectField>
  );
}
