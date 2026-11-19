import { useEffect, useRef, useState } from "react";
import type { Projection } from "../lib/projection";
import { compactMoney, money } from "../lib/format";

export function InvestmentGrowthChart({
  series,
}: {
  series: { name: string; index: number; projection: Projection }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setContainerWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="investment-growth-charts">
      {series.map((scenario) => {
        let cumulativeAdded = 0;
        let cumulativeGrowth = 0;
        let previousUnvestedMatch = 0;
        const points = scenario.projection.rows.map((row) => {
          const added =
            row.surplus +
            row.stockContribution +
            row.heldContribution +
            row.retirementContribution +
            row.roth401kContribution +
            row.hsaContribution +
            row.traditionalIraContribution +
            row.rothIraContribution +
            row.megaBackdoorContribution +
            row.employerMatch -
            row.forfeitedMatch -
            (row.unvestedMatch - previousUnvestedMatch);
          previousUnvestedMatch = row.unvestedMatch;
          const growth = row.endingBalance - row.openingBalance - added;
          cumulativeAdded += added;
          cumulativeGrowth += growth;
          return {
            year: row.calendarYear,
            added: cumulativeAdded,
            growth: cumulativeGrowth,
          };
        });
        const chartWidth = Math.max(containerWidth, points.length * 72 + 76);
        const left = 64;
        const right = chartWidth - 16;
        const top = 18;
        const bottom = 226;
        const startingBalance = scenario.projection.startingTotal;
        const values = points.flatMap((point) => [
          startingBalance,
          startingBalance + point.added,
          startingBalance + point.added + point.growth,
        ]);
        const min = Math.min(0, ...values);
        const max = Math.max(0, ...values);
        const span = max - min || 1;
        const low = min < 0 ? min - span * 0.08 : 0;
        const high = max > 0 ? max + span * 0.08 : 1;
        const y = (value: number) =>
          bottom - ((value - low) / (high - low)) * (bottom - top);
        const groupWidth = (right - left) / points.length;
        const barWidth = Math.min(34, groupWidth * 0.58);
        const zeroY = y(0);
        const title = `${scenario.name} money added and investment growth`;
        const activePoint =
          points.find((point) => point.year === hoveredYear) ?? points.at(-1);
        const totalAt = (point: (typeof points)[number]) =>
          startingBalance + point.added + point.growth;

        return (
          <div className="investment-growth-chart" key={scenario.index}>
            {series.length > 1 && <h4>{scenario.name}</h4>}
            <div
              className="growth-chart-scroll"
              ref={
                scenario.index === series[0].index ? scrollRef : undefined
              }
              role="region"
              aria-label={`${scenario.name} projected balances split into starting balance, additions, and investment growth`}
              tabIndex={0}
            >
              <svg
                className="growth-chart-svg"
                width={chartWidth}
                height="258"
                viewBox={`0 0 ${chartWidth} 258`}
                role="img"
                aria-label={title}
                onPointerLeave={() => setHoveredYear(null)}
              >
                {[0, 1, 2, 3, 4].map((tick) => {
                  const value = low + ((high - low) * tick) / 4;
                  const tickY = y(value);
                  return (
                    <g key={tick}>
                      <line
                        className="grid-line"
                        x1={left}
                        x2={right}
                        y1={tickY}
                        y2={tickY}
                      />
                      <text x={left - 8} y={tickY + 4} textAnchor="end">
                        {compactMoney(value)}
                      </text>
                    </g>
                  );
                })}
                <line
                  x1={left}
                  x2={right}
                  y1={zeroY}
                  y2={zeroY}
                  stroke="var(--border)"
                />
                {points.map((point, index) => {
                  const center = left + groupWidth * (index + 0.5);
                  const isActive = hoveredYear === point.year;
                  const segments = [
                    { key: "starting", value: startingBalance, color: "var(--series-0)" },
                    { key: "added", value: point.added, color: "var(--positive-text)" },
                    { key: "growth", value: point.growth, color: "var(--series-1)" },
                  ];
                  return (
                    <g
                      key={point.year}
                      className="growth-year-group"
                      onPointerEnter={() => setHoveredYear(point.year)}
                    >
                      <rect
                        className="growth-year-hit-area"
                        x={left + groupWidth * index}
                        y={top}
                        width={groupWidth}
                        height={bottom - top}
                        aria-hidden="true"
                      />
                      {isActive && (
                        <line
                          className="growth-hover-guide"
                          x1={center}
                          x2={center}
                          y1={top}
                          y2={bottom}
                        />
                      )}
                      {segments.map((segment, segmentIndex) => {
                        const lower =
                          segmentIndex === 0
                            ? 0
                            : segments
                                .slice(0, segmentIndex)
                                .reduce((sum, prior) => sum + prior.value, 0);
                        const upper = lower + segment.value;
                        const lowerY = y(lower);
                        const upperY = y(upper);
                        return (
                          <rect
                            key={segment.key}
                            x={center - barWidth / 2}
                            y={Math.min(lowerY, upperY)}
                            width={barWidth}
                            height={Math.max(1, Math.abs(lowerY - upperY))}
                            rx={segmentIndex === segments.length - 1 ? "2" : "0"}
                            fill={segment.color}
                            className="growth-bar"
                          >
                            <title>{`${point.year} · ${segment.key}: ${money(segment.value)}`}</title>
                          </rect>
                        );
                      })}
                      <text
                        x={center}
                        y="248"
                        textAnchor="middle"
                        className="growth-year-label"
                      >
                        {point.year}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            {activePoint && (
              <div className="growth-chart-inspector" aria-live="polite">
                <strong>{activePoint.year}</strong>
                <span>Total balance <b>{money(totalAt(activePoint))}</b></span>
                <span>Starting balance <b>{money(startingBalance)}</b></span>
                <span>Money added <b>{money(activePoint.added)}</b></span>
                <span>Investment growth <b>{money(activePoint.growth)}</b></span>
              </div>
            )}
            <details>
              <summary>View chart values</summary>
              <table>
                <thead><tr><th scope="col">Year</th><th scope="col">Starting balance</th><th scope="col">Money added so far</th><th scope="col">Investment growth so far</th><th scope="col">Total balance</th></tr></thead>
                <tbody>{points.map((point) => <tr key={point.year}><th scope="row">{point.year}</th><td>{money(startingBalance)}</td><td>{money(point.added)}</td><td>{money(point.growth)}</td><td>{money(totalAt(point))}</td></tr>)}</tbody>
              </table>
            </details>
            <p className="hint">Money added includes changes in vested employer match, including gains accrued before vesting.</p>
            <div className="growth-chart-legend">
              <span>
                <i className="growth-legend-swatch starting" aria-hidden="true" />
                Starting balance
              </span>
              <span>
                <i className="growth-legend-swatch added" aria-hidden="true" />
                Money added so far
              </span>
              <span>
                <i className="growth-legend-swatch growth" aria-hidden="true" />
                Investment growth so far
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
