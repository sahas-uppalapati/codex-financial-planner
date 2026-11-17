import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { PlannerV2 } from "../lib/planner";
import {
  calculatorErrors,
  calculatorFields,
  calculatorModes,
  calculateInvestments,
  defaultCalculatorDraft,
} from "../lib/investmentCalculator";
import type {
  CalculatorDraft,
  CalculatorField,
  CalculatorResult,
  CalculatorSource,
} from "../lib/investmentCalculator";
import { NumberField, SelectField } from "./EditorFields";
import { Button } from "./ui/button";
import { CalculatorResults } from "./CalculatorResults";
import { money } from "../lib/format";

const fieldSpecs: Record<
  CalculatorField,
  { label: string; unit: string; min: number; max: number }
> = {
  starting: { label: "Starting investments", unit: "USD", min: 0, max: 1e7 },
  monthly: {
    label: "Monthly contribution",
    unit: "USD / month",
    min: 0,
    max: 1e6,
  },
  extraMonthly: {
    label: "Extra monthly after-tax money",
    unit: "USD / month",
    min: 0,
    max: 1e6,
  },
  returns: {
    label: "Annual investment return",
    unit: "%",
    min: -99.9,
    max: 30,
  },
  years: { label: "Investment length", unit: "years", min: 1, max: 40 },
  target: {
    label: "Target investment balance",
    unit: "USD",
    min: 0,
    max: 1e12,
  },
};

