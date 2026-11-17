import type {
  CalculatorDraft,
  CalculatorResult,
  BalancePath,
} from "../lib/investmentCalculator";
import { calculatorModes } from "../lib/investmentCalculator";
import { monthLabel } from "../lib/planner";
import { money } from "../lib/format";
import { ProjectionChart } from "./ProjectionChart";
import { Card } from "./ui/card";

const exactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
function answerText(draft: CalculatorDraft, result: CalculatorResult) {
  if (result.answer === null) return "No solution found";
  if (draft.mode === "time") {
    if (result.answer === 0) return "Already reached";
    const years = Math.floor(result.answer / 12),
      months = result.answer % 12;
    return [
      years ? `${years} ${years === 1 ? "year" : "years"}` : "",
      months ? `${months} ${months === 1 ? "month" : "months"}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  }
  if (draft.mode === "return") return `${result.answer.toFixed(6)}%`;
  if (draft.mode === "ending") return money(result.answer);
  return exactMoney.format(result.answer);
}
const annualRows = (path: BalancePath) =>
  path.balances
    .filter((_, index) => index > 0 && index % 12 === 0)
    .map((endingBalance) => ({ endingBalance }));

export function CalculatorResults({
  draft,
  results,
  startYear,
}: {
  draft: CalculatorDraft;
  results: CalculatorResult[];
  startYear: number;
}) {
  const career = draft.source === "career";
  const label =
    career && draft.mode === "saving"
      ? "Extra monthly after-tax money needed"
      : career && draft.mode === "starting"
        ? "Extra starting taxable investments needed"
        : calculatorModes.find((m) => m.id === draft.mode)!.label;
  return (
    <div className="calculator-result-list">
      {results.map((result, index) => {
        const fallback = result.status === "not-found" && draft.mode !== "time";
        const chart = [
          {
            name: fallback
              ? career
                ? "Original career plan"
                : "Search illustration"
              : career
                ? "Calculated projection"
                : result.name,
            index: 0,
            starting: result.starting,
            rows: annualRows(result),
          },
        ];
        if (result.baseline && !fallback)
          chart.push({
            name: "Original career plan",
            index: 1,
            starting: result.baseline.starting,
            rows: annualRows(result.baseline),
          });
        const last = result.balances.length - 1;
        const finalBalance = result.balances[last];
        const monthly =
          draft.mode === "saving"
            ? (result.answer ?? 0)
            : Number(draft.monthly);
        const contributions = monthly * last;
        return (
          <Card className="calculator-result-card" key={index}>
            <h3>{result.name}</h3>
            <p className="calculator-answer-label">{label}</p>
            <strong
              className="calculator-answer"
              data-testid={`calculator-answer-${index}`}
            >
              {answerText(draft, result)}
            </strong>
            {result.status === "not-found" && (
              <p>
                {draft.mode === "time"
                  ? "The target was not reached within 40 years."
                  : "No solution was found within the supported amount or return limits. Try a smaller target or a longer deadline."}
              </p>
            )}
            {result.status === "already-satisfied" && draft.mode !== "time" && (
              <p>
                {draft.mode === "saving"
                  ? career
                    ? "No extra monthly after-tax money is needed with these inputs."
                    : "No monthly contributions are needed with these inputs."
                  : career
                    ? "No extra starting investment is needed with these inputs."
                    : "No starting investment is needed with these inputs."}
              </p>
            )}
            {draft.mode === "time" && result.answer !== null && career && (
              <p>
                {result.answer === 0
                  ? "At the projection start"
                  : `Month-end ${monthLabel(result.answer - 1, startYear)}`}
              </p>
            )}
            {draft.mode === "return" && result.answer !== null && (
              <p className="hint">
                A hypothetical annual return that reaches the target, not a
                forecast or recommended investment.{" "}
                {career
                  ? "Other solutions may exist; employer-stock assumptions are unchanged."
                  : ""}
              </p>
            )}
            {draft.mode !== "time" &&
              draft.mode !== "ending" &&
              result.answer !== null && (
                <p className="hint">
                  Amounts and returns are approximate; rounded answers are
                  checked against the target. Target:{" "}
                  {money(Number(draft.target))} by year {draft.years}.
                </p>
              )}
            <dl className="calculator-metrics">
              <div>
                <dt>Starting investment balance</dt>
                <dd>{money(result.starting)}</dd>
              </div>
              <div>
                <dt>
                  Balance after {last / 12} {last === 12 ? "year" : "years"}
                </dt>
                <dd>{money(finalBalance)}</dd>
              </div>
              {!career && result.status !== "not-found" && (
                <>
                  <div>
                    <dt>Total contributions</dt>
                    <dd>{money(contributions)}</dd>
                  </div>
                  <div>
                    <dt>Investment growth</dt>
                    <dd>
                      {money(finalBalance - result.starting - contributions)}
                    </dd>
                  </div>
                </>
              )}
              {result.baseline && (
                <div>
                  <dt>Original plan at deadline</dt>
                  <dd>{money(result.baseline.balances[last])}</dd>
                </div>
              )}
            </dl>
            {result.status === "not-found" && (
              <p className="hint">
                The chart and schedule show{" "}
                {fallback
                  ? career
                    ? "the original career plan"
                    : `a search illustration at ${draft.mode === "return" ? "−99.9% annual return" : draft.mode === "saving" ? "$0 monthly contributions" : "$0 starting investments"}`
                  : "the entered assumptions"}
                ; no target-reaching solution was found.
              </p>
            )}
            <ProjectionChart series={chart} starting={result.starting} />
            <details className="calculator-schedule">
              <summary>Annual balance schedule</summary>
              <div
                className="table-scroll"
                role="region"
                aria-label={`${result.name} annual balance schedule`}
                tabIndex={0}
              >
                <table>
                  <caption>
                    Nominal investment balances in USD
                    {career ? ", before future sale or withdrawal taxes" : ""}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{career ? "Calendar year" : "Year"}</th>
                      <th scope="col">Calculated balance</th>
                      {result.baseline && <th scope="col">Original plan</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {chart[0].rows.map((row, year) => (
                      <tr key={year}>
                        <th scope="row">
                          {career ? startYear + year : year + 1}
                        </th>
                        <td>{money(row.endingBalance)}</td>
                        {result.baseline && (
                          <td>
                            {money(result.baseline.balances[(year + 1) * 12])}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {result.warnings.map((warning) => (
              <p className="hint" key={warning}>
                {warning}
              </p>
            ))}
          </Card>
        );
      })}
    </div>
  );
}
