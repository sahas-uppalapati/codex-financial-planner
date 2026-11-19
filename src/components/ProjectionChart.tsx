import { useEffect, useId, useRef, useState } from "react";
import { compactMoney, money } from "../lib/format";
export interface Series {
  name: string;
  rows: { endingBalance: number }[];
  starting?: number;
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
  const min = Math.min(0, ...balances.flat()),
    max = Math.max(0, ...balances.flat());
  const span = max - min || 100;
  const lo = min < 0 ? min - span * 0.1 : 0,
    hi = max + span * 0.12;
  const x = (year: number) => plot.left + (year / years) * plotSpan;
  const y = (balance: number) => 278 - ((balance - lo) / (hi - lo)) * 245;
  const year = selected === null ? years : Math.min(selected, years);
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
  return (
    <div ref={container} className="chart-container">
      <svg
        viewBox={`0 0 ${plot.width} 322`}
        role="img"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onPointerMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setSelected(
            Math.max(
              0,
              Math.min(
                years,
                Math.round(
                  ((((e.clientX - box.left) / box.width) * plot.width -
                    plot.left) /
                    plotSpan) *
                    years,
                ),
              ),
            ),
          );
        }}
        onPointerLeave={() => setSelected(null)}
      >
        <title id={`${id}-title`}>Projected investment balance by year</title>
        <desc id={`${id}-desc`}>
          {summary} Nominal US dollars. Negative balances are unfunded
          shortfalls.
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
          {series.map((s) => (
            <linearGradient
              key={s.index}
              id={`${id}-fill-${s.index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={`var(--series-${s.index})`}
                stopOpacity="0.23"
              />
              <stop
                offset="100%"
                stopColor={`var(--series-${s.index})`}
                stopOpacity="0.01"
              />
            </linearGradient>
          ))}
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
              d={`${balances[i].map((b, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(b)}`).join(" ")} L ${x(years)} ${y(0)} L ${x(0)} ${y(0)} Z`}
              fill={`url(#${id}-fill-${s.index})`}
            />
            <path
              d={balances[i]
                .map((b, t) => `${t === 0 ? "M" : "L"} ${x(t)} ${y(b)}`)
                .join(" ")}
              fill="none"
              stroke={`var(--series-${s.index})`}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.index === 1 ? "7 5" : undefined}
            />
            <circle
              cx={x(year)}
              cy={y(balances[i][year])}
              r="5"
              fill={`var(--series-${s.index})`}
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
        <span>Year {year}</span>
        {series.map((s, i) => (
          <span key={s.index} className="inspector-value">
            <i className={`dot series-${s.index}`} />
            <span className="truncate">{s.name}</span>
            <strong>{money(balances[i][year])}</strong>
          </span>
        ))}
      </div>
      <label className="sr-only" htmlFor={`${id}-year`}>
        Inspect projection year
      </label>
      <input
        className="chart-range"
        id={`${id}-year`}
        aria-label="Inspect projection year"
        type="range"
        min="0"
        max={years}
        value={year}
        onChange={(e) => setSelected(Number(e.target.value))}
      />
    </div>
  );
}
