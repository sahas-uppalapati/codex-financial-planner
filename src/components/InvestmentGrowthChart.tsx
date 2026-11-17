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
            row.forfeitedMatch;
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
        const values = points.flatMap((point) => [point.added, point.growth]);
        const min = Math.min(0, ...values);
        const max = Math.max(0, ...values);
        const span = max - min || 1;
        const low = min < 0 ? min - span * 0.08 : 0;
        const high = max > 0 ? max + span * 0.08 : 1;
        const y = (value: number) =>
          bottom - ((value - low) / (high - low)) * (bottom - top);
        const groupWidth = (right - left) / points.length;
        const barWidth = Math.min(22, groupWidth * 0.28);
        const zeroY = y(0);
        const title = `${scenario.name} money added and investment growth`;

        return (
          <div className="investment-growth-chart" key={scenario.index}>
            {series.length > 1 && <h4>{scenario.name}</h4>}
            <div
              className="growth-chart-scroll"
              ref={
                scenario.index === series[0].index ? scrollRef : undefined
              }
              role="region"
              aria-label={`${scenario.name} cumulative additions and investment growth`}
              tabIndex={0}
            >
              <svg
                className="growth-chart-svg"
                width={chartWidth}
                height="258"
                viewBox={`0 0 ${chartWidth} 258`}
                role="img"
                aria-label={title}
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
                  const bars = [
                    { key: "added", value: point.added, color: "var(--positive-text)" },
                    { key: "growth", value: point.growth, color: "var(--series-1)" },
                  ];
                  return (
                    <g key={point.year}>
                      {bars.map((bar, barIndex) => {
                        const barY = y(bar.value);
                        const x = center + (barIndex === 0 ? -barWidth - 2 : 2);
                        return (
                          <rect
                            key={bar.key}
                            x={x}
                            y={Math.min(zeroY, barY)}
                            width={barWidth}
                            height={Math.max(1, Math.abs(zeroY - barY))}
                            rx="2"
                            fill={bar.color}
                          >
                          <title>
                            {`${point.year} · ${
                              bar.key === "added"
                                ? "Money added so far"
                                : "Investment growth so far"
                            }: ${money(bar.value)}`}
                          </title>
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
            <div className="growth-chart-legend">
              <span>
                <i className="growth-legend-swatch added" aria-hidden="true" />
                Money added so far
              </span>
              <span>
                <i className="growth-legend-swatch growth" aria-hidden="true" />
                Investment growth so far
              </span>
              <span>Starting balance: {money(scenario.projection.startingTotal)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
