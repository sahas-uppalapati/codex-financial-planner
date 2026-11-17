import { locationPresets } from "../data/presets";
import {
  analyticsConfigured,
  disableAnalytics,
  enableAnalytics,
} from "../lib/analytics";

export function AppFooter({
  ready,
  storageMessage,
  analyticsEnabled,
  onAnalyticsToggle,
}: {
  ready: boolean;
  storageMessage: string;
  analyticsEnabled: boolean;
  onAnalyticsToggle: (enabled: boolean) => void;
}) {
  return (
    <>
      <p><a style={{ textDecoration: "underline" }} href="https://github.com/sahas-uppalapati/codex-financial-planner/issues">Feedback and accessibility contact</a> (please do not include financial inputs).</p>
      <div className="disclosures">
        <details>
          <summary>How this works</summary>
          <div className="details-body prose">
            <p>
              The model starts January 1 of the chosen year. Career changes take
              effect at the beginning of their selected month. Base pay grows on
              role anniversaries; explicit promotion pay replaces that month’s
              raise. Annual bonus targets accrue for active months and are paid in
              December. Spouse wages are spread evenly across months in
              joint-filing household scenarios.
            </p>
            <p>
              Each nonnegative opening investment balance earns the monthly
              equivalent of your annual return assumption. Cash surplus,
              sold-equity proceeds, and retirement/HSA contributions and
              estimated employer matching enter at month-end. Unfunded cash
              shortfalls earn no return and are not modeled loans. Held shares and
              retirement assets are never automatically liquidated to fund living
              costs.
            </p>
            <p>
              Each RSU award has a fixed share count established from a total
              grant value and grant-date price, or entered directly. Month 1
              means the end of its grant month; month 12 means the end of the
              12th month. Historical vests are excluded from new contributions.
              New grants, refreshers and old grants can overlap; unvested awards
              are forfeited on departure unless individually retained.
            </p>
            <p>
              All vested RSUs enter taxable compensation, whether sold or held.
              Annual tax liability is calculated with and without equity; the
              difference is allocated across vests by value. Hold treatment sells
              enough shares to cover this estimated liability and retains the
              remainder. Price appreciation on held shares is unrealized and is
              included once in their value. Grant value is not added again.
            </p>
            <p>
              Calculated taxes cover the selected full-year resident/work
              location, standard deductions, single or married-joint filing, and
              the disclosed W-2 assumptions. Future indexed parameters use your
              inflation assumption; other thresholds stay fixed. This projects
              2026 law, not future enacted laws. Tax reserves are not paycheck
              withholding. Manual mode retains a user-entered total effective
              rate.
            </p>
            <p>
              Qualifying payroll health/HSA and traditional 401(k) contributions
              have distinct tax bases and annual limits. Healthcare budgets
              include premiums; premiums already paid through payroll are removed
              once from living expenses. Contribution targets are limited to
              available monthly cash wages. California adds HSA deductions back
              for state income tax and SDI.
            </p>
            <p>
              Balances are nominal future dollars before future sale or withdrawal
              taxes. The model excludes options, later stock sales, investment
              dividends/realized gains, HSA reimbursements, retirement
              withdrawals, itemized or family/earned-income credits,
              self-employment, interstate income allocation, other
              assets/liabilities and Monte Carlo simulation. Returns, share
              appreciation and career progression are assumptions, not
              guarantees.
            </p>
          </div>
        </details>
        <details>
          <summary>About these estimates</summary>
          <div className="details-body prose">
            <p>
              Company cash-pay references are a small static snapshot of reported
              US-wide software engineer averages from{" "}
              <a href="https://www.levels.fyi" target="_blank" rel="noreferrer">
                Levels.fyi
              </a>
              , accessed October 27, 2026. They are not city-specific offers or
              guaranteed pay. Annualized stock averages do not establish actual
              grant amounts; those must be entered separately. Google and some
              level compensation presets remain omitted where comparable recurring
              figures could not be verified.
            </p>
            <p>
              Vesting presets are reported examples with source dates and editable
              schedules. Multiple schedules can exist at one company. Historical
              Amazon 5/15/40/40 and front-loaded Google examples are clearly
              labeled; your grant agreement determines your actual terms.
              CareerWorth is not affiliated with Levels.fyi or the companies.
            </p>
            <p>
              Location budgets are derived 2026 minimum-needs estimates from the{" "}
              <a
                href="https://livingwage.mit.edu"
                target="_blank"
                rel="noreferrer"
              >
                Living Wage Institute
              </a>
              , updated February 15, 2026 and accessed October 27, 2026. They
              describe one renting adult without children and are not average
              discretionary spending. Joint households should edit these amounts.
              Budgets use county data; New York uses Manhattan.
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
              Housing combines published housing and internet/mobile costs; other
              combines civic and other necessities. Categories are converted from
              annual amounts to monthly cents. Income-tax rows are excluded.
              Applying a budget changes expenses only; tax location and
              compensation remain independent. Default $3,000/$4,500 budgets are
              illustrative until a preset is explicitly applied.
            </p>
            <p>
              Official tax sources and coverage are listed in the Taxes editor.
              See the{" "}
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
              . Seven source locations are used; no scraper or runtime data feed is
              included.
            </p>
          </div>
        </details>
      </div>
      <footer>
        <p>
          ◈ Your planner inputs stay securely in this browser. Optional analytics only records basic actions and never transmits sensitive user data. CareerWorth provides deterministic planning estimates only and does not constitute formal financial, investment, tax, legal, or benefits advice.
        </p>
        {analyticsConfigured() && (
          <p className="analytics-preference">
            Analytics are {analyticsEnabled ? "on" : "off"}.{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                if (analyticsEnabled) {
                  disableAnalytics();
                  onAnalyticsToggle(false);
                } else {
                  onAnalyticsToggle(enableAnalytics());
                }
              }}
            >
              {analyticsEnabled
                ? "Turn off analytics"
                : "Allow anonymous analytics"}
            </button>
          </p>
        )}
        <p className={storageMessage ? "storage-warning" : ""} role="status">
          {storageMessage ||
            (ready
              ? "Valid inputs are saved automatically on this device."
              : "Only valid inputs are saved.")}
        </p>
        <nav aria-label="Policies">
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms and copyright</a>
          <a href="/accessibility.html">Accessibility</a>
        </nav>
        <a href="/guide/">How CareerWorth works</a>
      </footer>
    </>
  );
}
