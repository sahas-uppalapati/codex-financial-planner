import { useState } from "react";
import type { AssumptionsV2, CareerEvent, ScenarioV2 } from "../lib/planner";
import {
  displayMonth,
  monthIndex,
  monthLabel,
  plannerScenarioErrors,
  uid,
} from "../lib/planner";
import { compensationPresets } from "../data/presets";
import {
  AutoDetails,
  ErrorList,
  NumberField,
  SelectField,
  TextField,
} from "./EditorFields";
import { TemplateField, TreatmentField } from "./EquityEditor";
function EventCard({
  s,
  a,
  event: e,
  index,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  event: CareerEvent;
  index: number;
  onChange: (s: ScenarioV2) => void;
}) {
  const [preset, setPreset] = useState("");
  const errors = plannerScenarioErrors(s, a),
    prefix = `events.${index}`,
    year = Number(a.startYear);
  const patch = (values: Partial<CareerEvent>) =>
    onChange({
      ...s,
      events: s.events.map((x) => (x.id === e.id ? { ...e, ...values } : x)),
    });
  const offset = monthIndex(e.month, year),
    employer = s.issuers.find((i) => i.id === e.issuerId);
  return (
    <AutoDetails
      className="nested-editor"
      hasErrors={
        Object.keys(errors).some((k) => k.startsWith(prefix)) || undefined
      }
    >
      <summary>
        <span className="truncate">{e.role || "Next role"}</span>
        <span className="optional">{displayMonth(e.month)}</span>
      </summary>
      <div className="details-body">
        <SelectField
          label="Career event type"
          value={e.kind}
          onChange={(kind) => patch({ kind: kind as CareerEvent["kind"] })}
        >
          <option value="promotion">Promotion at current employer</option>
          <option value="job">Change employer / new employment</option>
        </SelectField>
        <SelectField
          label="Employer for this role"
          value={e.issuerId}
          onChange={(issuerId) => patch({ issuerId })}
          error={errors[`${prefix}.issuerId`]}
        >
          {s.issuers.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Role and company-specific level"
          value={e.role}
          onChange={(role) => patch({ role })}
        />
        <TextField
          label="Role starts in"
          type="month"
          value={e.month}
          onChange={(month) => patch({ month })}
          error={errors[`${prefix}.month`]}
        />
        <NumberField
          label="Months after projection starts"
          unit="months"
          value={Number.isFinite(offset) ? String(offset) : ""}
          integer
          max={Number(a.years) * 12 - 1}
          onChange={(v) =>
            patch({
              month:
                /^\d+$/.test(v) && Number(v) < Number(a.years) * 12
                  ? monthLabel(Number(v), year)
                  : "",
            })
          }
        />
        <p className="hint">
          {Number.isFinite(offset)
            ? `${Math.floor(offset / 12)} years and ${offset % 12} months after January ${a.startYear}. `
            : ""}
          Timing and pay are your expectations, not a promotion forecast.
        </p>
        <details>
          <summary>Use a reported compensation preset</summary>
          <div className="details-body">
            <SelectField
              label="Future role compensation preset"
              value={preset}
              onChange={setPreset}
            >
              <option value="">Choose verified company / level</option>
              {compensationPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company} · {p.level} · US average
                </option>
              ))}
            </SelectField>
            <button
              className="secondary small"
              type="button"
              disabled={!preset}
              onClick={() => {
                const p = compensationPresets.find((p) => p.id === preset);
                if (p)
                  patch({
                    base: String(p.base),
                    bonus: String(p.bonus),
                    role: `${p.company} ${p.level} · Software engineer`,
                  });
              }}
            >
              Apply role cash pay
            </button>
            <p className="hint">
              Fills base, bonus and role label only. A reported annual stock
              average cannot establish a new award’s size or vesting terms.
            </p>
          </div>
        </details>
        <NumberField
          label="Expected annual base at role start"
          value={e.base}
          onChange={(base) => patch({ base })}
        />
        <NumberField
          label="Expected annual recurring bonus"
          value={e.bonus}
          onChange={(bonus) => patch({ bonus })}
        />
        <NumberField
          label="Annual base growth in this role"
          unit="%"
          min={-100}
          max={20}
          value={e.growth}
          onChange={(growth) => patch({ growth })}
        />
        <p className="hint">
          Base changes at the beginning of this month, then on role
          anniversaries. Bonus targets accrue for active months and are paid in
          December.
        </p>
        <details>
          <summary>Promotion / new-hire equity award</summary>
          <div className="details-body">
            <NumberField
              label="New role total equity award"
              unit="USD / grant"
              value={e.awardValue}
              onChange={(awardValue) => patch({ awardValue })}
            />
            <TemplateField
              label="New role award vesting"
              value={e.awardTemplate}
              onChange={(awardTemplate) => patch({ awardTemplate })}
            />
            <TreatmentField
              value={e.awardTreatment}
              onChange={(awardTreatment) => patch({ awardTreatment })}
            />
            <p className="hint">
              A grant is awarded at the modeled price when this role begins. Set
              $0 for no award. For custom rows, instead add a standalone equity
              grant linked to this employment.
            </p>
          </div>
        </details>
        <details>
          <summary>This role’s future refresher policy</summary>
          <div className="details-body">
            <NumberField
              label="New role refresher value per award"
              unit="USD / grant"
              value={e.refresherValue}
              onChange={(refresherValue) => patch({ refresherValue })}
            />
            <NumberField
              label="First refresher after role starts"
              unit="months"
              value={e.refresherAfter}
              min={1}
              max={120}
              integer
              onChange={(refresherAfter) => patch({ refresherAfter })}
            />
            <NumberField
              label="Role refresher award frequency"
              unit="months"
              value={e.refresherEvery}
              min={1}
              max={120}
              integer
              onChange={(refresherEvery) => patch({ refresherEvery })}
            />
            <TemplateField
              label="Role refresher vesting"
              value={e.refresherTemplate}
              onChange={(refresherTemplate) => patch({ refresherTemplate })}
            />
            <TreatmentField
              value={e.refresherTreatment}
              onChange={(refresherTreatment) => patch({ refresherTreatment })}
            />
            <p className="hint">
              $0 means no new role-policy refreshers. This policy ends at the
              next career change. Already awarded grants continue on promotion;
              departure forfeits unvested awards unless retained individually in
              Equity grants.
            </p>
          </div>
        </details>
        {e.kind === "job" && (
          <p className="shortfall-note">
            Unvested awards linked to the departing employment are forfeited
            before this month’s vests unless explicitly retained. Previously
            vested {employer?.name ? "employer " : ""}shares remain owned.
          </p>
        )}
        <ErrorList errors={errors} prefix={prefix} />
        <button
          type="button"
          className="text-button remove-button"
          onClick={() =>
            onChange({ ...s, events: s.events.filter((x) => x.id !== e.id) })
          }
        >
          Remove career event
        </button>
      </div>
    </AutoDetails>
  );
}
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
          <EventCard
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
