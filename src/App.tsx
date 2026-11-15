import { useEffect, useMemo, useState } from "react";
import type { PlannerV2 } from "./lib/planner";
import {
  defaultPlanner,
  plannerScenarioErrors,
  validPlanner,
} from "./lib/planner";
import { loadPlanner, savePlanner } from "./lib/plannerStorage";
import { parsePlannerUrlParams, readFullPlannerLink, fullPlannerUrl } from "./lib/plannerUrl";
import { projectScenario } from "./lib/projection";
import { ScenarioForm } from "./components/ScenarioForm";
import { Results } from "./components/Results";
import { RetirementGuide } from "./components/RetirementGuide";
import { PlannerBackup } from "./components/PlannerBackup";
import { AppFooter } from "./components/AppFooter";
import { analyticsConsent, track } from "./lib/analytics";

function initial() {
  let linked: ReturnType<typeof readFullPlannerLink> = null;
  let linkMessage = "";
  const isOwnPlan = window.history.state?.ownPlan === true;
  if (!isOwnPlan) {
    try {
      linked = readFullPlannerLink(window.location.search);
    } catch {
      linkMessage = "This plan link is invalid. Your saved plan was kept.";
    }
    if (linked) return { state: linked.state, message: "", fresh: false };
  }
  let loadedState: PlannerV2;
  let message = "";
  let fresh = false;
  try {
    fresh = !["careerworth:v1", "careerworth:v2", "careerworth:v3"].some(
      (key) => window.localStorage.getItem(key) !== null,
    );
    const res = loadPlanner(window.localStorage);
    loadedState = res.state;
    message = res.message;
  } catch {
    loadedState = defaultPlanner();
    message = "Browser storage is unavailable. Your inputs will not be saved.";
  }

  if (
    message.startsWith("Saved inputs upgraded") ||
    message.startsWith("Saved inputs could not be restored")
  ) {
    return { state: loadedState, message, fresh };
  }

  return { state: loadedState, message: linkMessage || message, fresh };
}

