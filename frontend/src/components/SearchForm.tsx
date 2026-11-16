import { useEffect, useState, type FormEvent } from "react";
import { toLocalInputValue } from "../lib/format";
import type { AnalyzeRequest, Place, Preset } from "../types";
import { PlaceInput } from "./PlaceInput";

export interface AppliedPreset {
  preset: Preset;
  nonce: number;
}

interface Props {
  loading: boolean;
  applied: AppliedPreset | null;
  onSubmit: (req: AnalyzeRequest) => void;
}

const MAX_LOAD_LB = 80_000;
const MAX_DAYS = 14;
const INTERVALS = [10, 25, 50] as const;

const EXAMPLE: { origin: Place; destination: Place } = {
  origin: { label: "Chicago, Illinois, United States", lat: 41.881953, lng: -87.632362 },
  destination: { label: "Denver, Colorado, United States", lat: 39.7392, lng: -104.9903 },
};

function defaultDeparture(): string {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInputValue(d);
}

/** Plain-language hint for which wind load rules apply at this weight. */
function loadHint(lb: number): string {
  if (!Number.isFinite(lb) || lb < 0) return "";
  if (lb > 40_000) return "Over 40,000 lb: strictest wind limits apply";
  if (lb > 30_000) return "Over 30,000 lb: heavy-load wind rule applies";
  return "Light load: only the base wind limits apply";
}

export function SearchForm({ loading, applied, onSubmit }: Props) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState("40000");
  const [interval, setInterval_] = useState<10 | 25 | 50>(25);
  const [problem, setProblem] = useState<string | null>(null);
  const [swapKey, setSwapKey] = useState(0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const loadLb = Number(load);
    const dep = new Date(departure);
    if (!origin || !destination) return setProblem("Pick an origin and a destination from the suggestions.");
    if (Number.isNaN(dep.getTime())) return setProblem("Enter a departure date and time.");
    if (!Number.isInteger(loadLb) || loadLb < 0 || loadLb > MAX_LOAD_LB) return setProblem(`Load must be a whole number from 0 to ${MAX_LOAD_LB.toLocaleString()} lb.`);
    if (dep.getTime() < Date.now() - 3_600_000) return setProblem("Departure cannot be in the past.");
    if (dep.getTime() > Date.now() + MAX_DAYS * 86_400_000) return setProblem(`Departure must be within ${MAX_DAYS} days (forecast range).`);
    setProblem(null);
    onSubmit({ origin, destination, departure: dep.toISOString(), load_lb: loadLb, interval_mi: interval });
  };

  // A clicked preset fills the form, then runs the analysis straight away.
  useEffect(() => {
    if (!applied) return;
    const p = applied.preset;
    setOrigin(p.origin);
    setDestination(p.destination);
    setDeparture(toLocalInputValue(new Date(p.departure)));
    setLoad(String(p.load_lb));
    setInterval_(p.interval_mi);
    setProblem(null);
    setSwapKey((k) => k + 1);
    onSubmit({ origin: p.origin, destination: p.destination, departure: p.departure, load_lb: p.load_lb, interval_mi: p.interval_mi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setSwapKey((k) => k + 1);
  };

  const useExample = () => {
    setOrigin(EXAMPLE.origin);
    setDestination(EXAMPLE.destination);
    setProblem(null);
  };

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <div className="places">
        <PlaceInput key={`o${swapKey}`} label="Origin" value={origin} onChange={setOrigin} />
        <button type="button" className="swap" onClick={swap} aria-label="Swap origin and destination" title="Swap">⇅</button>
        <PlaceInput key={`d${swapKey}`} label="Destination" value={destination} onChange={setDestination} />
      </div>
      {!origin && !destination && (
        <button type="button" className="chip" onClick={useExample}>✨ Try an example: Chicago → Denver</button>
      )}
      <div className="row">
        <div className="field">
          <label htmlFor="dep">Departure</label>
          <input id="dep" type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="load">Load (lb)</label>
          <input id="load" type="number" inputMode="numeric" min={0} max={MAX_LOAD_LB} step={500} value={load} onChange={(e) => setLoad(e.target.value)} />
        </div>
      </div>
      <p className="hint-text">{loadHint(Number(load))}</p>
      <fieldset className="field">
        <legend>Weather checkpoint every</legend>
        <div className="seg">
          {INTERVALS.map((i) => (
            <label key={i} className={interval === i ? "on" : ""}>
              <input type="radio" name="interval" checked={interval === i} onChange={() => setInterval_(i)} />
              {i} mi
            </label>
          ))}
        </div>
      </fieldset>
      {problem && <p className="err" role="alert">{problem}</p>}
      <button type="submit" disabled={loading}>
        {loading && <span className="spinner" aria-hidden="true" />}
        {loading ? "Analyzing routes…" : "Find safest route"}
      </button>
    </form>
  );
}
