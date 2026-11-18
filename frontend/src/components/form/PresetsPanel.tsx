import { useEffect, useState } from "react";
import { getPresets } from "@/api";
import { formatShort, LEVEL_COLOR } from "@/lib/format";
import type { Preset } from "@/types";

interface Props {
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (p: Preset) => void;
}

type Filter = "all" | "harsh" | "calm";

const DRIVER: Record<string, string> = { wind: "wind", rain: "rain", snow: "snow", "wind+load": "wind (heavy load)" };

function peakText(p: Preset): string {
  const { driver, value, unit, at } = p.peak;
  return `${DRIVER[driver] ?? driver} ${value} ${unit} · ${formatShort(at)}`;
}

export function PresetsPanel({ disabled, open, onToggle, onPick }: Props) {
  const [items, setItems] = useState<Preset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setError(null);
    getPresets(ctrl.signal)
      .then(setItems)
      .catch((e) => !ctrl.signal.aborted && setError(e instanceof Error ? e.message : "Could not load presets"));
    return () => ctrl.abort();
  }, [attempt]);

  const shown = (items ?? []).filter((p) => filter === "all" || p.kind === filter);

  return (
    <section className="card presets" aria-label="Quick presets">
      <button type="button" className="presets-head" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>Quick presets</strong>
          <small className="muted"> · live forecast picks the departure</small>
        </span>
        <span className={`chev ${open ? "open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="presets-body">
          <div className="tabs" role="tablist">
            {(["all", "harsh", "calm"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? "on" : ""}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "harsh" ? "Harsh" : "Calm"}
              </button>
            ))}
          </div>
          {error && (
            <p className="err">
              {error}{" "}
              <button type="button" className="linkbtn" onClick={() => setAttempt((a) => a + 1)}>
                Retry
              </button>
            </p>
          )}
          {!items && !error && (
            <div className="preset-skel">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skel-line thin" style={{ ["--i" as string]: i }} />
              ))}
            </div>
          )}
          <ul className="preset-list">
            {shown.map((p, i) => (
              <li key={p.id} style={{ ["--i" as string]: i }}>
                <button type="button" className="preset" disabled={disabled} onClick={() => onPick(p)}>
                  <span className="preset-top">
                    <strong>{p.title}</strong>
                    <span className="tag">{p.region}</span>
                  </span>
                  <span className="preset-meta">
                    <span className="peak" style={{ ["--c" as string]: LEVEL_COLOR[p.peak.level] }}>
                      <i /> {peakText(p)}
                    </span>
                    <span>
                      {p.load_lb.toLocaleString()} lb · departs {formatShort(p.departure)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="units muted">Peak shown is the forecast near the corridor. The full analysis uses the real road geometry.</p>
        </div>
      )}
    </section>
  );
}
