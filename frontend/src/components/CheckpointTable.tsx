import { LEVEL_COLOR, LEVEL_LABEL, driverLabel, formatDateTime } from "../lib/format";
import type { Route } from "../types";

interface Props {
  route: Route;
  focusIndex: number | null;
  onFocus: (i: number) => void;
}

export function CheckpointTable({ route, focusIndex, onFocus }: Props) {
  return (
    <section className="card" aria-label="Checkpoints">
      <h3>Route {route.rank} checkpoints</h3>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Mile</th>
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
                <td>{c.mile}</td>
                <td>{formatDateTime(c.eta)}</td>
                <td>
                  <span className="pill" style={{ background: LEVEL_COLOR[c.level] }} title={driverLabel(c.driver)}>{LEVEL_LABEL[c.level]}</span>
                </td>
                <td>{c.weather ? `${c.weather.wind_mph} mph` : "–"}</td>
                <td>{c.weather ? `${c.weather.rain_in_hr} in/h` : "–"}</td>
                <td>{c.weather ? `${c.weather.snow_in_hr} in/h` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
