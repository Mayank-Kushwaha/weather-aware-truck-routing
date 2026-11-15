import { useState, type FormEvent } from "react";
import { toLocalInputValue } from "../lib/format";
import type { AnalyzeRequest, Place } from "../types";
import { PlaceInput } from "./PlaceInput";

interface Props {
  loading: boolean;
  onSubmit: (req: AnalyzeRequest) => void;
}

const MAX_LOAD_LB = 80_000;
const MAX_DAYS = 14;
const INTERVALS = [10, 25, 50] as const;

function defaultDeparture(): string {
  const d = new Date(Date.now() + 3_600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInputValue(d);
}

export function SearchForm({ loading, onSubmit }: Props) {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState("40000");
  const [interval, setInterval_] = useState<10 | 25 | 50>(25);
  const [problem, setProblem] = useState<string | null>(null);

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

  return (
    <form className="card form" onSubmit={submit} noValidate>
      <PlaceInput label="Origin" value={origin} onChange={setOrigin} />
      <PlaceInput label="Destination" value={destination} onChange={setDestination} />
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
      <button type="submit" disabled={loading}>{loading ? "Analyzing routes…" : "Find safest route"}</button>
    </form>
  );
}
