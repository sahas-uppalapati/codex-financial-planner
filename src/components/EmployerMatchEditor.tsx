import type { EmployerMatch } from "../lib/planner";
import { NumberField, SelectField } from "./EditorFields";

export function EmployerMatchFields({
  match,
  prefix = "employerMatch",
  errors = {},
  onChange,
}: {
  match: EmployerMatch;
  prefix?: string;
  errors?: Record<string, string>;
  onChange: (m: EmployerMatch) => void;
  baseSalary?: number;
  employeeRate?: number;
  onApplyTarget?: (rate: number) => void;
  onMaximizeTarget?: () => void;
}) {
  const isTiered = match.type === "tiered";
  const hasCap = Number(match.cap) > 0;

  return (
    <div className="employer-match-fields">
      {!isTiered && (
        <div className="two-cols">
          <NumberField
            label="Employer match rate"
            unit="% of contribution"
            max={100}
            value={match.type === "none" || match.type === "unsure" ? "0" : match.rate}
            onChange={(v) => {
              const r = Number(v);
              onChange({
                ...match,
                type: r > 0 ? "simple" : match.type === "unsure" ? "unsure" : "none",
                rate: v,
              });
            }}
            error={errors[`${prefix}.rate`]}
          />
          <NumberField
            label="On first percent of pay"
            unit="% of pay"
            max={100}
            value={match.type === "none" || match.type === "unsure" ? "0" : match.payPercent}
            onChange={(v) =>
              onChange({
                ...match,
                type: "simple",
                payPercent: v,
              })
            }
            error={errors[`${prefix}.payPercent`]}
          />
        </div>
      )}

      <details
        className="match-advanced-details"
        open={isTiered || hasCap || match.type === "none" || match.type === "unsure" || undefined}
      >
        <summary>Advanced match options <span className="optional">Tiered, caps & formulas</span></summary>
        <div className="details-body">
          <SelectField
            label="Match formula"
            value={match.type || "simple"}
            onChange={(value) => {
              const nextType = value as EmployerMatch["type"];
              onChange({
                ...match,
                type: nextType,
                ...(nextType === "none" || nextType === "unsure"
                  ? { cap: "0" }
                  : {}),
              });
            }}
          >
            <option value="simple">Simple match</option>
            <option value="none">No match</option>
            <option value="tiered">Tiered match</option>
            <option value="unsure">Unsure · assume no match</option>
          </SelectField>

          {isTiered && (
            <>
              {match.tiers.map((tier, index) => (
                <div className="two-cols" key={index}>
                  <NumberField
                    label={`Tier ${index + 1}: match rate`}
                    unit="% of contribution"
                    max={100}
                    value={tier.rate}
                    onChange={(v) =>
                      onChange({
                        ...match,
                        tiers: match.tiers.map((row, i) =>
                          i === index ? { ...row, rate: v } : row,
                        ),
                      })
                    }
                    error={errors[`${prefix}.tiers.${index}.rate`]}
                  />
                  <NumberField
                    label={`Tier ${index + 1}: next eligible pay`}
                    unit="% of pay"
                    max={100}
                    value={tier.payPercent}
                    onChange={(v) =>
                      onChange({
                        ...match,
                        tiers: match.tiers.map((row, i) =>
                          i === index ? { ...row, payPercent: v } : row,
                        ),
                      })
                    }
                    error={errors[`${prefix}.tiers.${index}.payPercent`]}
                  />
                </div>
              ))}
              <div className="button-row">
                <button
                  type="button"
                  className="secondary small"
                  disabled={match.tiers.length >= 20}
                  onClick={() =>
                    onChange({
                      ...match,
                      tiers: [...match.tiers, { rate: "50", payPercent: "1" }],
                    })
                  }
                >
                  Add match tier
                </button>
                {match.tiers.length > 1 && (
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() =>
                      onChange({
                        ...match,
                        tiers: match.tiers.slice(0, -1),
                      })
                    }
                  >
                    Remove last tier
                  </button>
                )}
              </div>
            </>
          )}

          <NumberField
            label="Optional annual employer match cap"
            value={match.cap}
            onChange={(v) => onChange({ ...match, cap: v })}
            hint="Enter 0 when there is no dollar cap."
            error={errors[`${prefix}.cap`]}
          />
        </div>
      </details>

      {errors[prefix] && <p className="error">{errors[prefix]}</p>}
    </div>
  );
}
