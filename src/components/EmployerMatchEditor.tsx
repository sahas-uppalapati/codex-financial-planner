import type { EmployerMatch, MatchVestingType } from "../lib/planner";
import {
  matchFormulaPresets,
  matchVestingPresets,
  requiredEmployeeRateForFullMatch,
} from "../lib/retirement";
import { money } from "../lib/format";
import { NumberField, SelectField } from "./EditorFields";

export function EmployerMatchFields({
  match,
  prefix = "employerMatch",
  errors = {},
  onChange,
  baseSalary,
  employeeRate,
  onApplyTarget,
  onMaximizeTarget,
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
  const eligiblePay = baseSalary ?? 0;
  const rate = employeeRate ?? 0;
  const fullMatchRate = requiredEmployeeRateForFullMatch(match);
  const cap = Number(match.cap) > 0 ? Number(match.cap) : Infinity;

  let maximumMatch = 0;
  if (match.type === "simple") {
    maximumMatch =
      ((Math.min(100, Number(match.payPercent)) * Number(match.rate)) / 100) *
      eligiblePay /
      100;
  } else if (match.type === "tiered") {
    maximumMatch = match.tiers.reduce(
      (total, tier) =>
        total +
        ((Number(tier.payPercent) * Number(tier.rate)) / 100) * eligiblePay / 100,
      0,
    );
  }
  maximumMatch = Math.min(maximumMatch, cap);

  let estimatedMatch = 0;
  if (match.type === "simple") {
    estimatedMatch =
      ((Math.min(rate, Number(match.payPercent)) * Number(match.rate)) / 100) *
      eligiblePay /
      100;
  } else if (match.type === "tiered") {
    let bandStart = 0;
    for (const tier of match.tiers) {
      const bandEnd = bandStart + Number(tier.payPercent);
      const covered = Math.max(0, Math.min(rate, bandEnd) - bandStart);
      estimatedMatch += ((covered * Number(tier.rate)) / 100) * eligiblePay / 100;
      bandStart = bandEnd;
    }
  }
  estimatedMatch = Math.min(estimatedMatch, cap);

  const uncapturedMatch = Math.max(0, maximumMatch - estimatedMatch);
  const annualEmployeeTarget = (eligiblePay * rate) / 100;

  return (
    <div className="employer-match-fields">
      <div className="match-preset-group">
        <span className="small-text muted">Quick match formula presets:</span>
        <div className="match-preset-buttons">
          {matchFormulaPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="match-preset-button"
              onClick={() => {
                if (preset.type === "simple") {
                  onChange({
                    ...match,
                    type: "simple",
                    rate: preset.rate,
                    payPercent: preset.payPercent,
                    cap: preset.cap,
                  });
                } else {
                  onChange({
                    ...match,
                    type: "tiered",
                    tiers: [...preset.tiers],
                    cap: preset.cap,
                  });
                }
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <SelectField
        label="Match formula"
        value={match.type}
        onChange={(value) =>
          onChange({
            ...match,
            type: value as EmployerMatch["type"],
          })
        }
        hint="Unsure adds no assumed match. Check your plan document or offer letter for details."
      >
        <option value="unsure">Unsure · assume no match</option>
        <option value="none">No match</option>
        <option value="simple">Simple match</option>
        <option value="tiered">Tiered match</option>
      </SelectField>

      {match.type === "simple" && (
        <div className="two-cols">
          <NumberField
            label="Employer match rate"
            unit="% of your contribution"
            max={100}
            value={match.rate}
            onChange={(v) => onChange({ ...match, rate: v })}
            error={errors[`${prefix}.rate`]}
          />
          <NumberField
            label="On the first percent of eligible pay"
            unit="%"
            max={100}
            value={match.payPercent}
            onChange={(v) => onChange({ ...match, payPercent: v })}
            error={errors[`${prefix}.payPercent`]}
          />
        </div>
      )}

      {match.type === "tiered" && (
        <>
          {match.tiers.map((tier, index) => (
            <div className="two-cols" key={index}>
              <NumberField
                label={`Tier ${index + 1}: match rate`}
                unit="% of your contribution"
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
                unit="%"
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
        hint="Enter 0 when there is no dollar cap. The cap applies to the total annual match."
        error={errors[`${prefix}.cap`]}
      />

      <SelectField
        label="Match vesting schedule"
        value={match.vestingType ?? "immediate"}
        onChange={(value) => {
          const vType = value as MatchVestingType;
          const preset = matchVestingPresets.find((p) => p.id === vType);
          onChange({
            ...match,
            vestingType: vType,
            vestingSchedule: preset ? [...preset.schedule] : match.vestingSchedule ?? ["100"],
          });
        }}
        hint="Employee contributions always vest 100% immediately by law. Employer match may vest over years of completed service."
      >
        {matchVestingPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </SelectField>

      {match.vestingType && match.vestingType !== "immediate" && (
        <div className="vesting-schedule-block">
          <p className="small-text muted">
            Vested percentage after completed years of service (unvested match forfeits on departure):
          </p>
          <div className="vesting-years-grid">
            {(match.vestingSchedule ?? ["100"]).map((pct, idx) => (
              <NumberField
                key={idx}
                label={`After Year ${idx + 1}`}
                unit="% vested"
                min={0}
                max={100}
                value={pct}
                onChange={(val) => {
                  const schedule = [...(match.vestingSchedule ?? ["100"])];
                  schedule[idx] = val;
                  onChange({
                    ...match,
                    vestingType: "custom",
                    vestingSchedule: schedule,
                  });
                }}
                error={errors[`${prefix}.vestingSchedule.${idx}`]}
              />
            ))}
          </div>
          <div className="button-row">
            <button
              type="button"
              className="secondary small"
              disabled={(match.vestingSchedule?.length ?? 1) >= 10}
              onClick={() => {
                const current = match.vestingSchedule ?? ["100"];
                const lastVal = current[current.length - 1] ?? "100";
                onChange({
                  ...match,
                  vestingType: "custom",
                  vestingSchedule: [...current, lastVal],
                });
              }}
            >
              Add year
            </button>
            {(match.vestingSchedule?.length ?? 1) > 1 && (
              <button
                type="button"
                className="secondary small"
                onClick={() => {
                  const current = match.vestingSchedule ?? ["100"];
                  onChange({
                    ...match,
                    vestingType: "custom",
                    vestingSchedule: current.slice(0, -1),
                  });
                }}
              >
                Remove year
              </button>
            )}
          </div>
        </div>
      )}

      {(onApplyTarget || onMaximizeTarget) && (match.type === "simple" || match.type === "tiered") && (
        <div className="match-actions-wrapper">
          <span className="small-text muted">Quick target actions:</span>
          <div className="match-action-buttons">
            {onApplyTarget && fullMatchRate > 0 && (
              <button
                type="button"
                className="match-action-button"
                onClick={() => onApplyTarget(fullMatchRate)}
              >
                Contribute enough for full match ({fullMatchRate.toFixed(1)}%)
              </button>
            )}
            {onMaximizeTarget && (
              <button
                type="button"
                className="match-action-button"
                onClick={onMaximizeTarget}
              >
                Maximize annual contributions ($24,500)
              </button>
            )}
          </div>
        </div>
      )}

      {baseSalary !== undefined && employeeRate !== undefined && (match.type === "simple" || match.type === "tiered") && (
        <div className="match-diagnostic-box">
          <div className="match-diagnostic-row">
            <span>Your 401(k) contribution</span>
            <strong>
              {rate.toFixed(1)}% of eligible pay ({money(annualEmployeeTarget)}/yr)
            </strong>
          </div>
          <div className="match-diagnostic-row">
            <span>Required for full employer match</span>
            <strong>{fullMatchRate.toFixed(1)}% of eligible pay</strong>
          </div>
          <div className="match-diagnostic-row">
            <span>Estimated annual employer match</span>
            <strong>
              {money(estimatedMatch)} / {money(maximumMatch)}
            </strong>
          </div>
          {uncapturedMatch > 0.5 ? (
            <div className="match-warning-banner" role="alert">
              <strong>Match left on the table: </strong>
              You are leaving <strong>{money(uncapturedMatch)}/year</strong> of employer match on the table.
              Increase your contribution to at least {fullMatchRate.toFixed(1)}% to capture the full match.
            </div>
          ) : maximumMatch > 0 ? (
            <div className="match-success-banner">
              <strong>Full match captured: </strong>
              You are contributing enough to receive 100% of the available employer match ({money(maximumMatch)}/yr).
            </div>
          ) : null}
        </div>
      )}

      {errors[prefix] && <p className="error">{errors[prefix]}</p>}
    </div>
  );
}
