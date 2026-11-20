import { RotateCcw, ShieldCheck, ArrowUpRight, Share2 } from "lucide-react";
import { Button } from "./components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./components/ui/dialog";
import { AppearanceControl } from "./components/ThemeProvider";
import {
  ResultsNavigation,
  destinations,
} from "./components/ResultsNavigation";
import type { Destination } from "./components/ResultsNavigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannerV2 } from "./lib/planner";
import {
  defaultPlanner,
  plannerScenarioErrors,
  plannerSharedErrors,
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
import { InvestmentCalculators } from "./components/InvestmentCalculators";
import { PlannerBackup } from "./components/PlannerBackup";
import { StartingAccounts } from "./components/StartingAccounts";
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

function focusWorkspace(target: HTMLElement | null | undefined) {
  if (!target) return;
  target.focus({ preventScroll: true });
  const { top, bottom } = target.getBoundingClientRect();
  const topInset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  if (top < topInset || bottom > window.innerHeight) {
    target.scrollIntoView({ behavior: "instant", block: "start" });
  }
}

export default function App() {
  const [destination, setDestination] = useState<Destination>("overview");
  const [selectedYear, setSelectedYear] = useState(0);
  const [calculatorEntry, setCalculatorEntry] = useState(0);
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

  const [replacement, setReplacement] = useState<"reset" | "copy" | null>(null);
  const replacementTrigger = useRef<HTMLButtonElement>(null);
  const cancelReplacement = useRef<HTMLButtonElement>(null);

  function askToReplace(action: "reset" | "copy", trigger: HTMLButtonElement) {
    replacementTrigger.current = trigger;
    setReplacement(action);
  }

  function confirmReplacement() {
    if (replacement === "reset") {
      setState(defaultPlanner());
      setExample(true);
      setSelectedYear(0);
      setActive(0);
      setStorageMessage("");
      setAllowInitialPreset(false);
      setStartupScenario(null);
      setStartupInputs(emptyStartupSession().inputs);
    } else {
      setState((current) => ({
        ...current,
        scenarios: [current.scenarios[0], {
          ...current.scenarios[0],
          name: current.scenarios[1].name || "Scenario B",
        }],
      }));
      setAllowInitialPreset(false);
      setExample(false);
    }
    setResetVersion((version) => version + 1);
    setReplacement(null);
  }

  function applyStartupExample(choice: "series-a" | "series-b" | "series-c") {
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
  }

  function focusSection(id: string) {
    requestAnimationFrame(() => focusWorkspace(document.getElementById(id)));
  }

  function goTo(next: Destination) {
    setDestination(next);
    focusSection(next === "calculators" ? "investment-calculator-heading" : "results-heading");
  }

  function fixInputs(scenario?: number) {
    if (scenario !== undefined) setActive(scenario);
    requestAnimationFrame(() => {
      const editor = document.getElementById("calculator-inputs");
      const belongsToGroup = (control: HTMLElement) => {
        const shared = control.closest("[data-shared-input], #shared-assumptions") !== null;
        return shared === (scenario === undefined);
      };
      const invalid = Array.from(editor?.querySelectorAll<HTMLElement>(
        '[aria-invalid="true"], .error',
      ) ?? []).filter(belongsToGroup);
      const field = invalid.find((control) => control.matches('[aria-invalid="true"]')) ?? invalid[0];
      if (field) {
        for (let details = field.closest("details"); details; details = details.parentElement?.closest("details") ?? null) {
          details.open = true;
        }
        if (!field.matches("[aria-invalid=true]")) field.tabIndex = -1;
      }
      focusWorkspace(field ?? document.getElementById(scenario === undefined ? "shared-assumptions" : "planner-input-heading"));
    });
  }

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

  const scenarioErrors = state.scenarios.map((scenario) =>
    Object.keys(plannerScenarioErrors(scenario, state.shared)).length > 0,
  );
  const visibleScenarioErrors = scenarioErrors.slice(0, state.comparison ? 2 : 1);
  const sharedErrors = Object.keys(plannerSharedErrors(state.shared)).length > 0;
  const valid = !sharedErrors && !visibleScenarioErrors.some(Boolean);

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

  const shareReady = ready && !scenarioErrors.some(Boolean);
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
      <a className="skip-link" href={
        setup ? "#setup-heading" : destination === "calculators" ? "#investment-calculator-heading" : "#planner-input-heading"
      }>
        {setup ? "Skip to setup" : "Skip to inputs"}
      </a>
      {!setup && (
        <a className="skip-link" href={destination === "calculators" ? "#investment-calculator-results" : "#results"}>
          Skip to results
        </a>
      )}
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
              {setup
                ? "Enter an offer to estimate take-home pay, savings, and investment growth."
                : "Estimate take-home pay, savings, and investment growth for up to two offers."}
            </p>
          </div>
          {!setup && (
            <div className="top-actions" role="group" aria-label="Plan actions">
              <PlannerBackup
                compact
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
              <Button
                variant="outline"
                type="button"
                className="top-share-button"
                aria-expanded={shareOpen}
                aria-controls={shareOpen ? "share-details" : undefined}
                onClick={() => {
                  setShareOpen(!shareOpen);
                  setShareMessage("");
                }}
              >
                <Share2 size={14} aria-hidden="true" /> Share
              </Button>
              {destination !== "calculators" && (
                <Button
                  variant="outline"
                  type="button"
                  className="reset-button"
                  aria-haspopup="dialog"
                  onClick={(event) => askToReplace("reset", event.currentTarget)}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Reset inputs
                </Button>
              )}
            </div>
          )}
        </div>
        {storageMessage.startsWith("Saved inputs upgraded") && (
          <p className="migration-note">{storageMessage}</p>
        )}
        {pendingLink && (
          <section
            className="cash-panel prose share-panel"
            aria-label="Shared estimate"
            id={setup ? "setup-heading" : undefined}
            tabIndex={-1}
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
        {!setup && shareOpen && (
          <section id="share-details" className="cash-panel prose share-panel" aria-label="Share plan">
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
              focusSection("planner-input-heading");
            }}
            onComplete={(plan, startup) => {
              setState(plan);
              setStartupInputs(emptyStartupSession().inputs);
              setStartupScenario(startup ? 0 : null);
              setSetup(false);
              setExample(false);
              setAllowInitialPreset(false);
              focusSection("planner-input-heading");
            }}
          />
        )}
        {!setup && (
          <div className="workspace-layout">
            <ResultsNavigation
              destination={destination}
              onNavigate={goTo}
              onEditInputs={() => focusSection(
                destination === "calculators" ? "investment-calculator-inputs" : "planner-input-heading",
              )}
            />
            <InvestmentCalculators
              visible={destination === "calculators"}
              entry={calculatorEntry}
              plan={projectedState}
              careerReady={ready}
              startupActive={startupScenario !== null}
              onEditPlan={() => {
                setDestination("overview");
                focusSection("planner-input-heading");
              }}
            />
            <div className="calculator-layout" style={{ display: destination === "calculators" ? "none" : undefined }}> 
              <aside
                id="calculator-inputs"
                className="inputs-panel"
                aria-label="Calculator inputs"
              >
                <div className="input-panel-title">
                  <h2 id="planner-input-heading" tabIndex={-1}>Your scenarios</h2>
                  <span className="period-tag">{example ? "Example plan" : "USD"}</span>
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
                          id={`scenario-tab-${i}`}
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
                      id="add-comparison"
                      onClick={() => {
                        setState((s) => ({ ...s, comparison: true }));
                        setActive(1);
                        focusSection("scenario-tab-1");
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
                          aria-haspopup="dialog"
                          onClick={(event) => askToReplace("copy", event.currentTarget)}
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
                          focusSection("add-comparison");
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
                <ScenarioForm
                  key={`${active}-${resetVersion}`}
                  scenario={state.scenarios[active]}
                  assumptions={state.shared}
                  showName={state.comparison}
                  allowInitialPreset={allowInitialPreset}
                  startup={startupScenario === active}
                  startupFields={
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
                      onApplyExample={applyStartupExample}
                    />
                  }
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
                <StartingAccounts
                  assumptions={state.shared}
                  onChange={(shared) => {
                    if (!allowInitialPreset) setExample(false);
                    setState((current) => ({ ...current, shared }));
                  }}
                />
              </aside>
              <div id="results" className="results-column" tabIndex={-1}>
                <div className="workspace-heading">
                  <div>
                    <h2 id="results-heading" tabIndex={-1}>
                      {destinations.find((item) => item.id === destination)?.label}
                    </h2>
                  </div>
                  <a className="back-to-inputs" href="#planner-input-heading">
                    Edit inputs <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </div>
                {ready ? (
                  <Results
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                    onOpenCalculators={() => {
                      setCalculatorEntry((value) => value + 1);
                      goTo("calculators");
                    }}
                    destination={destination}
                    state={projectedState}
                    series={calculation.series}
                    startupScenario={startupScenario}
                    startupInput={startupInputs[startupScenario ?? 0]}
                  />
                ) : (
                  <section className="invalid-results" aria-labelledby="invalid-results-heading">
                    <h3 id="invalid-results-heading">Check your plan inputs</h3>
                    <p role="status">
                      {calculation.error || "Resolve the issues below to see results and export your projection."}
                    </p>
                    <div className="invalid-result-actions">
                      {visibleScenarioErrors.map((hasErrors, index) => hasErrors && (
                        <Button key={index} variant="outline" onClick={() => fixInputs(index)}>
                          {state.comparison ? (index === 0 ? "Review Scenario A" : "Review Scenario B") : "Review offer inputs"}
                        </Button>
                      ))}
                      {sharedErrors && (
                        <Button variant="outline" onClick={() => fixInputs()}>
                          Review shared assumptions
                        </Button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}

        <AppFooter
          ready={ready}
          storageMessage={storageMessage}
          analyticsEnabled={analyticsEnabled}
          onAnalyticsToggle={setAnalyticsEnabled}
        />
        <Dialog open={replacement !== null} onOpenChange={(open) => {
          if (!open) setReplacement(null);
        }}>
          <DialogContent
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              cancelReplacement.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              replacementTrigger.current?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>{replacement === "copy" ? "Replace Scenario B inputs?" : "Reset this plan?"}</DialogTitle>
              <DialogDescription>
                {replacement === "copy"
                  ? "Copy Scenario A’s compensation, expenses, tax, career, and benefit settings to Scenario B. Scenario B keeps its name and startup option details."
                  : "Replace both offers, shared assumptions, and startup details with the default plan in this browser."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button ref={cancelReplacement} variant="outline" onClick={() => setReplacement(null)}>Cancel</Button>
              <Button onClick={confirmReplacement}>
                {replacement === "copy" ? "Replace Scenario B" : "Reset plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
