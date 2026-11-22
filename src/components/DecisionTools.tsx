import { useState } from "react";
import type { PlannerV2 } from "../lib/planner";
import type { Projection } from "../lib/projection";
import type { StartupInputs } from "../lib/startupComparison";
import { money } from "../lib/format";
import {
  decisionSummary,
  solveSalary,
} from "../lib/decisionTools";

export function DecisionTools({
  state,
  year,
  projections,
  startup,
  startupInput,
}: {
  state: PlannerV2;
  year: number;
  projections: Projection[];
  startup: number | null;
  startupInput: StartupInputs;
}) {
  const [salaryOffer, setSalaryOffer] = useState<number | null>(null);
  const [salaryResult, setSolution] = useState<{
    state: PlannerV2;
    year: number;
    offer: number;
    value: ReturnType<typeof solveSalary>;
  } | null>(null);
  const { values: baseline, breakEvenShare } = decisionSummary(
    projections,
    year,
    startup,
    startupInput,
  );
  const selected =
    salaryOffer ??
    (baseline.length === 2 && baseline[0].cash > baseline[1].cash ? 1 : 0);
  const solution =
    salaryResult?.state === state &&
    salaryResult.year === year &&
    salaryResult.offer === selected
      ? salaryResult.value
      : null;
  return (
    <>
      {baseline.length === 2 && (
        <section className="cash-panel prose decision-tools">
          <h3>Decision summary</h3>
          {baseline.map((r, i) => (
            <p key={i}>
              <strong>{state.scenarios[i].name}:</strong> {money(r.cash / 12)}{" "}
              monthly cash after costs; {money(r.stock / 12)} monthly sold-stock
              cash; {money(r.ending)} projected ending balance.
            </p>
          ))}
          {breakEvenShare !== null && (
            <p>
              Startup break-even common-share price:{" "}
              {breakEvenShare === 0
                ? "no equity payout needed to close the modeled compensation gap"
                : breakEvenShare.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
              .
            </p>
          )}
          <p>
            Difference (second minus first):{" "}
            {money((baseline[1].cash - baseline[0].cash) / 12)} monthly cash;{" "}
            {money(baseline[1].ending - baseline[0].ending)} ending balance.
          </p>
          <details>
            <summary>What contributes to these differences?</summary>
            <p>
              Pay, taxes, benefits, expenses, investment returns and career
              changes interact. Sold-stock cash is shown separately, net of
              attributed equity taxes; a tax shortfall can make it negative.
              These figures are not an additive reconciliation. Ending balances
              include investments and vested shares before future sale or
              withdrawal taxes.
            </p>
          </details>
          <details>
            <summary>Salary-gap calculator</summary>
            <label>
              Offer to increase{" "}
              <select
                value={selected}
                onChange={(e) => {
                  setSalaryOffer(Number(e.target.value));
                  setSolution(null);
                }}
              >
                {state.scenarios.map((s, i) => (
                  <option value={i} key={i}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>{" "}
            <button
              type="button"
              onClick={() =>
                setSolution({
                  state,
                  year,
                  offer: selected,
                  value: solveSalary(state, year, selected),
                })
              }
            >
              Calculate salary estimate
            </button>
            {solution && (
              <p role="status">
                {solution.status === "solution"
                  ? `Estimated starting salary ${money(solution.salary)} (increase ${money(solution.salary - Number(state.scenarios[selected].base))}); resulting monthly cash ${money(solution.cash / 12)}.`
                  : solution.status === "already"
                    ? "This offer already meets the target."
                    : solution.status === "unreachable"
                      ? "No verified solution within the $10 million limit."
                      : solution.status === "invalid"
                        ? "Check the inputs."
                        : "Calculation failed. Check the inputs."}
              </p>
            )}
            <details>
              <summary>How this estimate works</summary>
              <p>
                The target is the other offer's annual cash surplus, excluding
                sold stock, startup outcomes and employer match. Household
                wages, taxes, benefits, expenses and savings remain modeled.
                Later career-event salaries stay unchanged; this is an estimate,
                not a guaranteed minimum.
              </p>
            </details>
          </details>
        </section>
      )}
    </>
  );
}
