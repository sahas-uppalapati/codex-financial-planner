import { useEffect, useMemo, useState } from "react";
import type { PlannerV2 } from "./lib/planner";
import {
  defaultPlanner,
  plannerSharedErrors,
  plannerScenarioErrors,
  validPlanner,
} from "./lib/planner";
import { loadPlanner, savePlanner } from "./lib/plannerStorage";
import { projectScenario } from "./lib/projection";
import { ScenarioForm } from "./components/ScenarioForm";
import { Field } from "./components/Field";
import { AutoDetails, NumberField } from "./components/EditorFields";
import { Results } from "./components/Results";
import { QuickEstimate } from "./components/QuickEstimate";
import { locationPresets } from "./data/presets";
import { RetirementGuide } from "./components/RetirementGuide";
function initial() {
  try {
    return loadPlanner(window.localStorage);
  } catch {
    return {
      state: defaultPlanner(),
      message: "Browser storage is unavailable. Your inputs will not be saved.",
    };
  }
}
function initialMode(): boolean {
  try {
    return window.sessionStorage?.getItem("careerworth:mode") !== "detailed";
  } catch {
    return true;
  }
}
export default function App() {
  const [loaded] = useState(initial),
    [state, setState] = useState<PlannerV2>(loaded.state),
    [active, setActive] = useState(0),
    [quickMode, setQuickModeState] = useState(initialMode),
    [resetVersion, setResetVersion] = useState(0),
    [storageMessage, setStorageMessage] = useState(loaded.message);
  const setQuickMode = (value: boolean | ((prev: boolean) => boolean)) => {
    setQuickModeState((prev) => {
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
  const modeledState = useMemo<PlannerV2>(() => {
    if (!quickMode) return state;
    const original = state.scenarios[0];
    const quickScenario = {
      ...original,
      name: "Quick estimate",
      role: "Software engineer",
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
      stockMode: original.includeStock ? "legacy" as const : "grants" as const,
      employerId: "quick-estimate-employer",
      grantOverrides: {},
      issuers: [{
        id: "quick-estimate-employer",
        name: "Current employer",
        price: "100",
        appreciation: "0",
        startingShares: "0",
        startingBasis: "0",
      }],
      grants: [],
      refreshers: [],
      events: [],
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
  const shared = (key: keyof PlannerV2["shared"], value: string) =>
    setState((s) => ({ ...s, shared: { ...s.shared, [key]: value } }));
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
            }}
          >
            ↺ Reset inputs
          </button>
        </div>
        {storageMessage.startsWith("Saved inputs upgraded") && (
          <p className="migration-note">{storageMessage}</p>
        )}
        <div className="calculator-layout">
          <aside className="inputs-panel" aria-label="Calculator inputs">
            <div className="inputs-heading">
              <h2>{quickMode ? "Quick estimate" : `Your scenario${state.comparison ? "s" : ""}`}</h2>
              <span className="muted small-text">All amounts in USD</span>
            </div>
            {quickMode ? (
              <>
                <QuickEstimate
                  key={resetVersion}
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
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        shared: {
                          ...s.shared,
                          startYear: "2026",
                          taxInflation: "2.5",
                        },
                      }));
                      setQuickMode(false);
                    }}
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
                <h3 id="shared-heading">The starting point</h3>
                {state.comparison && <span className="status-tag">Shared</span>}
              </div>
              <div className="two-cols">
                <Field
                  label="Starting taxable investments"
                  unit="USD"
                  value={state.shared.starting}
                  onChange={(v) => shared("starting", v)}
                  error={errors.starting}
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
              <div className="section-label">
                <h3>Starting balances</h3>
                {state.comparison && <span className="status-tag">Shared</span>}
              </div>
              <div className="two-cols">
                <NumberField
                  label="Starting traditional 401(k) balance"
                  value={state.shared.startingRetirement}
                  onChange={(v) => shared("startingRetirement", v)}
                  error={errors.startingRetirement}
                />
                <NumberField
                  label="Starting HSA balance"
                  value={state.shared.startingHsa}
                  onChange={(v) => shared("startingHsa", v)}
                  error={errors.startingHsa}
                />
              </div>
              <p className="hint">Include balances from old employers. These household starting assets grow even when new contributions are zero. <a href="#starting-employer-shares">Edit starting employer shares</a> in the equity section; shares are counted once.</p>
              <AutoDetails
                hasErrors={
                  !!(
                    errors.startYear ||
                    errors.taxInflation ||
                    errors.startingRetirement ||
                    errors.startingHsa ||
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
                    The investment return applies to taxable investments, 401(k)
                    and HSA balances. Employer share appreciation is set
                    separately. All returns represent unrealized appreciation;
                    dividends, realized investment gains and withdrawals are not
                    modeled.
                  </p>
                </div>
              </AutoDetails>
            </section>
            <p className="example-note">
              Default offers and promotion timing are illustrative, not verified
              city averages or career predictions. Tax rules and reported
              vesting templates have linked sources.
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
            <div className="disclosures">
              <details>
                <summary>How this works</summary>
                <div className="details-body prose">
                  <p>
                    The model starts January 1 of the chosen year. Career
                    changes take effect at the beginning of their selected
                    month. Base pay grows on role anniversaries; explicit
                    promotion pay replaces that month’s raise. Annual bonus
                    targets accrue for active months and are paid in December.
                    Spouse wages are spread evenly across months in joint-filing
                    household scenarios.
                  </p>
                  <p>
                    Each nonnegative opening investment balance earns the
                    monthly equivalent of your annual return assumption. Cash
                    surplus, sold-equity proceeds, and retirement/HSA
                    contributions and estimated employer matching enter at month-end. Unfunded cash shortfalls
                    earn no return and are not modeled loans. Held shares and
                    retirement assets are never automatically liquidated to fund
                    living costs.
                  </p>
                  <p>
                    Each RSU award has a fixed share count established from a
                    total grant value and grant-date price, or entered directly.
                    Month 1 means the end of its grant month; month 12 means the
                    end of the 12th month. Historical vests are excluded from
                    new contributions. New grants, refreshers and old grants can
                    overlap; unvested awards are forfeited on departure unless
                    individually retained.
                  </p>
                  <p>
                    All vested RSUs enter taxable compensation, whether sold or
                    held. Annual tax liability is calculated with and without
                    equity; the difference is allocated across vests by value.
                    Hold treatment sells enough shares to cover this estimated
                    liability and retains the remainder. Price appreciation on
                    held shares is unrealized and is included once in their
                    value. Grant value is not added again.
                  </p>
                  <p>
                    Calculated taxes cover the selected full-year resident/work
                    location, standard deductions, single or married-joint
                    filing, and the disclosed W-2 assumptions. Future indexed
                    parameters use your inflation assumption; other thresholds
                    stay fixed. This projects 2026 law, not future enacted laws.
                    Tax reserves are not paycheck withholding. Manual mode
                    retains a user-entered total effective rate.
                  </p>
                  <p>
                    Qualifying payroll health/HSA and traditional 401(k)
                    contributions have distinct tax bases and annual limits.
                    Healthcare budgets include premiums; premiums already paid
                    through payroll are removed once from living expenses.
                    Contribution targets are limited to available monthly cash
                    wages. California adds HSA deductions back for state income
                    tax and SDI.
                  </p>
                  <p>
                    Balances are nominal future dollars before future sale or
                    withdrawal taxes. The model excludes options, later stock
                    sales, investment dividends/realized gains, HSA
                    reimbursements, retirement withdrawals/catch-ups,
                    itemized or family/earned-income credits, self-employment,
                    interstate income allocation, other assets/liabilities and
                    Monte Carlo simulation. Returns, share appreciation and
                    career progression are assumptions, not guarantees.
                  </p>
                </div>
              </details>
              <details>
                <summary>About these estimates</summary>
                <div className="details-body prose">
                  <p>
                    Company cash-pay references are a small static snapshot of
                    reported US-wide software engineer averages from{" "}
                    <a
                      href="https://www.levels.fyi"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Levels.fyi
                    </a>
                    , accessed October 27, 2026. They are not city-specific
                    offers or guaranteed pay. Annualized stock averages do not
                    establish actual grant amounts; those must be entered
                    separately. Google and some level compensation presets
                    remain omitted where comparable recurring figures could not
                    be verified.
                  </p>
                  <p>
                    Vesting presets are reported examples with source dates and
                    editable schedules. Multiple schedules can exist at one
                    company. Historical Amazon 5/15/40/40 and front-loaded
                    Google examples are clearly labeled; your grant agreement
                    determines your actual terms. CareerWorth is not affiliated
                    with Levels.fyi or the companies.
                  </p>
                  <p>
                    Location budgets are derived 2026 minimum-needs estimates
                    from the{" "}
                    <a
                      href="https://livingwage.mit.edu"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Living Wage Institute
                    </a>
                    , updated February 15, 2026 and accessed October 27, 2026.
                    They describe one renting adult without children and are not
                    average discretionary spending. Joint households should edit
                    these amounts. Budgets use county data; New York uses
                    Manhattan.
                  </p>
                  <ul className="source-list">
                    {locationPresets.map((p) => (
                      <li key={p.id}>
                        <a href={p.source} target="_blank" rel="noreferrer">
                          {p.label}
                        </a>{" "}
                        — {p.scope}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Housing combines published housing and internet/mobile
                    costs; other combines civic and other necessities.
                    Categories are converted from annual amounts to monthly
                    cents. Income-tax rows are excluded. Applying a budget
                    changes expenses only; tax location and compensation remain
                    independent. Default $3,000/$4,500 budgets are illustrative
                    until a preset is explicitly applied.
                  </p>
                  <p>
                    Official tax sources and coverage are listed in the Taxes
                    editor. See the{" "}
                    <a
                      href="https://livingwage.mit.edu/pages/methodology"
                      target="_blank"
                      rel="noreferrer"
                    >
                      budget methodology
                    </a>{" "}
                    and{" "}
                    <a
                      href="https://livingwage.mit.edu/pages/faqs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      reuse guidance
                    </a>
                    . Six source locations are used; no scraper or runtime data
                    feed is included.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </div>
        <RetirementGuide />
        <footer>
          <p>
            ◈ Your inputs stay in this browser. No accounts, analytics, or data
            uploads.
          </p>
          <p className={storageMessage ? "storage-warning" : ""} role="status">
            {storageMessage ||
              (ready
                ? "Valid inputs are saved automatically on this device."
                : "Only valid inputs are saved.")}
          </p>
          <span>CareerWorth · A planning tool, not financial advice.</span>
        </footer>
      </main>
    </>
  );
}
