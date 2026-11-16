import type { AssumptionsV2, CareerEvent, ScenarioV2 } from "../lib/planner";
import {
  monthIndex,
  monthLabel,
  plannerScenarioErrors,
  uid,
} from "../lib/planner";
import {
  AutoDetails,
  ErrorList,
  SelectField,
  TextField,
} from "./EditorFields";
import { CareerEventCard } from "./career/CareerEventCard";

export function CareerEditor({
  s,
  a,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  onChange: (s: ScenarioV2) => void;
}) {
  const errors = plannerScenarioErrors(s, a);
  const add = (kind: CareerEvent["kind"]) => {
    const year = Number(a.startYear),
      horizon = Number(a.years) * 12,
      existing = new Set(s.events.map((e) => monthIndex(e.month, year)));
    let month = Math.min(24, horizon - 1);
    while (existing.has(month) && month > 0) month--;
    const last = [...s.events]
      .filter((e) => monthIndex(e.month, year) <= month)
      .sort((x, y) => x.month.localeCompare(y.month))
      .at(-1);
    const issuerId = kind === "job" ? uid() : (last?.issuerId ?? s.employerId);
    const issuers =
      kind === "job"
        ? [
            ...s.issuers,
            {
              id: issuerId,
              name: "New employer",
              price: "100",
              appreciation: "0",
              startingShares: "0",
              startingBasis: "0",
            },
          ]
        : s.issuers;
    onChange({
      ...s,
      issuers,
      events: [
        ...s.events,
        {
          id: uid(),
          kind,
          month: monthLabel(month, year),
          issuerId,
          role: kind === "job" ? "New role" : "Next level",
          base: last?.base ?? s.base,
          bonus: last?.bonus ?? s.bonus,
          growth: last?.growth ?? s.growth,
          awardValue: "0",
          awardTemplate: "annual",
          awardTreatment: "sell",
          refresherValue: "0",
          refresherAfter: "12",
          refresherEvery: "12",
          refresherTemplate: "annual",
          refresherTreatment: "sell",
        },
      ],
    });
  };
  return (
    <AutoDetails
      className="advanced-section"
      hasErrors={
        Object.keys(errors).some(
          (k) => k.startsWith("events") || k === "role",
        ) || undefined
      }
    >
      <summary>
        Career progression{" "}
        <span className="optional">
          {s.events.length
            ? `${s.events.length} planned changes`
            : "Promotions & job changes"}
        </span>
      </summary>
      <div className="details-body">
        <SelectField
          label="Initial employer"
          value={s.employerId}
          onChange={(employerId) => onChange({ ...s, employerId })}
        >
          {s.issuers.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Initial role and level"
          value={s.role}
          onChange={(role) => onChange({ ...s, role })}
          error={errors.role}
        />
        <p className="hint">
          Build your own career path month by month. Tax location stays fixed;
          use the other scenario to compare a different city.
        </p>
        {s.events.map((e, index) => (
          <CareerEventCard
            key={e.id}
            s={s}
            a={a}
            event={e}
            index={index}
            onChange={onChange}
          />
        ))}
        <div className="button-row">
          <button
            type="button"
            className="secondary small"
            onClick={() => add("promotion")}
          >
            + Add promotion
          </button>
          <button
            type="button"
            className="secondary small"
            onClick={() => add("job")}
          >
            + Change employer
          </button>
        </div>
        <ErrorList errors={errors} prefix="events" />
      </div>
    </AutoDetails>
  );
}
