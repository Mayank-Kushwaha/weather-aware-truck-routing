import { LEVEL_COLOR, LEVEL_LABEL, driverLabel, formatDateTime } from "../lib/format";
import type { Trace } from "../hooks/useTrace";

interface Props {
  trace: Trace;
  routeRank: number;
  onClose: () => void;
}

export function TracePanel({ trace, routeRank, onClose }: Props) {
  const { checkpoint: c, n, idx, p, playing, speed, follow } = trace;
  const done = p >= n - 1;
  return (
    <div className="overlay trace" role="region" aria-label="Route trace">
      <div className="trace-head">
        <strong>Tracing Route {routeRank}</strong>
        <span className="muted">Stop {idx + 1} of {n}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close trace" title="Close">✕</button>
      </div>
      {c && (
        <div className="trace-now" key={idx}>
          <div className="trace-line">
            <span className="trace-mile">Mile {c.mile}</span>
            <span className="pill" style={{ background: LEVEL_COLOR[c.level] }}>{LEVEL_LABEL[c.level]}</span>
            {c.driver && <small className="muted">{driverLabel(c.driver)}</small>}
          </div>
          <div className="trace-meta">ETA {formatDateTime(c.eta)}</div>
          <div className="trace-meta">
            {c.weather ? `Wind ${c.weather.wind_mph} mph · Rain ${c.weather.rain_in_hr} in/h · Snow ${c.weather.snow_in_hr} in/h` : "No forecast data"}
          </div>
        </div>
      )}
      <input
        className="trace-scrub"
        type="range"
        min={0}
        max={n - 1}
        step={0.01}
        value={p}
        onChange={(e) => trace.scrub(Number(e.target.value))}
        aria-label="Trace position"
      />
      <div className="trace-controls">
        <button type="button" className="icon-btn" onClick={trace.first} aria-label="Go to start" title="Start">⏮</button>
        <button type="button" className="icon-btn" onClick={trace.prev} aria-label="Previous checkpoint" title="Previous">◀</button>
        <button type="button" className="icon-btn play" onClick={trace.toggle} aria-label={playing ? "Pause" : done ? "Replay" : "Play"} title={playing ? "Pause" : done ? "Replay" : "Play"}>
          {playing ? "❚❚" : done ? "⟲" : "▶"}
        </button>
        <button type="button" className="icon-btn" onClick={trace.next} aria-label="Next checkpoint" title="Next">▶</button>
        <button type="button" className="icon-btn" onClick={trace.last} aria-label="Go to end" title="End">⏭</button>
        <button type="button" className="speed" onClick={trace.cycleSpeed} aria-label={`Speed ${speed}x`} title="Change speed">{speed}×</button>
        <label className="follow" title="Keep the truck centred">
          <input type="checkbox" checked={follow} onChange={(e) => trace.setFollow(e.target.checked)} /> Follow
        </label>
      </div>
    </div>
  );
}
