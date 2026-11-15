import { LEVEL_COLOR, formatDateTime, formatDuration, formatMiles } from "../lib/format";
import { routeColor } from "../lib/mapData";
import type { AnalyzeResult, Level, Route } from "../types";

interface Props {
  result: AnalyzeResult;
  selectedId: string;
  onSelect: (id: string) => void;
}

const SEGMENTS: { key: keyof Route["stats"]; level: Level; label: string }[] = [
  { key: "low_mi", level: "low", label: "Low" },
  { key: "moderate_mi", level: "moderate", label: "Moderate" },
  { key: "high_mi", level: "high", label: "High" },
  { key: "severe_mi", level: "severe", label: "Severe" },
  { key: "no_travel_mi", level: "no_travel", label: "No Travel" },
  { key: "unknown_mi", level: "unknown", label: "No data" },
];

function RiskBar({ route }: { route: Route }) {
  const total = SEGMENTS.reduce((a, s) => a + route.stats[s.key], 0) || 1;
  return (
    <div className="riskbar" role="img" aria-label="Miles by risk level">
      {SEGMENTS.map((s) => {
        const v = route.stats[s.key];
        return v > 0 ? <span key={s.key} style={{ width: `${(v / total) * 100}%`, background: LEVEL_COLOR[s.level] }} title={`${s.label}: ${formatMiles(v)}`} /> : null;
      })}
    </div>
  );
}

export function RouteCards({ result, selectedId, onSelect }: Props) {
  const fastest = result.routes.reduce((a, b) => (b.duration_s < a.duration_s ? b : a)).id;
  return (
    <section aria-label="Route options" className="routes">
      {result.routes.map((r) => (
        <button key={r.id} className={`card route ${r.id === selectedId ? "selected" : ""}`} onClick={() => onSelect(r.id)} aria-pressed={r.id === selectedId}>
          <span className="swatch" style={{ background: routeColor(r.rank) }} />
          <div className="head">
            <strong>Route {r.rank}</strong>
            {r.id === result.recommended_id && <span className="badge good">Recommended</span>}
            {r.id === fastest && <span className="badge">Fastest</span>}
            {r.no_travel && <span className="badge bad">No Travel zone</span>}
          </div>
          <div className="sub">via {r.summary}</div>
          <div className="metrics">
            <span>{formatMiles(r.distance_mi)}</span>
            <span>{formatDuration(r.duration_s)}</span>
            <span>Arrive {formatDateTime(r.eta)}</span>
          </div>
          <RiskBar route={r} />
          <div className="riskstats">
            <span>Severe {formatMiles(r.stats.severe_mi)}</span>
            <span>High {formatMiles(r.stats.high_mi)}</span>
            <span>Avg risk {r.stats.avg_risk.toFixed(2)}/4</span>
          </div>
          {r.reason && <p className="reason">{r.reason}</p>}
        </button>
      ))}
    </section>
  );
}
