import { useState, useRef } from "react";
import { Button } from "./ui/button";
import {
  defaultPlanner,
  taxLocations,
  validPlanner,
  plannerScenarioErrors,
  type PlannerV2,
  type TaxLocation,
} from "../lib/planner";

export function QuickSetup({
  onComplete,
  onExample,
}: {
  onComplete: (plan: PlannerV2, startup: boolean) => void;
  onExample: () => void;
}) {
  const [enter, setEnter] = useState(false),
    [salary, setSalary] = useState(""),
    [bonus, setBonus] = useState("0"),
    [location, setLocation] = useState<TaxLocation>("columbus"),
    [expenses, setExpenses] = useState("0"),
    [starting, setStarting] = useState("0"),
    [years, setYears] = useState("4"),
    [startup, setStartup] = useState(false),
    [error, setError] = useState("");
  const salaryInput = useRef<HTMLInputElement>(null);
  const enterButton = useRef<HTMLButtonElement>(null);
  return (
    <section className="cash-panel prose quick-setup" aria-label="Get started">
      <h2 id="setup-heading" tabIndex={-1}>Get started</h2>
      {!enter ? (
        <div className="setup-actions">
          <Button ref={enterButton} type="button" onClick={() => {
            setEnter(true);
            requestAnimationFrame(() => salaryInput.current?.focus());
          }}>
            Enter my offer
          </Button>
          <Button variant="outline" type="button" onClick={onExample}>
            Explore an example
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const plan = defaultPlanner();
            plan.scenarios = plan.scenarios.map((s, i) => ({
              ...s,
              name: i ? "Offer B" : "My offer",
              base: i ? "0" : salary,
              bonus: i ? "0" : bonus || "0",
              stock: "0",
              growth: "0",
              includeStock: false,
              grants: [],
              refreshers: [],
              events: [],
              appliedCompensation: null,
              appliedLocation: null,
              employerMatch: { ...s.employerMatch, type: "none" as const },
              spouseEmployerMatch: {
                ...s.spouseEmployerMatch,
                type: "none" as const,
              },
              signOnY1: "0",
              signOnY2: "0",
              taxProfile: { ...s.taxProfile, location },
              location,
              expenses: {
                housing: i ? "0" : expenses || "0",
                food: "0",
                transportation: "0",
                healthcare: "0",
                other: "0",
              },
            })) as unknown as PlannerV2["scenarios"];
            plan.shared = { ...plan.shared, starting: starting || "0", years };
            if (
              !validPlanner(plan) ||
              plan.scenarios.some(
                (s) =>
                  Object.keys(plannerScenarioErrors(s, plan.shared)).length,
              )
            ) {
              setError("Check the entered values and supported limits.");
              return;
            }
            onComplete(plan, startup);
          }}
        >
          <label>
            Annual base salary{" "}
            <input
              ref={salaryInput}
              required
              type="number"
              step="any"
              min="0"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
          </label>{" "}
          <label>
            Annual bonus{" "}
            <input
              type="number"
              step="any"
              min="0"
              value={bonus}
              onChange={(e) => setBonus(e.target.value)}
            />
          </label>{" "}
          <label>
            Tax location{" "}
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as TaxLocation)}
            >
              {taxLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>{" "}
          <label>
            Monthly expenses{" "}
            <input
              type="number"
              step="any"
              min="0"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
            />
          </label>{" "}
          <label>
            Starting investments{" "}
            <input
              type="number"
              step="any"
              min="0"
              value={starting}
              onChange={(e) => setStarting(e.target.value)}
            />
          </label>{" "}
          <label>
            Projection years{" "}
            <input
              type="number"
              min="1"
              max="40"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </label>{" "}
          <label>
            Equity type{" "}
            <select
              value={startup ? "startup" : "public"}
              onChange={(e) => setStartup(e.target.value === "startup")}
            >
              <option value="public">Public stock</option>
              <option value="startup">Startup options</option>
            </select>
          </label>{" "}
          <details>
            <summary>Other assumptions</summary>
            <p>
              Salary growth, grants, promotions and employer match start at
              zero. Investment return, inflation and tax rules use the planner
              defaults. Edit the equity section to add your grant.
            </p>
          </details>
          {error && <p role="alert">{error}</p>}
          <div className="setup-actions">
            <Button type="submit">Continue to planner</Button>
            <Button variant="outline" type="button" onClick={() => {
              setEnter(false);
              requestAnimationFrame(() => enterButton.current?.focus());
            }}>
              Back
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
