import { useEffect, useRef } from "react";
import { LEVEL_COLOR, LEVEL_LABEL, driverLabel, formatShort } from "../lib/format";
import type { Route } from "../types";

interface Props {
  route: Route;
  focusIndex: number | null;
  tracing: boolean;
  onFocus: (i: number) => void;
  onToggleTrace: () => void;
}

export function CheckpointTable({ route, focusIndex, tracing, onFocus, onToggleTrace }: Props) {
  const wrap = useRef<HTMLDivElement>(null);

  // Keep the active row visible (important while a trace is running).
  useEffect(() => {
    wrap.current?.querySelector("tr.focus")?.scrollIntoView({ block: "nearest" });
  }, [focusIndex]);

  return (
    <section className="card checkpoints" aria-label="Checkpoints">
      <div className="cp-head">
        <h3>Route {route.rank} checkpoints</h3>
        <span className="muted">{route.checkpoints.length} stops · tap a row to locate</span>
      </div>
      <div className="tablewrap" ref={wrap}>
        <table>
          <thead>
            <tr>
              <th>Mi</th>
              <th>ETA</th>
              <th>Risk</th>
              <th>Wind</th>
              <th>Rain</th>
              <th>Snow</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c, i) => (
              <tr key={c.mile} className={i === focusIndex ? "focus" : ""} onClick={() => onFocus(i)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onFocus(i)}>
                <td className="num">{c.mile}</td>
                <td>{formatShort(c.eta)}</td>
                <td>
                  <span className="pill" style={{ background: LEVEL_COLOR[c.level] }} title={driverLabel(c.driver)}>{LEVEL_LABEL[c.level]}</span>
                </td>
                <td className="num">{c.weather ? Math.round(c.weather.wind_mph) : "–"}</td>
                <td className="num">{c.weather ? c.weather.rain_in_hr.toFixed(2) : "–"}</td>
                <td className="num">{c.weather ? c.weather.snow_in_hr.toFixed(2) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cp-foot">
        <p className="units muted">Wind in mph · rain and snow in in/hr</p>
        <button type="button" className={`trace-btn ${tracing ? "on" : ""}`} onClick={onToggleTrace} disabled={route.checkpoints.length < 2}>
          {tracing ? "■ Stop trace" : "▶ Trace route"}
        </button>
      </div>
    </section>
  );
}
