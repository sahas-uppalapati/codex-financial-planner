import startupExamples from "../data/startupExamples.json";
import { money } from "../lib/format";
import { Input } from "./ui/input";
import { useState } from "react";
import type { Projection } from "../lib/projection";
import {
  fullGrantPaperSpread,
  startupComparison,
  type StartupInputs,
} from "../lib/startupComparison";

const entries: { key: "grant" | "strike"; label: string; hint: string }[] = [
  {
    key: "grant",
    label: "Number of options",
    hint: "The full option grant, before vesting.",
  },
  {
    key: "strike",
    label: "Strike price per option ($)",
    hint: "The price you pay to exercise one option.",
  },
];

export function StartupFields({
  enabled,
  onToggle,
  input,
  onChange,
  onApplyExample,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  input: StartupInputs;
  onChange: (input: StartupInputs) => void;
  onApplyExample: (offer: (typeof startupExamples.offers)[number]) => void;
}) {
  const [example, setExample] = useState("");
  const selectedOffer = startupExamples.offers.find((offer) => offer.id === example);
  return (
    <div className="startup-editor">
      <label className="startup-confirm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />{" "}
        This is a startup offer
      </label>
      {enabled && (
        <>
          <p className="hint">
            Preset stock and promotions are excluded. Review the salary,
            benefits and other details below.
          </p>
          <div className="startup-field">
            <label htmlFor="startup-example">Illustrative startup offer</label>
            <select
              id="startup-example"
              value={example}
              onChange={(e) => setExample(e.target.value)}
            >
              <option value="">Choose an offer</option>
              {startupExamples.offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.label} · {money(Number(offer.base))} base
                </option>
              ))}
            </select>
            <button
              className="secondary small"
              type="button"
              disabled={!selectedOffer}
              onClick={() => selectedOffer && onApplyExample(selectedOffer)}
            >
              Apply offer
            </button>
            <p className="hint">Replaces pay, match and startup details.</p>
            <details className="startup-preset-note">
              <summary>Sources and assumptions</summary>
              <p className="hint">
                Also replaces the scenario name and salary growth. Uses invented
                option terms, no bonus or raises, and a four-year vest with a
                one-year cliff. Living costs, grants, tax location and career
                events are retained. Salary figures use{" "}
                <a
                  href={startupExamples.source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {startupExamples.source.name}
                </a>
                ; option counts and prices are fictional, not benchmarks.
              </p>
            </details>
          </div>
          {entries.map(({ key, label, hint }) => (
            <div className="startup-field" key={key}>
              <label htmlFor={`startup-${key}`}>{label}</label>
              <Input
                id={`startup-${key}`}
                type="number"
                min="0"
                step={key === "grant" ? "1" : "any"}
                value={input[key]}
                onChange={(e) => onChange({ ...input, [key]: e.target.value })}
              />
              <span className="hint">{hint}</span>
            </div>
          ))}
          <details className="startup-optional">
            <summary>Current share price (optional)</summary>
            <div className="startup-field">
              <label htmlFor="startup-current-price">
                Current quoted share price ($), if known
              </label>
              <Input
                id="startup-current-price"
                type="number"
                min="0"
                step="any"
                value={input.currentPrice}
                onChange={(e) =>
                  onChange({ ...input, currentPrice: e.target.value })
                }
              />
              <label htmlFor="startup-price-type">What price is this?</label>
              <select
                id="startup-price-type"
                value={input.currentPriceType}
                onChange={(e) =>
                  onChange({
                    ...input,
                    currentPriceType: e.target
                      .value as StartupInputs["currentPriceType"],
                  })
                }
              >
                <option value="unknown">Not sure</option>
                <option value="common">409A common-share value</option>
                <option value="preferred">
                  Preferred-share financing price
                </option>
              </select>
              <span className="hint">
                A preferred financing price is not the value of your common
                shares. Confirm the price type and valuation date with the
                company.
              </span>
            </div>
          </details>
          <div className="startup-field">
            <label htmlFor="startup-vesting">Vesting schedule</label>
            <select
              id="startup-vesting"
              value={input.vesting}
              onChange={(e) => onChange({ ...input, vesting: e.target.value })}
            >
              <option value="">Unknown</option>
              <option value="cliff">4 years, 1-year cliff then monthly</option>
              <option value="monthly">4 years, monthly without cliff</option>
              <option value="5-cliff">
                5 years, 1-year cliff then monthly
              </option>
              <option value="5-monthly">5 years, monthly without cliff</option>
              <option value="custom">Custom: even monthly vesting</option>
            </select>
            <span className="hint">
              Assumes you remain employed until the exit. Choose the schedule
              matching the grant.
            </span>
          </div>
          {input.vesting === "custom" && (
            <>
              <div className="startup-field">
                <label htmlFor="startup-duration">
                  Vesting duration (months)
                </label>
                <Input
                  id="startup-duration"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  value={input.vestMonths}
                  onChange={(e) =>
                    onChange({ ...input, vestMonths: e.target.value })
                  }
                />
              </div>
              <div className="startup-field">
                <label htmlFor="startup-cliff">
                  Cliff (months; enter 0 for none)
                </label>
                <Input
                  id="startup-cliff"
                  type="number"
                  min="0"
                  max="120"
                  step="1"
                  value={input.cliffMonths}
                  onChange={(e) =>
                    onChange({ ...input, cliffMonths: e.target.value })
                  }
                />
                <span className="hint">
                  The accumulated portion vests at the cliff, then the remainder
                  vests evenly each month.
                </span>
              </div>
            </>
          )}
          <details className="startup-optional">
            <summary>Explore a hypothetical exit</summary>
            <div className="startup-field">
              <label htmlFor="startup-exit-mode">
                Illustrate an exit using
              </label>
              <select
                id="startup-exit-mode"
                value={input.exitMode}
                onChange={(e) =>
                  onChange({
                    ...input,
                    exitMode: e.target.value as StartupInputs["exitMode"],
                    exit: "",
                  })
                }
              >
                <option value="share">Future common-share price</option>
                <option value="company">
                  Value available to common shareholders
                </option>
              </select>
            </div>
            <div className="startup-field">
              <label htmlFor="startup-exit">
                {input.exitMode === "share"
                  ? "Hypothetical common-share price ($)"
                  : "Hypothetical value for common shareholders ($)"}
              </label>
              <Input
                id="startup-exit"
                type="number"
                min="0"
                step="any"
                value={input.exit}
                onChange={(e) => onChange({ ...input, exit: e.target.value })}
              />
              <span className="hint">
                Optional. Enter 0 for a no-payout case.{" "}
                {input.exitMode === "share"
                  ? "This is a future common-share price, not the current preferred-share price."
                  : "Enter value after senior claims, not the headline company valuation."}
              </span>
            </div>
            {input.exitMode === "company" && (
              <>
                <div className="startup-field">
                  <label htmlFor="startup-ownership">
                    Grant ownership (% fully diluted)
                  </label>
                  <Input
                    id="startup-ownership"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={input.ownership}
                    onChange={(e) =>
                      onChange({ ...input, ownership: e.target.value })
                    }
                  />
                  <span className="hint">
                    Ask the company for the percentage of fully diluted shares
                    represented by the full grant.
                  </span>
                </div>
                <div className="startup-field">
                  <label htmlFor="startup-dilution">Future dilution (%)</label>
                  <Input
                    id="startup-dilution"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={input.dilution}
                    onChange={(e) =>
                      onChange({ ...input, dilution: e.target.value })
                    }
                  />
                  <span className="hint">
                    Total assumed reduction in ownership by exit; enter 0 if
                    assuming none.
                  </span>
                </div>
              </>
            )}
          </details>
          <p className="hint">
            Startup details are saved in this browser and included in backups
            and share links. They are separate from CSV exports and portfolio
            balances.
          </p>
        </>
      )}
    </div>
  );
}

