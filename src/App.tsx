import { useEffect, useMemo, useState } from "react";
import type { PlannerV2 } from "./lib/planner";
import {
  defaultPlanner,
  plannerSharedErrors,
  plannerScenarioErrors,
  uid,
  validPlanner,
} from "./lib/planner";
import { loadPlanner, savePlanner } from "./lib/plannerStorage";
import { parsePlannerUrlParams, readFullPlannerLink, fullPlannerUrl } from "./lib/plannerUrl";
import { projectScenario } from "./lib/projection";
import { ScenarioForm } from "./components/ScenarioForm";
import { Field } from "./components/Field";
import { AutoDetails, NumberField, SelectField } from "./components/EditorFields";
import { Results } from "./components/Results";
import { QuickEstimate } from "./components/QuickEstimate";
import { templateSchedule } from "./data/vesting";
import { RetirementGuide } from "./components/RetirementGuide";
import { PlannerBackup } from "./components/PlannerBackup";
import { AppFooter } from "./components/AppFooter";
import { retirementAccountLabels } from "./lib/retirement";
import type { RetirementAccountType } from "./lib/retirement";
import { money } from "./lib/format";
import { analyticsConsent, track } from "./lib/analytics";
function initial() {
  let linked: ReturnType<typeof readFullPlannerLink> = null;
  let linkMessage = "";
  const isOwnPlan = window.history.state?.ownPlan === true;
  if (!isOwnPlan) {
    try { linked = readFullPlannerLink(window.location.search); }
    catch { linkMessage = "This plan link is invalid. Your saved plan was kept."; }
    if (linked) return { state: linked.state, message: "", fresh: false, linkedMode: linked.quickMode };
  }
  let loadedState: PlannerV2;
  let message = "";
  let fresh = false;
  try {
    fresh = !["careerworth:v1", "careerworth:v2", "careerworth:v3"].some((key) => window.localStorage.getItem(key) !== null);
    const res = loadPlanner(window.localStorage);
    loadedState = res.state;
    message = res.message;
  } catch {
    loadedState = defaultPlanner();
    message = "Browser storage is unavailable. Your inputs will not be saved.";
  }

  if (message.startsWith("Saved inputs upgraded") || message.startsWith("Saved inputs could not be restored")) {
    return { state: loadedState, message, fresh, linkedMode: undefined };
  }

  return { state: loadedState, message: linkMessage || message, fresh, linkedMode: undefined };
}
function initialMode(): boolean {
  try {
    return window.sessionStorage?.getItem("careerworth:mode") !== "detailed";
  } catch {
    return true;
  }
}
export default function App() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(analyticsConsent);
  const [loaded] = useState(initial),
    [state, setState] = useState<PlannerV2>(loaded.state),
    [active, setActive] = useState(0),
    [quickMode, setQuickModeState] = useState(() => loaded.linkedMode ?? initialMode()),
    [resetVersion, setResetVersion] = useState(0),
    [storageMessage, setStorageMessage] = useState(loaded.message),
    [allowInitialPreset, setAllowInitialPreset] = useState(loaded.fresh),
    [linkError, setLinkError] = useState(""),
    [pendingLink, setPendingLink] = useState(() => {
      if (new URLSearchParams(window.location.search).has("plan")) return null;
      const parsed = parsePlannerUrlParams(window.location.search);
      return parsed.hasCustomParams ? parsed : null;
    });
  const setQuickMode = (value: boolean | ((prev: boolean) => boolean)) => {
    setQuickModeState((prev: boolean) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        window.sessionStorage?.setItem(
          "careerworth:mode",
          next ? "quick" : "detailed",
        );
      } catch {}
      return next;
    });
  };


  useEffect(() => setAllowInitialPreset(false), []);

  const switchToQuick = () => {
    setQuickMode(true);
  };

  const switchToDetailed = () => {
    setState((s) => {
      const s0 = s.scenarios[0];
      const nextScenarios = [...s.scenarios] as PlannerV2["scenarios"];
      if (
        Number(s0.stock) > 0 &&
        (!s0.grants || s0.grants.length === 0)
      ) {
        const grantValue = Number(s0.stock) * 4;
        const issuerId = s0.employerId || uid();
        nextScenarios[0] = {
          ...s0,
          employerId: issuerId,
          issuers: s0.issuers.length > 0 ? s0.issuers : [{
            id: issuerId,
            name: s0.company || "Current employer",
            price: "100",
            appreciation: "0",
            startingShares: "0",
            startingBasis: "0",
          }],
          grants: [{
            id: uid(),
            name: "Initial grant",
            issuerId,
            employmentId: "initial",
            month: `${s.shared.startYear || "2026"}-01`,
            units: "dollars",
            value: String(grantValue),
            priceMode: "modeled",
            grantPrice: "100",
            schedule: templateSchedule("quarterly"),
            template: "quarterly",
            treatment: "sell",
            keepOnDeparture: false,
          }],
          stockMode: "grants",
        };
      }
      return {
        ...s,
        scenarios: nextScenarios,
      };
    });
    setQuickMode(false);
  };
  const modeledState = useMemo<PlannerV2>(() => {
    if (!quickMode) return state;
    const original = state.scenarios[0];
    const empId = original.employerId || "quick-estimate-employer";
    const hasIssuer = original.issuers && original.issuers.some((i) => i.id === empId);
    const issuers = hasIssuer && original.issuers.length > 0
      ? original.issuers
      : [
          ...(original.issuers || []),
          {
            id: empId,
            name: "Current employer",
            price: "100",
            appreciation: "0",
            startingShares: "0",
            startingBasis: "0",
          },
        ];
    const quickScenario = {
      ...original,
      name: original.name || "Quick estimate",
      role: original.role || "Software engineer",
      stock: original.stock,
      taxProfile: {
        ...original.taxProfile,
        mode: original.taxProfile.mode,
        filing: original.taxProfile.filing,
        spouseWages: original.taxProfile.spouseWages,
        spouseGrowth: original.taxProfile.spouseGrowth,
        hsaCoverage: original.taxProfile.hsaCoverage,
        employeePremiums: true,
        waCaresExempt: false,
        nyDisability: false,
        federalAdjustment: "0",
        stateAdjustment: "0",
        localAdjustment: "0",
      },
      benefits: { ...original.benefits, health: "0" },
      spouseBenefits: { retirement: "0", health: "0", hsa: "0" },
      retirementTargets: {
        ...original.retirementTargets,
        spouse: {
          ...original.retirementTargets.spouse,
          workplace401k: { ...original.retirementTargets.spouse.workplace401k, amount: "0" },
          traditionalIra: "0", rothIra: "0", backdoorRoth: "0", megaBackdoor: "0",
        },
      },
      spouseEmployerMatch: { ...original.spouseEmployerMatch, type: "none" as const },
      stockMode:
        original.stockMode === "grants" && original.grants && original.grants.length > 0
          ? ("grants" as const)
          : original.includeStock
            ? ("legacy" as const)
            : ("grants" as const),
      employerId: empId,
      grantOverrides: {},
      issuers,
      grants: original.grants || [],
      refreshers: [],
      events: original.events || [],
    };
    return {
      ...state,
      comparison: false,
      scenarios: [quickScenario, state.scenarios[1]],
      shared: {
        ...state.shared,
        startYear: "2026",
        returns: state.shared.returns,
        inflation: state.shared.inflation,
        taxInflation: "2.5",
        startingRetirement: state.shared.startingRetirement,
        startingHsa: state.shared.startingHsa,
      },
    };
  }, [state, quickMode]);
  const valid = validPlanner(modeledState),
    errors = plannerSharedErrors(modeledState.shared);
  const calculation = useMemo(() => {
    if (!valid) return { series: [], error: "" };
    try {
      return {
        series: modeledState.scenarios
          .slice(0, modeledState.comparison ? 2 : 1)
          .map((s, index) => ({
            name: s.name,
            index,
            projection: projectScenario(s, modeledState.shared),
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
  }, [modeledState, valid]);
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

  const shareReady = ready && validPlanner(state) && state.scenarios.every((scenario) => !Object.keys(plannerScenarioErrors(scenario, state.shared)).length);
  useEffect(() => {
    if (pendingLink) return;
    window.history.replaceState({ ...(window.history.state || {}), ownPlan: true }, "", fullPlannerUrl(window.location.href, shareReady ? state : null, quickMode));
  }, [state, quickMode, shareReady, pendingLink]);

  const shared = (key: keyof PlannerV2["shared"], value: string) =>
    setState((s) => ({ ...s, shared: { ...s.shared, [key]: value } }));
  const startingAccountTotal =
    Number(state.shared.starting) +
    state.shared.startingAccounts.reduce((sum, row) => sum + Number(row.balance), 0) +
    Number(state.shared.startingRetirement) + Number(state.shared.startingHsa) +
    Number(state.shared.startingSpouseRetirement) + Number(state.shared.startingSpouseHsa);
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
              setAllowInitialPreset(true);
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
            <p>This link contains a partial estimate. Loading it replaces the current saved plan; omitted settings use defaults and expense categories are estimates.</p>
            <button type="button" onClick={() => {
              const candidate = pendingLink.applyTo(defaultPlanner());
              if (!pendingLink.valid || !validPlanner(candidate)) {
                setLinkError("This link contains invalid or out-of-range values. Your current plan was not changed.");
                return;
              }
              setState(candidate);
              setQuickMode(pendingLink.mode !== "detailed");
              setActive(0);
              setPendingLink(null);
            }}>Load shared estimate</button>{" "}
            <button type="button" className="text-button" onClick={() => setPendingLink(null)}>Keep current plan</button>
            {linkError && <p role="alert">{linkError}</p>}
          </section>
        )}
        <div className="calculator-layout">
          <aside className="inputs-panel" aria-label="Calculator inputs">
            <div className="inputs-heading">
              <div className="view-mode-toggle" role="group" aria-label="Calculator view">
                <button
                  type="button"
                  className={`view-mode-pill ${quickMode ? "active" : ""}`}
                  aria-pressed={quickMode}
                  onClick={() => { switchToQuick(); track("view_mode_changed", { mode: "quick" }); }}
                >
                  Quick Estimate
                </button>
                <button
                  type="button"
                  className={`view-mode-pill ${!quickMode ? "active" : ""}`}
                  aria-pressed={!quickMode}
                  onClick={() => { switchToDetailed(); track("view_mode_changed", { mode: "detailed" }); }}
                >
                  Detailed View
                </button>
              </div>
              <span className="muted small-text">All amounts in USD</span>
            </div>
            {quickMode ? (
              <>
                <QuickEstimate
                  key={resetVersion}
                  allowInitialPreset={allowInitialPreset}
                  scenario={state.scenarios[0]}
                  assumptions={state.shared}
                  onScenarioChange={(scenario) => setState((s) => ({ ...s, scenarios: [scenario, s.scenarios[1]] }))}
                  onAssumptionsChange={(shared) => setState((s) => ({ ...s, shared }))}
                  errors={{
                    ...plannerScenarioErrors(modeledState.scenarios[0], modeledState.shared),
                    ...errors,
                  }}
                />
                <div className="quick-detail-cta">
                  <p>Want a closer look at your plan?</p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={switchToDetailed}
                  >
                    Add more detail <span aria-hidden="true">→</span>
                  </button>
                  <span className="hint">RSU schedules, career changes, employer presets and comparisons</span>
                </div>
              </>
            ) : (
              <>
            <div
              className="scenario-switcher"
              role="group"
              aria-label="Select scenario to edit"
            >
              {state.scenarios
                .slice(0, state.comparison ? 2 : 1)
                .map((s, i) => (
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
              {!state.comparison && (
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
              onChange={(next) =>
                setState((s) => ({
                  ...s,
                  scenarios: s.scenarios.map((old, i) =>
                    i === active ? next : old,
                  ) as PlannerV2["scenarios"],
                }))
              }
            />
            <section className="shared-inputs" aria-labelledby="shared-heading">
              <div className="section-label">
                <h3 id="shared-heading">Starting investments & balances</h3>
                {state.comparison && <span className="status-tag">Shared</span>}
              </div>
              <div className="two-cols">
                <Field
                  label="Starting taxable investments"
                  value={state.shared.starting}
                  onChange={(v) => shared("starting", v)}
                  error={errors.starting}
                  hint="Taxable investments and liquid savings at start of projection (USD)."
                />
                <Field
                  label="Projection length"
                  unit="years"
                  value={state.shared.years}
                  onChange={(v) => shared("years", v)}
                  error={errors.years}
                  integer
                />
              </div>
              {state.shared.startingAccounts.length > 0 && (
                <div className="metric-row starting-total">
                  <span>Starting assets <small>Taxable + retirement accounts; employer shares shown in the results</small></span>
                  <strong>{Number.isFinite(startingAccountTotal) ? money(startingAccountTotal) : "Check balances"}</strong>
                </div>
              )}
              {state.shared.startingAccounts.map((account, index) => (
                <div className="starting-account-row" key={account.id}>
                  <SelectField
                    label={`Account ${index + 1} type`}
                    value={account.type}
                    onChange={(value) => setState((current) => ({ ...current, shared: { ...current.shared, startingAccounts: current.shared.startingAccounts.map((row) => row.id === account.id ? { ...row, type: value as RetirementAccountType } : row) } }))}
                  >
                    {(Object.entries(retirementAccountLabels) as [RetirementAccountType, string][]).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                  </SelectField>
                  <SelectField
                    label={`Account ${index + 1} owner`}
                    value={account.owner}
                    onChange={(value) => setState((current) => ({ ...current, shared: { ...current.shared, startingAccounts: current.shared.startingAccounts.map((row) => row.id === account.id ? { ...row, owner: value as "primary" | "spouse" } : row) } }))}
                  >
                    <option value="primary">You</option><option value="spouse">Spouse</option>
                  </SelectField>
                  <Field label={`${account.owner === "spouse" ? "Spouse" : "Your"} ${retirementAccountLabels[account.type]} balance`} value={account.balance} onChange={(value) => setState((current) => ({ ...current, shared: { ...current.shared, startingAccounts: current.shared.startingAccounts.map((row) => row.id === account.id ? { ...row, balance: value } : row) } }))} error={errors[`startingAccounts.${index}.balance`]} />
                  <button type="button" className="text-button small-text" aria-label={`Remove ${retirementAccountLabels[account.type]} starting balance`} onClick={() => setState((current) => ({ ...current, shared: { ...current.shared, startingAccounts: current.shared.startingAccounts.filter((row) => row.id !== account.id) } }))}>Remove</button>
                </div>
              ))}
              <button type="button" className="secondary small" disabled={state.shared.startingAccounts.length >= 40} onClick={() => setState((current) => ({ ...current, shared: { ...current.shared, startingAccounts: [...current.shared.startingAccounts, { id: uid(), owner: "primary", type: "traditional-401k", balance: "0" }] } }))}>+ Add retirement account balance</button>
              {errors.startingAccounts && <p className="error">{errors.startingAccounts}</p>}
              <p className="hint">Include 401(k) / IRA balances from past employers. <a href="#starting-employer-shares">Edit starting shares</a> in equity.</p>
              <AutoDetails
                hasErrors={
                  !!(
                    errors.startYear ||
                    errors.taxInflation ||
                    errors.startingAccounts ||
                    errors.returns ||
                    errors.inflation
                  )
                }
              >
                <summary>
                  Assumptions{" "}
                  <span className="optional">Returns, dates & accounts</span>
                </summary>
                <div className="details-body">
                  <NumberField
                    label="Projection start calendar year"
                    unit="January 1"
                    min={2026}
                    max={2036}
                    integer
                    value={state.shared.startYear}
                    onChange={(v) => shared("startYear", v)}
                  />
                  <Field
                    label="Annual investment return"
                    unit="%"
                    value={state.shared.returns}
                    onChange={(v) => shared("returns", v)}
                    error={errors.returns}
                  />
                  <Field
                    label="Annual expense inflation"
                    unit="%"
                    value={state.shared.inflation}
                    onChange={(v) => shared("inflation", v)}
                    error={errors.inflation}
                  />
                  <NumberField
                    label="Annual tax-threshold inflation"
                    unit="%"
                    max={10}
                    value={state.shared.taxInflation}
                    onChange={(v) => shared("taxInflation", v)}
                    hint="Projects only indexed parameters of 2026 law. Fixed thresholds remain fixed; future legislation is not predicted."
                  />
                  <p className="hint">
                    Applies to taxable, 401(k), and HSA balances. Employer stock appreciation is set separately.
                  </p>
                </div>
              </AutoDetails>
            </section>
            <p className="example-note">
              Planning estimates only. Sourced tax rules and compensation models.
            </p>
            <button type="button" className="text-button back-to-quick" onClick={() => setQuickMode(true)}>
              ← Back to quick estimate
            </button>
              </>
            )}
          </aside>
          <div id="results" className="results-column" tabIndex={-1}>
            {ready ? (
              <Results state={modeledState} series={calculation.series} quickMode={quickMode} />
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
        <PlannerBackup state={state} onRestore={(restored) => {
          setState(restored);
          setActive(0);
          setResetVersion((version) => version + 1);
        }} />
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