export default function App() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(analyticsConsent);
  const [loaded] = useState(initial),
    [state, setState] = useState<PlannerV2>(loaded.state),
    [active, setActive] = useState(0),
    [resetVersion, setResetVersion] = useState(0),
    [storageMessage, setStorageMessage] = useState(loaded.message),
    [allowInitialPreset, setAllowInitialPreset] = useState(loaded.fresh),
    [linkError, setLinkError] = useState(""),
    [pendingLink, setPendingLink] = useState(() => {
      if (new URLSearchParams(window.location.search).has("plan")) return null;
      const parsed = parsePlannerUrlParams(window.location.search);
      return parsed.hasCustomParams ? parsed : null;
    });

  useEffect(() => setAllowInitialPreset(false), []);

  const valid = validPlanner(state);

  const calculation = useMemo(() => {
    if (!valid) return { series: [], error: "" };
    try {
      return {
        series: state.scenarios
          .slice(0, state.comparison ? 2 : 1)
          .map((s, index) => ({
            name: s.name,
            index,
            projection: projectScenario(s, state.shared),
          })),
        error: "",
      };
    } catch (error) {
      return {
        series: [],
        error:
          error instanceof Error
            ? error.message
            : "Check the projection assumptions.",
      };
    }
  }, [state, valid]);

  const ready = valid && !calculation.error;

  useEffect(() => {
    if (!ready) return;
    try {
      if (!savePlanner(window.localStorage, state))
        setStorageMessage(
          "Your inputs work here, but could not be saved in this browser.",
        );
    } catch {
      setStorageMessage(
        "Browser storage is unavailable. Your inputs will not be saved.",
      );
    }
  }, [state, ready]);

  const shareReady =
    ready &&
    validPlanner(state) &&
    state.scenarios.every(
      (scenario) =>
        !Object.keys(plannerScenarioErrors(scenario, state.shared)).length,
    );

  useEffect(() => {
    if (pendingLink) return;
    window.history.replaceState(
      { ...(window.history.state || {}), ownPlan: true },
      "",
      fullPlannerUrl(window.location.href, shareReady ? state : null, false),
    );
  }, [state, shareReady, pendingLink]);

  return (
    <>
      <a className="skip-link" href="#results">
        Skip to results
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#" className="brand" aria-label="CareerWorth home">
            <span className="brand-mark" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Career<span>Worth</span>
          </a>
          <span className="header-description">
            A little clarity for your next move.
          </span>
          <span className="private-badge">
            <span aria-hidden="true">◈</span> Private by design
          </span>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">A CLEARER START FOR YOUR MONEY</p>
            <h1>Get a quick view of your financial future</h1>
            <p>
              Replace the sample values with yours. Add more detail whenever you’re ready.
            </p>
          </div>
          <button
            type="button"
            className="text-button reset-button"
            onClick={() => {
              setState(defaultPlanner());
              setActive(0);
              setResetVersion((v) => v + 1);
              setStorageMessage("");
              setAllowInitialPreset(false);
            }}
          >
            ↺ Reset inputs
          </button>
        </div>
        {storageMessage.startsWith("Saved inputs upgraded") && (
          <p className="migration-note">{storageMessage}</p>
        )}
        {pendingLink && (
          <section className="cash-panel prose" aria-label="Shared estimate">
            <p>
              This link contains a partial estimate. Loading it replaces the
              current saved plan; omitted settings use defaults and expense
              categories are estimates.
            </p>
            <button
              type="button"
              onClick={() => {
                const candidate = pendingLink.applyTo(defaultPlanner());
                if (!pendingLink.valid || !validPlanner(candidate)) {
                  setLinkError(
                    "This link contains invalid or out-of-range values. Your current plan was not changed.",
                  );
                  return;
                }
                setState(candidate);
                setActive(0);
                setPendingLink(null);
              }}
            >
              Load shared estimate
            </button>{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => setPendingLink(null)}
            >
              Keep current plan
            </button>
            {linkError && <p role="alert">{linkError}</p>}
          </section>
        )}
        <div className="calculator-layout">
          <aside className="inputs-panel" aria-label="Calculator inputs">
            <div className="inputs-heading">
              {state.comparison ? (
                <div
                  className="scenario-switcher"
                  role="group"
                  aria-label="Select scenario to edit"
                >
                  {state.scenarios.slice(0, 2).map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`scenario-tab ${active === i ? "active" : ""}`}
                      aria-pressed={active === i}
                      onClick={() => setActive(i)}
                    >
                      <span className={`scenario-letter series-${i}`}>
                        {i === 0 ? "A" : "B"}
                      </span>
                      <span className="truncate">
                        {s.name.trim() || `Scenario ${i === 0 ? "A" : "B"}`}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="add-comparison"
                  onClick={() => {
                    setState((s) => ({ ...s, comparison: true }));
                    setActive(1);
                    track("comparison_added");
                  }}
                >
                  + Add comparison
                </button>
              )}
              <span className="muted small-text">All amounts in USD</span>
            </div>

            {state.comparison && (
              <div className="comparison-toolbar">
                <span className="hint">
                  Editing scenario {active === 0 ? "A" : "B"}
                </span>
                <button
                  type="button"
                  className="text-button small-text"
                  onClick={() => {
                    setState((s) => ({ ...s, comparison: false }));
                    setActive(0);
                  }}
                >
                  Remove comparison
                </button>
              </div>
            )}

            <ScenarioForm
              key={`${active}-${resetVersion}`}
              scenario={state.scenarios[active]}
              assumptions={state.shared}
              showName={state.comparison}
              allowInitialPreset={allowInitialPreset}
              onChange={(next) =>
                setState((s) => ({
                  ...s,
                  scenarios: s.scenarios.map((old, i) =>
                    i === active ? next : old,
                  ) as PlannerV2["scenarios"],
                }))
              }
              onAssumptionsChange={(shared) =>
                setState((s) => ({ ...s, shared }))
              }
            />
          </aside>
          <div id="results" className="results-column" tabIndex={-1}>
            {ready ? (
              <Results state={state} series={calculation.series} />
            ) : (
              <section className="invalid-results" role="status">
                <span className="empty-icon" aria-hidden="true">
                  —
                </span>
                <h2>A few details need a second look</h2>
                <p>
                  {calculation.error ||
                    "Correct the highlighted inputs to see your projection. Check both scenarios when comparing."}
                </p>
                <p className="hint">
                  Results and export are paused until the inputs are valid.
                </p>
              </section>
            )}
          </div>
        </div>
        <PlannerBackup
          state={state}
          onRestore={(restored) => {
            setState(restored);
            setActive(0);
            setResetVersion((version) => version + 1);
          }}
        />
        <RetirementGuide />
        <AppFooter
          ready={ready}
          storageMessage={storageMessage}
          analyticsEnabled={analyticsEnabled}
          onAnalyticsToggle={setAnalyticsEnabled}
        />
      </main>
    </>
  );
}
