import { useCallback, useEffect, useRef, useState } from "react";
import { analyze } from "./api";
import { CheckpointTable } from "./components/CheckpointTable";
import { MapView } from "./components/MapView";
import { Resizer } from "./components/Resizer";
import { RouteCards } from "./components/RouteCards";
import { SearchForm } from "./components/SearchForm";
import type { AnalyzeRequest, AnalyzeResult, Place } from "./types";

function SkeletonCards() {
  return (
    <div className="routes" aria-busy="true" aria-label="Loading routes">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skel" style={{ ["--i" as string]: i }}>
          <div className="skel-line w40" />
          <div className="skel-row"><span /><span /><span /></div>
          <div className="skel-line w100 thin" />
        </div>
      ))}
      <p className="muted center">Fetching routes and forecasts…</p>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    ["1", "Enter a trip", "Pick origin, destination, departure time and load."],
    ["2", "We sample the weather", "Forecast at each checkpoint, at the time your truck gets there."],
    ["3", "Pick the safest route", "Ranked by No Travel, Severe and High miles, then time."],
  ];
  return (
    <section className="card how" aria-label="How it works">
      {steps.map(([n, t, d]) => (
        <div key={n} className="step">
          <span className="stepno">{n}</span>
          <div><strong>{t}</strong><p>{d}</p></div>
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [places, setPlaces] = useState<{ origin: Place; destination: Place } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (req: AnalyzeRequest) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const res = await analyze(req, ctrl.signal);
      setResult(res);
      setPlaces({ origin: req.origin, destination: req.destination });
      setSelectedId(res.recommended_id);
      setFocusIndex(null);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (result) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFocusIndex(null);
  }, []);

  const selected = result?.routes.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="app">
      <aside className="panel">
        <header className={`brand ${loading ? "busy" : ""}`}>
          <img className="logo" src="/logo.png" alt="" width={48} height={48} />
          <div>
            <h1>Weather-Aware Truck Routing</h1>
            <p>Compare 3 routes by weather risk at your arrival time, load and travel time.</p>
          </div>
        </header>
        <SearchForm loading={loading} onSubmit={run} />
        {error && <div className="banner error" role="alert">{error}</div>}
        {!result && !loading && !error && <HowItWorks />}
        {loading && !result && <SkeletonCards />}
        {result && (
          <div ref={resultsRef} className={`results ${loading ? "dim" : ""}`}>
            {result.warnings.map((w) => (
              <div key={w} className="banner warn">{w}</div>
            ))}
            <div className="section-title"><h2>Routes</h2><span className="muted">{result.routes.length} options · tap to compare</span></div>
            <RouteCards result={result} selectedId={selectedId} onSelect={select} />
            {selected && <CheckpointTable route={selected} focusIndex={focusIndex} onFocus={setFocusIndex} />}
          </div>
        )}
        <footer>
          Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Routing: Mapbox. Map: © OpenStreetMap contributors, OpenFreeMap.
          Forecast model data, not a substitute for driver judgment.
        </footer>
      </aside>
      <Resizer />
      <main>
        <MapView result={result} origin={places?.origin ?? null} destination={places?.destination ?? null} selectedId={selectedId} focusIndex={focusIndex} onSelect={select} onFocus={setFocusIndex} />
      </main>
    </div>
  );
}
