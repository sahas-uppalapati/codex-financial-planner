import type { ScenarioV2, AssumptionsV2 } from "../lib/planner";
import { computeVestingSchedule } from "../lib/techComp";
import { money } from "../lib/format";

interface TechRealityCardProps {
  scenario: ScenarioV2;
  assumptions?: AssumptionsV2;
}

export function TechRealityCard({ scenario }: TechRealityCardProps) {
  const annualRsu = Number(scenario.stock) || 0;
  const primaryGrant = scenario.grants?.[0];
  const grantSchedule = primaryGrant?.schedule;
  const totalGrantValue = Number(primaryGrant?.value) || annualRsu * 4;
  const vestingYears = computeVestingSchedule(annualRsu, grantSchedule, totalGrantValue);

  const signOnY1 = Number(scenario.signOnY1) || 0;
  const signOnY2 = Number(scenario.signOnY2) || 0;
  const totalSignOn = signOnY1 + signOnY2;

  if (annualRsu <= 0 && totalSignOn <= 0) {
    return null;
  }

  return (
    <section className="cash-panel tech-breakdown-panel" aria-label="Equity vesting details">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">EQUITY VESTING</p>
          <h2 id="vesting-heading">4-Year Equity Vesting Schedule</h2>
        </div>
        <div className="summary-chips">
          {annualRsu > 0 && <span>Total Grant: <strong>{money(totalGrantValue)}</strong></span>}
          {totalSignOn > 0 && (
            <>
              <span className="dot-sep">·</span>
              <span>Sign-on: <strong>{money(totalSignOn)}</strong></span>
            </>
          )}
        </div>
      </div>

      <div className="tech-breakdown-body">
        <div className="condensed-vesting-section">
          <div className="condensed-vesting-grid">
            {vestingYears.map((v) => {
              const yearSignOn = v.year === 1 ? signOnY1 : v.year === 2 ? signOnY2 : 0;
              return (
                <div className="condensed-vesting-col" key={v.year}>
                  <span className="col-year">Year {v.year}</span>
                  <strong className="col-value">{money(v.value)}</strong>
                  <span className="col-pct">{v.percent}%</span>
                  {yearSignOn > 0 && (
                    <span className="col-signon">+{money(yearSignOn)} sign-on</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
