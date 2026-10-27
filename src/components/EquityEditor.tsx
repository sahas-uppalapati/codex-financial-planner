import { useState } from "react";
import type {
  AssumptionsV2,
  Grant,
  RefresherRule,
  ScenarioV2,
  SaleTreatment,
} from "../lib/planner";
import {
  displayMonth,
  monthLabel,
  plannerScenarioErrors,
  scheduleError,
  uid,
} from "../lib/planner";
import { buildEquity, employmentPeriods } from "../lib/equity";
import { templateSchedule, vestingTemplates } from "../data/vesting";
import {
  AutoDetails,
  ErrorList,
  NumberField,
  SelectField,
  TextField,
  Toggle,
} from "./EditorFields";
import { money } from "../lib/format";
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
function EmploymentField({
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
        const p = periods.find((p) => p.id === v);
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
function GrantCard({
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
function RefresherCard({
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
export function EquityEditor({
  s,
  a,
  onChange,
}: {
  s: ScenarioV2;
  a: AssumptionsV2;
  onChange: (s: ScenarioV2) => void;
}) {
  const errors = plannerScenarioErrors(s, a),
    year = Number(a.startYear),
    horizon = Number(a.years) * 12;
  let generated: Grant[] = [];
  try {
    generated = buildEquity(s, a).grants.filter(
      (g) => !s.grants.some((original) => original.id === g.id),
    );
  } catch {
    /* Invalid drafts are explained by inline/result validation. */
  }
  const addGrant = (value = "0") =>
    onChange({
      ...s,
      stockMode: "grants",
      grants: [
        ...s.grants,
        {
          id: uid(),
          name: "New equity grant",
          issuerId: s.employerId,
          employmentId: "initial",
          month: monthLabel(0, year),
          units: "dollars",
          value,
          priceMode: "modeled",
          grantPrice: "100",
          template: "annual",
          schedule: templateSchedule("annual"),
          treatment: "sell",
          keepOnDeparture: false,
        },
      ],
    });
  const patchIssuer = (
    id: string,
    patch: Partial<ScenarioV2["issuers"][number]>,
  ) =>
    onChange({
      ...s,
      issuers: s.issuers.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  return (
    <AutoDetails
      className="advanced-section"
      hasErrors={
        Object.keys(errors).some(
          (k) =>
            k.startsWith("grants") ||
            k.startsWith("refreshers") ||
            k.startsWith("issuers"),
        ) || undefined
      }
    >
      <summary>
        Equity grants{" "}
        <span className="optional">
          {s.stockMode === "legacy"
            ? "Legacy annual stock"
            : `${s.grants.length} custom · sell or hold`}
        </span>
      </summary>
      <div className="details-body">
        <p className="hint">
          Model actual grants, vesting cliffs and overlapping refreshers.
          Unvested equity is future compensation, never an owned asset. Company
          templates are reported examples; your grant agreement controls.
        </p>
        {s.stockMode === "legacy" ? (
          <div className="legacy-panel">
            <p className="hint">
              Your saved annual stock amount has been retained without inventing
              a grant.
            </p>
            <NumberField
              label="Legacy annualized stock"
              unit="USD / year"
              value={s.stock}
              onChange={(stock) => onChange({ ...s, stock })}
            />
            <Toggle
              label="Include legacy annual stock (sold each December)"
              checked={s.includeStock}
              onChange={(includeStock) => onChange({ ...s, includeStock })}
            />
            <p className="preset-preview">
              Conversion preview: {money(Number(s.stock) * 4)} total award · 25%
              at months 12, 24, 36 and 48 · sold at vest. This four-year
              conversion is an assumption, not verified grant terms.
            </p>
            <button
              type="button"
              className="secondary small"
              onClick={() => addGrant(String(Number(s.stock) * 4))}
            >
              Replace legacy stock with this grant
            </button>
            <button
              type="button"
              className="text-button small-text"
              onClick={() => onChange({ ...s, stockMode: "grants" })}
            >
              Use grants with no converted award
            </button>
          </div>
        ) : (
          <>
            {s.grants.map((g, index) => (
              <GrantCard
                key={g.id}
                s={s}
                a={a}
                g={g}
                index={index}
                onChange={onChange}
              />
            ))}
            <button
              type="button"
              className="secondary small full-width"
              onClick={() => addGrant()}
            >
              + Add equity grant
            </button>
            <div className="section-label">
              <h3>Recurring refresher awards</h3>
              <span className="optional">None assumed</span>
            </div>
            {s.refreshers.map((r, index) => (
              <RefresherCard
                key={r.id}
                s={s}
                a={a}
                r={r}
                index={index}
                onChange={onChange}
              />
            ))}
            <button
              type="button"
              className="secondary small full-width"
              onClick={() =>
                onChange({
                  ...s,
                  refreshers: [
                    ...s.refreshers,
                    {
                      id: uid(),
                      name: "Annual refresher",
                      issuerId: s.employerId,
                      employmentId: "initial",
                      firstMonth: monthLabel(Math.min(12, horizon - 1), year),
                      lastMonth: monthLabel(horizon - 1, year),
                      every: "12",
                      value: "0",
                      template: "annual",
                      treatment: "sell",
                      untilNextRole: true,
                    },
                  ],
                })
              }
            >
              + Add refresher rule
            </button>
            {generated.length > 0 && (
              <details>
                <summary>
                  Generated awards & departure exceptions{" "}
                  <span className="optional">{generated.length}</span>
                </summary>
                <div className="details-body">
                  <p className="hint">
                    Each row is a separate award. Retain an individual grant
                    after departure only if your agreement permits it.
                  </p>
                  {generated.map((g) => (
                    <div className="generated-grant" key={g.id}>
                      <p>
                        {g.name} · {displayMonth(g.month)} ·{" "}
                        {money(Number(g.value))}
                      </p>
                      <Toggle
                        label={`Keep ${g.name} after leaving (${g.month})`}
                        checked={s.grantOverrides[g.id] ?? false}
                        onChange={(v) =>
                          onChange({
                            ...s,
                            grantOverrides: { ...s.grantOverrides, [g.id]: v },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        <details>
          <summary>Employer prices & starting shares</summary>
          <div className="details-body">
            <p className="hint">
              Prices are your assumptions, not live quotes. Default $100 is a
              modeling reference. Appreciation applies monthly; existing vested
              shares remain yours when you leave. Enter starting holdings
              separately from historical grants to avoid double-counting.
            </p>
            {s.issuers.map((issuer, index) => (
              <fieldset key={issuer.id} className="issuer-group">
                <legend>{issuer.name}</legend>
                <TextField
                  label={`Employer ${index + 1} name`}
                  value={issuer.name}
                  onChange={(name) => patchIssuer(issuer.id, { name })}
                />
                <NumberField
                  label={`${issuer.name} starting share price`}
                  unit="USD / share"
                  value={issuer.price}
                  min={0.01}
                  max={1000000}
                  onChange={(price) => patchIssuer(issuer.id, { price })}
                />
                <NumberField
                  label={`${issuer.name} annual share appreciation`}
                  unit="%"
                  value={issuer.appreciation}
                  min={-99.9}
                  max={100}
                  onChange={(appreciation) =>
                    patchIssuer(issuer.id, { appreciation })
                  }
                />
                <NumberField
                  label={`${issuer.name} starting vested shares`}
                  unit="shares"
                  value={issuer.startingShares}
                  max={1000000000}
                  onChange={(startingShares) =>
                    patchIssuer(issuer.id, { startingShares })
                  }
                />
                <NumberField
                  label={`${issuer.name} starting share cost basis`}
                  unit="USD total"
                  value={issuer.startingBasis}
                  max={1e12}
                  onChange={(startingBasis) =>
                    patchIssuer(issuer.id, { startingBasis })
                  }
                />
              </fieldset>
            ))}
            <button
              type="button"
              className="secondary small"
              onClick={() =>
                onChange({
                  ...s,
                  issuers: [
                    ...s.issuers,
                    {
                      id: uid(),
                      name: `Employer ${s.issuers.length + 1}`,
                      price: "100",
                      appreciation: "0",
                      startingShares: "0",
                      startingBasis: "0",
                    },
                  ],
                })
              }
            >
              + Add employer
            </button>
          </div>
        </details>
        <ErrorList errors={errors} prefix="grants" />
        <ErrorList errors={errors} prefix="refreshers" />
        <ErrorList errors={errors} prefix="issuers" />
      </div>
    </AutoDetails>
  );
}
