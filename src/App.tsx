import { RotateCcw, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Button } from "./components/ui/button";
import { AppearanceControl } from "./components/ThemeProvider";
import {
  ResultsNavigation,
  destinations,
} from "./components/ResultsNavigation";
import type { Destination } from "./components/ResultsNavigation";
import { useEffect, useMemo, useState } from "react";
import type { PlannerV2 } from "./lib/planner";
import {
  defaultPlanner,
  plannerScenarioErrors,
  validPlanner,
} from "./lib/planner";
import { loadPlanner, savePlanner } from "./lib/plannerStorage";
import {
  parsePlannerUrlParams,
  readFullPlannerLink,
  sessionShareUrl,
  readSessionLink,
  clearFinancialUrl,
} from "./lib/plannerUrl";
import { projectScenario } from "./lib/projection";
import { QuickSetup } from "./components/QuickSetup";
import { ScenarioForm } from "./components/ScenarioForm";
import { Results } from "./components/Results";
import { RetirementGuide } from "./components/RetirementGuide";
import { PlannerBackup } from "./components/PlannerBackup";
import { AppFooter } from "./components/AppFooter";
import { analyticsConsent, track } from "./lib/analytics";
import { StartupFields } from "./components/StartupComparison";
import {
  startupScenarioView,
  emptyStartup,
  emptyStartupSession,
  parseStartupSession,
  type StartupInputs,
} from "./lib/startupComparison";

function initial() {
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

  return { state: loadedState, message, fresh };
}

const startupSessionKey = "careerworth:startup-v1";
function initialStartup(): {
  scenario: number | null;
  inputs: [StartupInputs, StartupInputs];
} {
  try {
    const saved = window.localStorage.getItem(startupSessionKey);
    return saved
      ? parseStartupSession(JSON.parse(saved))
      : emptyStartupSession();
  } catch {
    return emptyStartupSession();
  }
}

function incomingLink() {
  try {
    const fragment = readSessionLink(window.location.hash);
    if (fragment)
      return {
        state: fragment.state,
        startup: fragment.startup,
        partial: false,
      };
    const full = readFullPlannerLink(window.location.search);
    if (full)
      return {
        state: full.state,
        startup: emptyStartupSession(),
        partial: false,
      };
    const partial = parsePlannerUrlParams(window.location.search);
    if (partial.hasCustomParams) {
      const candidate = partial.applyTo(defaultPlanner());
      if (
        !partial.valid ||
        !validPlanner(candidate) ||
        candidate.scenarios.some(
          (s) => Object.keys(plannerScenarioErrors(s, candidate.shared)).length,
        )
      )
        throw new Error();
      candidate.scenarios.forEach((s) => projectScenario(s, candidate.shared));
      return {
        state: candidate,
        startup: emptyStartupSession(),
        partial: true,
      };
    }
  } catch {
    return { error: true } as const;
  }
  return null;
}

