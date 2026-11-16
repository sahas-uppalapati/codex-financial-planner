import { useState } from "react";
import type { AssumptionsV2, Grant, ScenarioV2 } from "../../lib/planner";
import {
  displayMonth,
  plannerScenarioErrors,
  scheduleError,
} from "../../lib/planner";
import { templateSchedule, vestingTemplates } from "../../data/vesting";
import {
  AutoDetails,
  ErrorList,
  NumberField,
  SelectField,
  TextField,
  Toggle,
} from "../EditorFields";
import { EmploymentField, TemplateField, TreatmentField } from "./EquityFields";

export function GrantCard({
  s,
  a,
  g,
  index,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  g: Grant;
  index: number;
  onChange: (s: ScenarioV2) => void;
}) {
  const [template, setTemplate] = useState(
      g.template === "custom" ? "annual" : g.template,
    ),
    [rowsOpen, setRowsOpen] = useState(false);
  const errors = plannerScenarioErrors(s, a),
    prefix = `grants.${index}`;
  const patch = (values: Partial<Grant>) =>
    onChange({
      ...s,
      grants: s.grants.map((x) => (x.id === g.id ? { ...g, ...values } : x)),
    });
  const preview = vestingTemplates.find((t) => t.id === template)!;
  const years = Array.from(
    {
      length: Math.ceil(
        Math.max(...preview.schedule.map((r) => Number(r.month))) / 12,
      ),
    },
    (_, y) =>
      preview.schedule
        .filter(
          (r) => Number(r.month) > y * 12 && Number(r.month) <= (y + 1) * 12,
        )
        .reduce((n, r) => n + Number(r.percent), 0),
  );
  return (
    <AutoDetails
      className="nested-editor"
      hasErrors={
        Object.keys(errors).some((k) => k.startsWith(prefix)) || undefined
      }
    >
      <summary>
        <span className="truncate">{g.name || "Untitled grant"}</span>
        <span className="optional">{displayMonth(g.month)}</span>
      </summary>
      <div className="details-body">
        <TextField
          label="Grant name"
          value={g.name}
          onChange={(name) => patch({ name })}
          error={errors[`${prefix}.name`]}
        />
        <EmploymentField
          s={s}
          a={a}
          value={g.employmentId}
          onChange={(employmentId, issuerId) =>
            patch({ employmentId, issuerId })
          }
        />
        <TextField
          label="Grant / vesting start month"
          type="month"
          value={g.month}
          onChange={(month) => patch({ month })}
          error={errors[`${prefix}.month`]}
        />
        <SelectField
          label="Grant amount entered as"
          value={g.units}
          onChange={(units) => patch({ units: units as Grant["units"] })}
        >
          <option value="dollars">Total grant value in dollars</option>
          <option value="shares">Explicit total share count</option>
        </SelectField>
        <NumberField
          label={
            g.units === "dollars" ? "Total grant value" : "Total grant shares"
          }
          unit={g.units === "dollars" ? "USD" : "shares"}
          value={g.value}
          onChange={(value) => patch({ value })}
          error={errors[`${prefix}.value`]}
        />
        {g.units === "dollars" && (
          <>
            <SelectField
              label="Grant-date price source"
              value={g.priceMode}
              onChange={(priceMode) =>
                patch({ priceMode: priceMode as Grant["priceMode"] })
              }
            >
              <option value="modeled">Modeled price at grant month</option>
              <option value="explicit">
                Enter actual grant-date share price
              </option>
            </SelectField>
            {(g.priceMode === "explicit" || errors[`${prefix}.grantPrice`]) && (
              <NumberField
                label="Actual grant-date share price"
                unit="USD / share"
                min={0.000001}
                max={1000000}
                value={g.grantPrice}
                onChange={(grantPrice) =>
                  patch({ grantPrice, priceMode: "explicit" })
                }
                error={errors[`${prefix}.grantPrice`]}
              />
            )}
          </>
        )}
        <TreatmentField
          value={g.treatment}
          onChange={(treatment) => patch({ treatment })}
        />
        <Toggle
          label="Keep this grant vesting after leaving its employment"
          checked={g.keepOnDeparture}
          onChange={(keepOnDeparture) => patch({ keepOnDeparture })}
        />
        <details className="template-preview">
          <summary>Choose and preview a schedule</summary>
          <div className="details-body">
            <TemplateField value={template} onChange={setTemplate} />
            <p className="preset-preview">
              {years
                .map(
                  (weight, y) => `Year ${y + 1}: ${Number(weight.toFixed(2))}%`,
                )
                .join(" · ")}
            </p>
            <p className="hint">
              {preview.note}{" "}
              <a href={preview.source} target="_blank" rel="noreferrer">
                Source ↗
              </a>{" "}
              · accessed Oct 27, 2026
            </p>
            <button
              className="secondary small"
              type="button"
              onClick={() =>
                patch({ template, schedule: templateSchedule(template) })
              }
            >
              Apply schedule
            </button>
          </div>
        </details>
        <p className={scheduleError(g.schedule) ? "error" : "hint"}>
          {scheduleError(g.schedule) ||
            `${g.schedule.length} vesting events · ${g.schedule.reduce((sum, r) => sum + Number(r.percent), 0).toFixed(2)}% total`}
        </p>
        <p className="hint">
          Month 1 vests at the end of the grant month; month 12 at the end of
          its 12th month. Historical vests are not added to starting holdings.
        </p>
        <button
          className="text-button small-text"
          type="button"
          aria-expanded={rowsOpen}
          onClick={() => setRowsOpen(!rowsOpen)}
        >
          {rowsOpen ? "Hide" : "Edit"} custom vesting rows
        </button>
        {rowsOpen && (
          <div className="schedule-rows">
            {g.schedule.map((r, idx) => (
              <div className="schedule-row" key={idx}>
                <NumberField
                  label={`Vesting row ${idx + 1} month offset`}
                  unit="months"
                  min={1}
                  max={120}
                  integer
                  value={r.month}
                  onChange={(month) =>
                    patch({
                      template: "custom",
                      schedule: g.schedule.map((old, j) =>
                        j === idx ? { ...old, month } : old,
                      ),
                    })
                  }
                />
                <NumberField
                  label={`Vesting row ${idx + 1} percentage`}
                  unit="%"
                  max={100}
                  value={r.percent}
                  onChange={(percent) =>
                    patch({
                      template: "custom",
                      schedule: g.schedule.map((old, j) =>
                        j === idx ? { ...old, percent } : old,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Remove vesting row ${idx + 1}`}
                  onClick={() =>
                    patch({
                      template: "custom",
                      schedule: g.schedule.filter((_, j) => j !== idx),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="secondary small"
              type="button"
              onClick={() =>
                patch({
                  template: "custom",
                  schedule: [
                    ...g.schedule,
                    {
                      month: String(
                        Math.min(
                          120,
                          Math.max(
                            0,
                            ...g.schedule.map((r) => Number(r.month) || 0),
                          ) + 1,
                        ),
                      ),
                      percent: "0",
                    },
                  ],
                })
              }
            >
              + Add vesting row
            </button>
          </div>
        )}
        <ErrorList errors={errors} prefix={prefix} />
        <button
          className="text-button remove-button"
          type="button"
          onClick={() =>
            onChange({ ...s, grants: s.grants.filter((x) => x.id !== g.id) })
          }
        >
          Remove grant
        </button>
      </div>
    </AutoDetails>
  );
}
