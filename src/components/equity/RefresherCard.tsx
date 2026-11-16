import type { AssumptionsV2, RefresherRule, ScenarioV2 } from "../../lib/planner";
import { plannerScenarioErrors } from "../../lib/planner";
import {
  AutoDetails,
  ErrorList,
  NumberField,
  TextField,
  Toggle,
} from "../EditorFields";
import { EmploymentField, TemplateField, TreatmentField } from "./EquityFields";

export function RefresherCard({
  s,
  a,
  r,
  index,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  r: RefresherRule;
  index: number;
  onChange: (s: ScenarioV2) => void;
}) {
  const patch = (values: Partial<RefresherRule>) =>
    onChange({
      ...s,
      refreshers: s.refreshers.map((x) =>
        x.id === r.id ? { ...r, ...values } : x,
      ),
    });
  const errors = plannerScenarioErrors(s, a),
    prefix = `refreshers.${index}`;
  return (
    <AutoDetails
      className="nested-editor"
      hasErrors={
        Object.keys(errors).some((k) => k.startsWith(prefix)) || undefined
      }
    >
      <summary>
        <span className="truncate">{r.name}</span>
        <span className="optional">Recurring awards</span>
      </summary>
      <div className="details-body">
        <TextField
          label="Refresher rule name"
          value={r.name}
          onChange={(name) => patch({ name })}
        />
        <EmploymentField
          s={s}
          a={a}
          value={r.employmentId}
          onChange={(employmentId, issuerId) =>
            patch({ employmentId, issuerId })
          }
        />
        <TextField
          label="First refresher award month"
          type="month"
          value={r.firstMonth}
          onChange={(firstMonth) => patch({ firstMonth })}
          error={errors[`${prefix}.firstMonth`]}
        />
        <TextField
          label="Last refresher award month"
          type="month"
          value={r.lastMonth}
          onChange={(lastMonth) => patch({ lastMonth })}
          error={errors[`${prefix}.lastMonth`]}
        />
        <NumberField
          label="Refresher award frequency"
          value={r.every}
          unit="months"
          min={1}
          max={120}
          integer
          onChange={(every) => patch({ every })}
        />
        <NumberField
          label="Total value of each refresher grant"
          unit="USD / grant"
          value={r.value}
          onChange={(value) => patch({ value })}
        />
        <TemplateField
          label="Refresher vesting template"
          value={r.template}
          onChange={(template) => patch({ template })}
        />
        <TreatmentField
          value={r.treatment}
          onChange={(treatment) => patch({ treatment })}
        />
        <Toggle
          label="Stop awards at the first role change in this employment"
          checked={r.untilNextRole}
          onChange={(untilNextRole) => patch({ untilNextRole })}
        />
        <p className="hint">
          Every award has its own full vesting schedule. Future awards stop at
          employer departure. Existing unvested awards are forfeited unless
          explicitly retained below.
        </p>
        <ErrorList errors={errors} prefix={prefix} />
        <button
          className="text-button remove-button"
          type="button"
          onClick={() =>
            onChange({
              ...s,
              refreshers: s.refreshers.filter((x) => x.id !== r.id),
            })
          }
        >
          Remove refresher rule
        </button>
      </div>
    </AutoDetails>
  );
}