export default function App() {
  const [destination, setDestination] = useState<Destination>("overview");
  const [selectedYear, setSelectedYear] = useState(0);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(analyticsConsent);
  const [startupSession] = useState(initialStartup);
  const [startupScenario, setStartupScenario] = useState<number | null>(
    startupSession.scenario,
  );
  const [startupInputs, setStartupInputs] = useState<
    [StartupInputs, StartupInputs]
  >(startupSession.inputs);
  const [loaded] = useState(initial),
    [state, setState] = useState<PlannerV2>(loaded.state),
    [active, setActive] = useState(0),
    [resetVersion, setResetVersion] = useState(0),
    [storageMessage, setStorageMessage] = useState(loaded.message),
    [allowInitialPreset, setAllowInitialPreset] = useState(loaded.fresh),
    [pendingLink, setPendingLink] = useState(incomingLink),
    [setup, setSetup] = useState(loaded.fresh),
    [example, setExample] = useState(() => {
      try {
        return (
          loaded.fresh ||
          window.localStorage.getItem("careerworth:example") === "true"
        );
      } catch {
        return loaded.fresh;
      }
    }),
    [shareOpen, setShareOpen] = useState(false),
    [shareMessage, setShareMessage] = useState("");

  useEffect(() => setAllowInitialPreset(false), []);

  useEffect(() => {
    if (setup || pendingLink) return;
    try {
      window.localStorage.setItem(
        startupSessionKey,
        JSON.stringify({ scenario: startupScenario, inputs: startupInputs }),
      );
    } catch {
      setStorageMessage(
        "Browser storage is unavailable. Your startup inputs will not be saved.",
      );
    }
  }, [startupScenario, startupInputs, setup, pendingLink]);

  const valid = validPlanner(state);

  const projectedState = useMemo(
    () =>
      startupScenario === null
        ? state
        : {
            ...state,
            scenarios: state.scenarios.map((scenario, index) =>
              index === startupScenario
                ? startupScenarioView(scenario)
                : scenario,
            ) as PlannerV2["scenarios"],
          },
    [state, startupScenario],
  );

  const calculation = useMemo(() => {
    if (!valid) return { series: [], error: "" };
    try {
      return {
        series: projectedState.scenarios
          .slice(0, projectedState.comparison ? 2 : 1)
          .map((s, index) => ({
            name: s.name,
            index,
            projection: projectScenario(s, projectedState.shared),
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
  }, [projectedState, valid]);

  const ready = valid && !calculation.error;

  useEffect(() => {
    if (!ready || setup || pendingLink) return;
    try {
      window.localStorage.setItem("careerworth:example", String(example));
      if (!savePlanner(window.localStorage, state))
        setStorageMessage(
          "Your inputs work here, but could not be saved in this browser.",
        );
    } catch {
      setStorageMessage(
        "Browser storage is unavailable. Your inputs will not be saved.",
      );
    }
  }, [state, ready, setup, pendingLink, example]);

  const shareReady =
    ready &&
    state.scenarios.every(
      (scenario) =>
        !Object.keys(plannerScenarioErrors(scenario, state.shared)).length,
    );
  useEffect(() => {
    function handleIncomingLink() {
      const next = incomingLink();
      if (!next) return;
      window.history.replaceState(
        window.history.state,
        "",
        clearFinancialUrl(window.location.href),
      );
      setPendingLink(next);
    }
    if (pendingLink)
      window.history.replaceState(
        window.history.state,
        "",
        clearFinancialUrl(window.location.href),
      );
    window.addEventListener("hashchange", handleIncomingLink);
    window.addEventListener("popstate", handleIncomingLink);
    return () => {
      window.removeEventListener("hashchange", handleIncomingLink);
      window.removeEventListener("popstate", handleIncomingLink);
    };
  }, []);

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
            Your next move, in perspective.
          </span>
          <AppearanceControl />
          <span className="private-badge">
            <ShieldCheck size={14} aria-hidden="true" /> Private by design
          </span>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <h1>Your financial future</h1>
            <p>
              Replace the sample values. Explore your future. Compare your next
              move.
            </p>
          </div>
          <Button
            variant="outline"
            type="button"
            className="reset-button"
            aria-label="Reset inputs"
            onClick={() => {
              setState(defaultPlanner());
              setSetup(false);
              setExample(true);
              setSelectedYear(0);
              setActive(0);
              setResetVersion((v) => v + 1);
              setStorageMessage("");
              setAllowInitialPreset(false);
              setStartupScenario(null);
              setStartupInputs([{ ...emptyStartup }, { ...emptyStartup }]);
            }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset inputs
          </Button>
        </div>
        {storageMessage.startsWith("Saved inputs upgraded") && (
          <p className="migration-note">{storageMessage}</p>
        )}
        {pendingLink && (
          <section
            className="cash-panel prose share-panel"
            aria-label="Shared estimate"
          >
            {"error" in pendingLink ? (
              <p role="alert">
                This plan link is invalid. Your saved plan was kept.
              </p>
            ) : (
              <>
                <p>
                  This{" "}
                  {pendingLink.partial
                    ? "partial estimate uses defaults for omitted settings"
                    : "link contains both offers and their financial inputs"}
                  . Loading it replaces your current saved plan.
                </p>
                <ul>
                  {pendingLink.state.scenarios.map((scenario, index) => (
                    <li key={index}>
                      {scenario.name}: annual base $
                      {Number(scenario.base).toLocaleString("en-US")}, bonus $
                      {Number(scenario.bonus).toLocaleString("en-US")}, tax
                      location {scenario.taxProfile.location}
                      {pendingLink.startup.scenario === index
                        ? " (startup selected)"
                        : ""}
                      .
                    </li>
                  ))}
                </ul>
                <p>
                  Projection: {pendingLink.state.shared.years} years; starting
                  investments $
                  {Number(pendingLink.state.shared.starting).toLocaleString(
                    "en-US",
                  )}
                  . Startup details are shown when included in the link.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setState(pendingLink.state);
                    setStartupScenario(pendingLink.startup.scenario);
                    setStartupInputs(pendingLink.startup.inputs);
                    setSelectedYear(0);
                    setActive(0);
                    setPendingLink(null);
                    setSetup(false);
                    setExample(false);
                  }}
                >
                  Load shared estimate
                </button>{" "}
              </>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => setPendingLink(null)}
            >
              Keep current plan
            </button>
          </section>
        )}
        {!setup && (
          <section
            className="cash-panel prose share-panel"
            aria-label="Share plan"
          >
            <button
              type="button"
              onClick={() => {
                setShareOpen(!shareOpen);
                setShareMessage("");
              }}
            >
              Share
            </button>
            {shareOpen && (
              <div>
                <p>
                  The link includes both offers, assumptions, financial inputs,
                  and startup details. Anyone with the link can read them.
                </p>
                <button
                  type="button"
                  disabled={!shareReady}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        sessionShareUrl(window.location.href, state, {
                          scenario: startupScenario,
                          inputs: startupInputs,
                        }),
                      );
                      setShareMessage("Link copied.");
                    } catch {
                      setShareMessage(
                        "Could not copy the link in this browser.",
                      );
                    }
                  }}
                >
                  Copy share link
                </button>
                <p role="status">{shareMessage}</p>
              </div>
            )}
          </section>
        )}
        {setup && !pendingLink && (
          <QuickSetup
            onExample={() => {
              setStartupScenario(null);
              setStartupInputs(emptyStartupSession().inputs);
              setAllowInitialPreset(true);
              setSetup(false);
              setExample(true);
            }}
            onComplete={(plan, startup) => {
              setState(plan);
              setStartupInputs(emptyStartupSession().inputs);
              setStartupScenario(startup ? 0 : null);
              setSetup(false);
              setExample(false);
              setAllowInitialPreset(false);
            }}
          />
        )}
        {example && !setup && <p>Example plan</p>}
        {!setup && (
          <div className="workspace-layout">
            <ResultsNavigation
              destination={destination}
              onNavigate={(next) => {
                setDestination(next);
                if (window.innerWidth < 1200)
                  requestAnimationFrame(() =>
                    document
                      .getElementById("results")
                      ?.scrollIntoView({ behavior: "instant" }),
                  );
              }}
            />
            <div className="calculator-layout">
              <aside
                id="calculator-inputs"
                className="inputs-panel"
                aria-label="Calculator inputs"
              >
                <div className="input-panel-title">
                  <h2>Your scenarios</h2>
                  <span className="period-tag">USD</span>
                </div>
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
                </div>

                {state.comparison && (
                  <div className="comparison-toolbar">
                    <span className="hint">
                      Editing scenario {active === 0 ? "A" : "B"}
                    </span>
                    <div className="comparison-actions">
                      {active === 1 && (
                        <button
                          type="button"
                          className="text-button small-text clone-scenario-btn"
                          onClick={() => {
                            const cloned = {
                              ...state.scenarios[0],
                              name: state.scenarios[1].name || "Scenario B",
                            };
                            setState((s) => ({
                              ...s,
                              scenarios: [s.scenarios[0], cloned],
                            }));
                          }}
                          title="Copy all compensation, benefits, and expenses from Scenario A"
                        >
                          Copy from Scenario A
                        </button>
                      )}
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
                  </div>
                )}

                <a className="jump-to-results" href="#results">
                  View results <ArrowUpRight size={14} aria-hidden="true" />
                </a>
                <StartupFields
                  enabled={startupScenario === active}
                  onToggle={(enabled) => {
                    setExample(false);
                    setStartupScenario(enabled ? active : null);
                  }}
                  input={startupInputs[active]}
                  onChange={(input) => {
                    setExample(false);
                    setStartupInputs((current) =>
                      active === 0 ? [input, current[1]] : [current[0], input],
                    );
                  }}
                  onApplyExample={(choice) => {
                    setExample(true);
                    const base = {
                      "series-a": "170000",
                      "series-b": "175000",
                      "series-c": "175000",
                    }[choice];
                    const input: StartupInputs = {
                      ...emptyStartup,
                      grant: {
                        "series-a": "16000",
                        "series-b": "12000",
                        "series-c": "8000",
                      }[choice],
                      strike: "1.25",
                      vesting: "cliff",
                    };
                    setStartupInputs((current) =>
                      active === 0 ? [input, current[1]] : [current[0], input],
                    );
                    setState((current) => ({
                      ...current,
                      scenarios: current.scenarios.map((scenario, index) =>
                        index !== active
                          ? scenario
                          : {
                              ...scenario,
                              name: `Example Series ${choice.slice(-1).toUpperCase()}`,
                              base,
                              bonus: "0",
                              growth: "0",
                              signOnY1: "0",
                              signOnY2: "0",
                              employerMatch: {
                                ...scenario.employerMatch,
                                type: "none" as const,
                              },
                            },
                      ) as PlannerV2["scenarios"],
                    }));
                  }}
                />
                <ScenarioForm
                  key={`${active}-${resetVersion}`}
                  scenario={state.scenarios[active]}
                  assumptions={state.shared}
                  showName={state.comparison}
                  allowInitialPreset={allowInitialPreset}
                  startup={startupScenario === active}
                  onChange={(next) => {
                    if (allowInitialPreset) setAllowInitialPreset(false);
                    else setExample(false);
                    setState((s) => ({
                      ...s,
                      scenarios: s.scenarios.map((old, i) =>
                        i === active ? next : old,
                      ) as PlannerV2["scenarios"],
                    }));
                  }}
                  onAssumptionsChange={(shared) => {
                    if (!allowInitialPreset) setExample(false);
                    setState((s) => ({ ...s, shared }));
                  }}
                />
              </aside>
              <div id="results" className="results-column" tabIndex={-1}>
                <div className="workspace-heading">
                  <div>
                    <h2>
                      {
                        destinations.find((item) => item.id === destination)
                          ?.label
                      }
                    </h2>
                    <p className="hint">
                      {destination === "overview"
                        ? "A clearer picture of your money"
                        : destination === "cash"
                          ? "Follow your income, spending, and savings"
                          : destination === "taxes"
                            ? "Understand your estimated annual liability"
                            : "Every year of your projection, in detail"}
                    </p>
                  </div>
                  <a className="back-to-inputs" href="#calculator-inputs">
                    Edit inputs <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
                {ready ? (
                  <Results
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                    destination={destination}
                    state={projectedState}
                    series={calculation.series}
                    startupScenario={startupScenario}
                    startupInput={startupInputs[startupScenario ?? 0]}
                  />
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
          </div>
        )}
        {!setup && (
          <div className="planner-resources">
            <PlannerBackup
              state={state}
              startup={{ scenario: startupScenario, inputs: startupInputs }}
              onRestore={(restored) => {
                setState(restored.planner);
                setSetup(false);
                setExample(false);
                setSelectedYear(0);
                setStartupScenario(restored.startup.scenario);
                setStartupInputs(restored.startup.inputs);
                setActive(0);
                setResetVersion((version) => version + 1);
              }}
            />
            <RetirementGuide />
          </div>
        )}
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