export function StartupComparison({
  series,
  startup,
  input,
}: {
  series: { name: string; projection: Projection }[];
  startup: number | null;
  input: StartupInputs;
}) {
  if (startup === null || startup >= series.length) return null;
  const years = series[0].projection.rows.length;
  const gross = (projection: Projection) =>
    projection.rows.reduce(
      (sum, row) => sum + row.cashGross - row.spouseCash + row.stockGross,
      0,
    );
  const startupComp = gross(series[startup].projection);
  const alternativeComp =
    series.length > 1 ? gross(series[1 - startup].projection) : null;
  const result =
    alternativeComp === null
      ? null
      : startupComparison(input, years, startupComp, alternativeComp);
  const hasStock = series[startup].projection.rows.some(
    (row) => row.stockGross > 0,
  );
  const paperSpread = fullGrantPaperSpread(input);
  return (
    <section
      className="startup-card startup-integrated"
      aria-labelledby="startup-comparison-heading"
    >
      <p className="eyebrow">STARTUP EQUITY</p>
      <h2 id="startup-comparison-heading">Hypothetical startup proceeds</h2>
      {paperSpread !== null && (
        <p>
          At the entered 409A value, the full grant has an illustrative paper
          spread of {money(paperSpread)} before taxes and fees, assuming all
          options vest. It is not cash or a sale price.
        </p>
      )}
      <details>
        <summary>Startup assumptions and limitations</summary>
        {input.currentPrice.trim() && input.currentPriceType !== "common" && (
          <p className="hint">
            The quoted price is{" "}
            {input.currentPriceType === "preferred"
              ? "for preferred shares"
              : "not identified as a common-share value"}
            , so it is not used to value your options. Confirm the price type
            with the company.
          </p>
        )}
        <p>
          Illustration only, before taxes and fees. Exit value means value
          distributed to common shareholders, not headline acquisition price.
          Preferences, debt, transaction terms, taxes, expiry, exercise timing
          and future grants can change results. This excludes employer match and
          benefits, probability, investment returns on compensation and time
          value of money.
        </p>
        {!input.ownership.trim() && (
          <p>
            Ownership is unknown. The percentage of fully diluted shares is
            needed to connect a company exit value to your payout.
          </p>
        )}
        {hasStock && (
          <p>
            The startup scenario includes stock in the projection. Set RSUs and
            grants to zero if they represent these private options, to avoid
            counting equity twice.
          </p>
        )}
      </details>
      {series.length < 2 ? (
        <p>
          Add a comparison scenario to compare startup options against another
          offer.
        </p>
      ) : (
        <>
          <p>
            Compares hypothetical proceeds with the modeled compensation gap
            over {years} {years === 1 ? "year" : "years"}. Change the projection
            length to change the exit year.
          </p>
          {result ? (
            <div className="startup-outcome" aria-live="polite">
              <h3>Hypothetical outcome at year {years}</h3>
              <p>
                Modeled gross compensation:{" "}
                <strong>{money(startupComp)}</strong> for{" "}
                {series[startup].name || "the startup"} and{" "}
                <strong>{money(alternativeComp!)}</strong> for{" "}
                {series[1 - startup].name || "the other offer"}.{" "}
                {result.gap > 0
                  ? `The startup starts ${money(result.gap)} behind.`
                  : `The startup starts ${money(-result.gap)} ahead.`}
              </p>
              <p>
                At exit, an estimated{" "}
                <strong>
                  {result.vestedOptions.toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  options
                </strong>{" "}
                are vested; exercising them costs{" "}
                <strong>{money(result.exercise)}</strong>.
              </p>
              <p>
                {result.breakEvenShare === null ? (
                  "Break-even cannot be reached with no vested options."
                ) : result.breakEvenShare === 0 ? (
                  "The startup’s modeled compensation already meets or exceeds the other offer without an equity payout."
                ) : (
                  <>
                    A future common-share price of{" "}
                    <strong>
                      {result.breakEvenShare.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </strong>{" "}
                    would close the compensation gap before taxes and fees.
                  </>
                )}
              </p>
              {result.proceeds !== null && result.difference !== null ? (
                <p>
                  At the entered{" "}
                  {input.exitMode === "share"
                    ? "share price"
                    : "common-share exit value"}
                  , hypothetical proceeds after exercise cost are{" "}
                  <strong>{money(result.proceeds)}</strong>. Combined with
                  modeled compensation, the startup is{" "}
                  <strong>
                    {money(Math.abs(result.difference))}{" "}
                    {result.difference >= 0 ? "ahead" : "behind"}
                  </strong>
                  .
                </p>
              ) : (
                <p>
                  Enter a valid{" "}
                  {input.exitMode === "share"
                    ? "future common-share price"
                    : "common-share exit value, ownership and dilution"}{" "}
                  to illustrate proceeds.
                </p>
              )}
              {input.exitMode === "company" && result.fraction !== null && (
                <p>
                  Assumed vested ownership after dilution:{" "}
                  {(result.fraction * 100).toFixed(4)}%.{" "}
                  {result.breakEvenCompany !== null &&
                    result.breakEvenCompany > 0 &&
                    `The implied common-share exit value needed to close the gap is ${money(result.breakEvenCompany)}.`}
                </p>
              )}
            </div>
          ) : (
            <p className="hint">
              Enter an option count, strike price, and valid vesting schedule to
              calculate exercise cost and per-share break-even. Use a positive
              whole option count and nonnegative strike. Custom durations must
              be 1–120 whole months, with a cliff no longer than the duration.
            </p>
          )}
        </>
      )}
    </section>
  );
}
