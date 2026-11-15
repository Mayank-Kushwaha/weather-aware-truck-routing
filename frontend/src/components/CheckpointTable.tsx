import { LEVEL_COLOR, LEVEL_LABEL, driverLabel, formatShort } from "../lib/format";
import type { Route } from "../types";

interface Props {
  route: Route;
  focusIndex: number | null;
  onFocus: (i: number) => void;
}

export function CheckpointTable({ route, focusIndex, onFocus }: Props) {
  return (
    <section className="card checkpoints" aria-label="Checkpoints">
      <div className="cp-head">
        <h3>Route {route.rank} checkpoints</h3>
        <span className="muted">{route.checkpoints.length} stops · tap a row to locate</span>
      </div>
      <div className="tablewrap">
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
      <p className="units muted">Wind in mph · rain and snow in in/hr</p>
    </section>
  );
}
