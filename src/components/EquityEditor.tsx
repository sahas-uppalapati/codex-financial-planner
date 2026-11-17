import type { AssumptionsV2, Grant, ScenarioV2 } from "../lib/planner";
import {
  displayMonth,
  monthLabel,
  plannerScenarioErrors,
  uid,
} from "../lib/planner";
import { buildEquity } from "../lib/equity";
import { templateSchedule } from "../data/vesting";
import {
  ErrorList,
  NumberField,
  TextField,
  Toggle,
} from "./EditorFields";
import { money } from "../lib/format";
import {
  TreatmentField,
  TemplateField,
  EmploymentField,
} from "./equity/EquityFields";
import { GrantCard } from "./equity/GrantCard";
import { RefresherCard } from "./equity/RefresherCard";

export { TreatmentField, TemplateField, EmploymentField };

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
    <div className="advanced-section">
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
    </div>
  );
}
