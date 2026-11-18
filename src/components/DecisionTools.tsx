import { useEffect, useState } from "react";
import type { PlannerV2 } from "../lib/planner";
import type { Projection } from "../lib/projection";
import type { StartupInputs } from "../lib/startupComparison";
import { money } from "../lib/format";
import {
  decisionSummary,
  previewPlan,
  projectDecision,
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
  const [offer, setOffer] = useState(0),
    [salaryOffer, setSalaryOffer] = useState<number | null>(null);
  const [appreciation, setAppreciation] = useState(""),
    [housing, setHousing] = useState(""),
    [returns, setReturns] = useState(""),
    [exclude, setExclude] = useState(false);
  const [previewResult, setPreview] = useState<{
      state: PlannerV2;
      year: number;
      offer: number;
      values: ReturnType<typeof projectDecision>;
    } | null>(null),
    [error, setError] = useState("");
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
  useEffect(() => {
    if (!state.comparison && offer !== 0) {
      setOffer(0);
      return;
    }
    const scenario = state.scenarios[offer];
    setAppreciation(
      scenario.issuers.find((i) => i.id === scenario.employerId)
        ?.appreciation ?? "0",
    );
    setHousing(scenario.expenses.housing);
    setReturns(state.shared.returns);
    setExclude(false);
    setPreview(null);
    setSolution(null);
    setError("");
  }, [state, offer, year]);
  const selected =
    salaryOffer ??
    (baseline.length === 2 && baseline[0].cash > baseline[1].cash ? 1 : 0);
  const preview =
    previewResult?.state === state &&
    previewResult.year === year &&
    previewResult.offer === offer
      ? previewResult.values
      : null;
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
      <details className="cash-panel prose decision-tools">
        <summary>Explore what-ifs</summary>
        <label>
          Offer{" "}
          <select
            value={offer}
            onChange={(e) => setOffer(Number(e.target.value))}
          >
            {state.scenarios.slice(0, state.comparison ? 2 : 1).map((s, i) => (
              <option key={i} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        </label>{" "}
        <label>
          Employer stock appreciation (%){" "}
          <input
            type="number"
            value={appreciation}
            onChange={(e) => {
              setAppreciation(e.target.value);
              setPreview(null);
            }}
          />
        </label>{" "}
        <label>
          Monthly housing cost{" "}
          <input
            type="number"
            value={housing}
            onChange={(e) => {
              setHousing(e.target.value);
              setPreview(null);
            }}
          />
        </label>{" "}
        <label>
          Investment return (%){" "}
          <input
            type="number"
            value={returns}
            onChange={(e) => {
              setReturns(e.target.value);
              setPreview(null);
            }}
          />
        </label>{" "}
        <label>
          <input
            type="checkbox"
            checked={exclude}
            onChange={(e) => {
              setExclude(e.target.checked);
              setPreview(null);
            }}
          />{" "}
          Exclude promotions
        </label>{" "}
        <button
          type="button"
          onClick={() => {
            try {
              setPreview({
                state,
                year,
                offer,
                values: projectDecision(
                  previewPlan(
                    state,
                    offer,
                    appreciation,
                    housing,
                    returns,
                    exclude,
                  ),
                  year,
                ),
              });
              setError("");
            } catch {
              setPreview(null);
              setError("Check the preview inputs.");
            }
          }}
        >
          Run preview
        </button>{" "}
        <button
          type="button"
          onClick={() => {
            setAppreciation(
              state.scenarios[offer].issuers.find(
                (i) => i.id === state.scenarios[offer].employerId,
              )?.appreciation ?? "0",
            );
            setHousing(state.scenarios[offer].expenses.housing);
            setReturns(state.shared.returns);
            setExclude(false);
            setPreview(null);
            setError("");
          }}
        >
          Reset preview
        </button>
        {error && <p role="alert">{error}</p>}
        {preview?.map((r, i) => (
          <p key={i}>
            {state.scenarios[i].name}: monthly cash{" "}
            {money(baseline[i].cash / 12)} → {money(r.cash / 12)}; ending
            balance {money(baseline[i].ending)} → {money(r.ending)}.
          </p>
        ))}
        <p>
          Preview only. Startup options are separate from portfolio balances.
        </p>
      </details>
    </>
  );
}
