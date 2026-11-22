import { useEffect, useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { compactMoney, money } from "../lib/format";
export interface Series {
  name: string;
  rows: {
    endingBalance: number;
    surplus?: number;
    stockContribution?: number;
    heldContribution?: number;
    retirementContribution?: number;
    roth401kContribution?: number;
    hsaContribution?: number;
    traditionalIraContribution?: number;
    rothIraContribution?: number;
    megaBackdoorContribution?: number;
    vestedEmployerMatch?: number;
    calendarYear?: number;
  }[];
  starting?: number;
  yearContext?: string[];
  markers?: { year: number; label: string }[];
  index: number;
}
export function ProjectionChart({
  series,
  starting,
}: {
  series: Series[];
  starting: number;
}) {
  const id = useId(),
    [selected, setSelected] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setCompact(entry.contentRect.width < 480),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const plot = compact
    ? { width: 400, left: 52, right: 382 }
    : { width: 700, left: 75, right: 670 };
  const plotSpan = plot.right - plot.left;
  const years = series[0].rows.length;
  const balances = series.map((s) => [
    s.starting ?? starting,
    ...s.rows.map((r) => r.endingBalance),
  ]);
  const contributions = series.map((s) => {
    let total = s.starting ?? starting;
    return [
      s.starting ?? starting,
      ...s.rows.map((row) => {
        const added =
          Math.max(0, row.surplus ?? 0) +
          (row.stockContribution ?? 0) +
          (row.heldContribution ?? 0) +
          (row.retirementContribution ?? 0) +
          (row.roth401kContribution ?? 0) +
          (row.hsaContribution ?? 0) +
          (row.traditionalIraContribution ?? 0) +
          (row.rothIraContribution ?? 0) +
          (row.megaBackdoorContribution ?? 0) +
          (row.vestedEmployerMatch ?? 0);
        total += added;
        return total;
      }),
    ];
  });
  const shortfalls = series.map((s) => {
    let total = 0;
    return [0, ...s.rows.map((row) => {
      total += Math.max(0, -(row.surplus ?? 0));
      return total;
    })];
  });
  const remainingPrincipal = contributions.map((line, i) =>
    line.map((value, t) => value - shortfalls[i][t]),
  );
  const min = Math.min(0, ...balances.flat()),
    max = Math.max(0, ...balances.flat(), ...contributions.flat());
  const span = max - min || 100;
  const lo = min < 0 ? min - span * 0.1 : 0,
    hi = max + span * 0.12;
  const x = (year: number) => plot.left + (year / years) * plotSpan;
  const y = (balance: number) => 278 - ((balance - lo) / (hi - lo)) * 245;
  const year = selected === null ? years : Math.min(selected, years);
  const growths = balances.map((line, i) => line.map((balance, t) => balance - remainingPrincipal[i][t]));
  const summary = series
    .map(
      (s, i) =>
        `${s.name}: starts at ${money(s.starting ?? starting)} and ends at ${money(balances[i][years])} after ${years} years.${balances[i].some((b) => b < 0) ? " Includes an unfunded shortfall." : ""}`,
    )
    .join(" ");
  const tickYears = [
    ...new Set([
      0,
      Math.round(years * 0.25),
      Math.round(years * 0.5),
      Math.round(years * 0.75),
      years,
    ]),
  ];
  function inspectPointer(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setSelected(Math.max(0, Math.min(years, Math.round((((e.clientX - box.left) / box.width) * plot.width - plot.left) / plotSpan * years))));
  }
  return (
    <div ref={container} className="chart-container">
      <p className="chart-help">Move over or tap the graph to inspect a year. Use arrow keys when focused.</p>
      <svg
        viewBox={`0 0 ${plot.width} 322`}
        role="img"
        tabIndex={0}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onPointerMove={inspectPointer}
        onPointerDown={inspectPointer}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setSelected(null); }}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          setSelected(e.key === "Home" ? 0 : e.key === "End" ? years : Math.max(0, Math.min(years, year + (e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1))));
        }}
      >
        <title id={`${id}-title`}>Projected balance, contributions, and investment growth by year</title>
        <desc id={`${id}-desc`}>
          {summary} The breakdown separates positive contributions, cash
          shortfalls, and investment growth. Nominal US dollars.
          Negative balances are unfunded shortfalls. Move over or tap the graph,
          or use arrow keys, Home and End to inspect years. Selected year {year}.
          {series.map((s, i) => ` ${s.name}: ${money(balances[i][year])}.`).join("")}
        </desc>
        <defs>
          <pattern
            id={`${id}-grid`}
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.7" fill="var(--chart-grid)" />
          </pattern>
        </defs>
        <rect
          x={plot.left}
          y="30"
          width={plotSpan}
          height="248"
          fill={`url(#${id}-grid)`}
        />
        {[0, 1, 2, 3, 4].map((i) => {
          const value = lo + ((hi - lo) * i) / 4;
          return (
            <g key={i}>
              <line
                className="grid-line"
                x1={plot.left}
                x2={plot.right}
                y1={y(value)}
                y2={y(value)}
              />
              <text x={plot.left - 12} y={y(value) + 4} textAnchor="end">
                {compactMoney(value)}
              </text>
            </g>
          );
        })}
        {min < 0 && (
          <line
            x1={plot.left}
            x2={plot.right}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
          />
        )}
        {tickYears.map((t) => (
          <text key={t} x={x(t)} y="308" textAnchor="middle">
            {t === 0 ? "Today" : `Year ${t}`}
          </text>
        ))}
        {series.flatMap((s) =>
          (s.markers ?? []).map((marker, i) => (
            <g key={`${s.index}-event-${i}`}>
              <title>{marker.label}</title>
              <line
                x1={x(marker.year)}
                x2={x(marker.year)}
                y1="26"
                y2="278"
                stroke={`var(--series-${s.index})`}
                strokeOpacity=".3"
                strokeDasharray="2 5"
              />
              <text
                x={x(marker.year)}
                y={22 - s.index * 11}
                textAnchor="middle"
              >
                {i + 1}
              </text>
            </g>
          )),
        )}
        {series.map((s, i) => (
          <g key={s.index}>
            <path
              d={`${remainingPrincipal[i].map((_, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(remainingPrincipal[i][t])}`).join(" ")} ${balances[i].slice().reverse().map((_, reverseIndex) => { const t = years - reverseIndex; return `L ${x(t)} ${y(balances[i][t])}`; }).join(" ")} Z`}
              fill="var(--series-1)"
              fillOpacity=".14"
            />
            <path
              d={`${contributions[i].map((b, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(b)}`).join(" ")} ${remainingPrincipal[i].slice().reverse().map((_, reverseIndex) => { const t = years - reverseIndex; return `L ${x(t)} ${y(remainingPrincipal[i][t])}`; }).join(" ")} Z`}
              fill="var(--warning)"
              fillOpacity=".2"
            />
            <path
              d={`${contributions[i].map((b, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(b)}`).join(" ")} L ${x(years)} ${y(0)} L ${x(0)} ${y(0)} Z`}
              fill="var(--positive-text)"
              fillOpacity=".13"
            />
            <path
              d={contributions[i].map((b, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(b)}`).join(" ")}
              fill="none"
              stroke="var(--positive-text)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={balances[i]
                .map((b, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(b)}`)
                .join(" ")}
              fill="none"
              stroke={series.length > 1 ? `var(--series-${s.index})` : "var(--series-1)"}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.index === 1 ? "7 5" : undefined}
            />
            <circle
              cx={x(year)}
              cy={y(balances[i][year])}
              r="5"
              fill={series.length > 1 ? `var(--series-${s.index})` : "var(--series-1)"}
              stroke="var(--card)"
              strokeWidth="2"
            />
            <circle
              cx={x(year)}
              cy={y(contributions[i][year])}
              r="4"
              fill="var(--positive-text)"
              stroke="var(--card)"
              strokeWidth="2"
            />
          </g>
        ))}
        {selected !== null && (
          <line
            x1={x(year)}
            x2={x(year)}
            y1="30"
            y2="278"
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
        )}
      </svg>
      <div className="chart-inspector">
        <div className="chart-inspector-heading">
          <strong className="chart-inspector-year">Year {year}</strong>
          {series.length === 1 && series[0].yearContext?.[year - 1] && (
            <span className="chart-inspector-context">
              {series[0].yearContext[year - 1]}
            </span>
          )}
        </div>
        {series.map((s, i) => (
        <div key={s.index}>
          <p className="inspector-starting">{series.length > 1 ? `${s.name}: ` : ""}Starting balance {money(s.starting ?? starting)} included in contributions</p>
          <div className="chart-inspector-equation">
            <span key={`${s.index}-contributions`} className="inspector-value inspector-contribution">
              <span><i className="dot contribution-dot" /> {series.length > 1 ? `${s.name} contributions` : "Contributions"}</span>
              <strong>{money(contributions[i][year])}</strong>
            </span>
          <span className="inspector-equation-symbol inspector-minus" aria-hidden="true">−</span>
            <span key={`${s.index}-shortfall`} className="inspector-value inspector-shortfall">
              <span><i className="dot shortfall-dot" /> {series.length > 1 ? `${s.name} cash shortfall` : "Cash shortfall"}</span>
              <strong>{money(shortfalls[i][year])}</strong>
            </span>
          <span className="inspector-equation-symbol inspector-plus" aria-hidden="true">+</span>
            <span key={`${s.index}-growth`} className="inspector-value inspector-growth">
              <span><i className="dot growth-dot" /> {series.length > 1 ? `${s.name} growth` : "Growth"}</span>
              <strong>{money(growths[i][year])}</strong>
            </span>
          <span className="inspector-equation-symbol inspector-equals" aria-hidden="true">=</span>
            <span key={`${s.index}-balance`} className="inspector-value inspector-total">
              <span><i className="dot total-dot" /> {series.length > 1 ? `${s.name} total balance` : "Total balance"}</span>
              <strong>{money(balances[i][year])}</strong>
            </span>
          </div>
        </div>
        ))}
      </div>
    </div>
  );
}