export function InvestmentCalculators({
  visible,
  entry,
  plan,
  careerReady,
  startupActive,
  onEditPlan,
}: {
  visible: boolean;
  entry: number;
  plan: PlannerV2;
  careerReady: boolean;
  startupActive: boolean;
  onEditPlan: () => void;
}) {
  const [source, setSource] = useState<CalculatorSource>("standalone");
  const [drafts, setDrafts] = useState<
    Record<CalculatorSource, CalculatorDraft>
  >(() => ({
    standalone: { ...defaultCalculatorDraft },
    career: {
      ...defaultCalculatorDraft,
      source: "career",
      years: plan.shared.years,
    },
  }));
  const [results, setResults] = useState<CalculatorResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const tabsId = useId();
  const draft = drafts[source];
  const errors = calculatorErrors(draft);
  const blocked = source === "career" && !careerReady;

  function invalidate() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setBusy(false);
    setResults(null);
    setError("");
  }
  useEffect(() => {
    invalidate();
  }, [plan]);
  useEffect(() => {
    if (entry > 0) {
      invalidate();
      setSource("career");
    }
  }, [entry]);
  useEffect(() => () => workerRef.current?.terminate(), []);

  function change(patch: Partial<CalculatorDraft>) {
    invalidate();
    setDrafts((current) => ({
      ...current,
      [source]: { ...current[source], ...patch },
    }));
  }
  function calculate(event: FormEvent) {
    event.preventDefault();
    invalidate();
    if (blocked || Object.keys(errors).length) return;
    if (source === "standalone") {
      try {
        setResults(calculateInvestments({ draft }));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to calculate these inputs.",
        );
      }
      return;
    }
    try {
      const worker = new Worker(
        new URL("../lib/investmentCalculator.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      setBusy(true);
      worker.onmessage = (
        event: MessageEvent<{ results?: CalculatorResult[]; error?: string }>,
      ) => {
        if (workerRef.current !== worker) return;
        setBusy(false);
        setResults(event.data.results ?? null);
        setError(event.data.error ?? "");
        worker.terminate();
        workerRef.current = null;
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        setBusy(false);
        setError(
          "The calculation worker could not run. Try calculating again.",
        );
        worker.terminate();
        workerRef.current = null;
      };
      worker.postMessage({ draft, plan });
    } catch {
      invalidate();
      setError(
        "The calculation worker could not start. Try calculating again.",
      );
    }
  }

  return (
    <div
      className="investment-calculators"
      style={{ display: visible ? undefined : "none" }}
    >
      <div
        className="calculator-mode-tabs"
        role="tablist"
        aria-label="Calculator type"
      >
        {calculatorModes.map((mode, index) => (
          <Button
            key={mode.id}
            type="button"
            variant="ghost"
            role="tab"
            id={`${tabsId}-${mode.id}`}
            aria-selected={draft.mode === mode.id}
            aria-controls={`${tabsId}-panel`}
            tabIndex={draft.mode === mode.id ? 0 : -1}
            onClick={() => {
              if (draft.mode !== mode.id) change({ mode: mode.id });
            }}
            onKeyDown={(event) => {
              let nextIndex: number;
              switch (event.key) {
                case "ArrowRight":
                  nextIndex = (index + 1) % calculatorModes.length;
                  break;
                case "ArrowLeft":
                  nextIndex =
                    (index + calculatorModes.length - 1) %
                    calculatorModes.length;
                  break;
                case "Home":
                  nextIndex = 0;
                  break;
                case "End":
                  nextIndex = calculatorModes.length - 1;
                  break;
                default:
                  return;
              }
              event.preventDefault();
              const next = calculatorModes[nextIndex];
              if (draft.mode !== next.id) change({ mode: next.id });
              document.getElementById(`${tabsId}-${next.id}`)?.focus();
            }}
          >
            {mode.label}
          </Button>
        ))}
      </div>
      <div
        className="calculator-layout"
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-${draft.mode}`}
      >
        <aside
          className="inputs-panel"
          aria-label="Investment calculator inputs"
          id="investment-calculator-inputs"
        >
          <div className="input-panel-title">
            <h2>Investment calculators</h2>
            <span className="period-tag">USD</span>
          </div>
          <form className="investment-calculator-form" onSubmit={calculate}>
            <SelectField
              label="Input source"
              value={source}
              onChange={(value) => {
                invalidate();
                setSource(value as CalculatorSource);
              }}
            >
              <option value="standalone">Standalone</option>
              <option value="career">Use my career plan</option>
            </SelectField>
            {calculatorFields(draft).map((key) => (
              <NumberField
                key={key}
                {...fieldSpecs[key]}
                value={draft[key]}
                error={errors[key]}
                integer={key === "years"}
                onChange={(value) => change({ [key]: value })}
              />
            ))}
            {draft.mode === "time" && (
              <p className="hint">
                Searches the next 40 years, checking each month-end. A first
                crossing can be followed by a later decline.
              </p>
            )}
            {source === "standalone" ? (
              <p className="hint">
                Effective annual return, converted to monthly growth. Fixed
                contributions enter at month-end. Excludes taxes, fees, and
                inflation adjustments.
              </p>
            ) : (
              <>
                <details className="calculator-assumptions">
                  <summary>Career assumptions used</summary>
                  <p>
                    {plan.scenarios
                      .slice(0, plan.comparison ? 2 : 1)
                      .map((s) => s.name)
                      .join(" and ")}
                  </p>
                  <p>
                    Starting taxable investments:{" "}
                    {money(Number(plan.shared.starting))}. Investment return:{" "}
                    {plan.shared.returns}% per year.
                  </p>
                  <p>
                    Uses your salary, tax estimates, expenses, grants, career
                    events, retirement accounts, HSA, and vested employer
                    shares. Employer-stock appreciation stays separate.
                  </p>
                  <p>
                    Work and saving continue as modeled through the selected
                    period; no automatic retirement is assumed. Future results
                    extend the app’s bundled tax rules.
                  </p>
                  {startupActive && (
                    <p>
                      Startup option illustrations are excluded; the planner’s
                      startup-adjusted career scenario is used.
                    </p>
                  )}
                </details>
                <p className="hint">
                  Extra money is hypothetical after-tax cash added beyond your
                  plan. You decide how to fund it; the calculator does not
                  change salary or spending.
                </p>
                <p className="hint">
                  Targets include retirement/HSA assets and vested employer
                  shares before future sale or withdrawal taxes. They are not a
                  spendable-cash target or complete net worth.
                </p>
                <Button type="button" variant="outline" onClick={onEditPlan}>
                  Edit career plan
                </Button>
              </>
            )}
            {blocked && (
              <p className="error" role="alert">
                Correct the career plan inputs to use career mode. Standalone
                remains available.
              </p>
            )}
            <Button
              type="submit"
              disabled={blocked || Object.keys(errors).length > 0 || busy}
            >
              {busy ? "Calculating…" : "Calculate"}
            </Button>
            {busy && (
              <Button type="button" variant="outline" onClick={invalidate}>
                Cancel calculation
              </Button>
            )}
            <p className="hint">
              Calculator drafts stay here while navigating. They reset on
              refresh and never change your saved plan.
            </p>
            <a
              className="jump-to-results"
              href="#investment-calculator-results"
            >
              View calculation results
            </a>
          </form>
        </aside>
        <div
          className="results-column"
          id="investment-calculator-results"
          tabIndex={-1}
        >
          <div className="workspace-heading">
            <div>
              <h2>Calculators</h2>
              <p className="hint">
                Explore a target, contribution, timeline, or return
              </p>
            </div>
            <a className="back-to-inputs" href="#investment-calculator-inputs">
              Edit calculator inputs
            </a>
          </div>
          <div role="status" aria-live="polite">
            {busy
              ? "Calculating your career scenarios…"
              : results
                ? "Calculation complete."
                : ""}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {results ? (
            <CalculatorResults
              draft={draft}
              results={results}
              startYear={Number(plan.shared.startYear)}
            />
          ) : (
            !busy &&
            !error && (
              <section className="calculator-empty">
                <h3>What would you like to find?</h3>
                <p>
                  Choose a mode, enter a few values, and calculate. Use your
                  career plan to include changing income, vesting, and expenses.
                </p>
              </section>
            )
          )}
        </div>
      </div>
    </div>
  );
}
