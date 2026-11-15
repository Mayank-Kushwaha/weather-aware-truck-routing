import { useCallback, useRef, useState } from "react";
import { analyze } from "./api";
import { CheckpointTable } from "./components/CheckpointTable";
import { MapView } from "./components/MapView";
import { RouteCards } from "./components/RouteCards";
import { SearchForm } from "./components/SearchForm";
import type { AnalyzeRequest, AnalyzeResult, Place } from "./types";

export default function App() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [places, setPlaces] = useState<{ origin: Place; destination: Place } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

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

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFocusIndex(null);
  }, []);

  const selected = result?.routes.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <div className="logo" aria-hidden="true">⛅</div>
          <div>
            <h1>Weather-Aware Truck Routing</h1>
            <p>Compare 3 routes by weather risk at your arrival time, load and travel time.</p>
          </div>
        </header>
        <SearchForm loading={loading} onSubmit={run} />
        {error && <div className="banner error" role="alert">{error}</div>}
        {loading && !result && <div className="skeleton" aria-busy="true">Fetching routes and forecasts…</div>}
        {result && (
          <div className={loading ? "dim" : ""}>
            {result.warnings.map((w) => (
              <div key={w} className="banner warn">{w}</div>
            ))}
            <RouteCards result={result} selectedId={selectedId} onSelect={select} />
            {selected && <CheckpointTable route={selected} focusIndex={focusIndex} onFocus={setFocusIndex} />}
          </div>
        )}
        <footer>
          Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Routing: Mapbox. Map: © OpenStreetMap contributors, OpenFreeMap.
          Forecast model data, not a substitute for driver judgment.
        </footer>
      </aside>
      <main>
        <MapView result={result} origin={places?.origin ?? null} destination={places?.destination ?? null} selectedId={selectedId} focusIndex={focusIndex} onSelect={select} onFocus={setFocusIndex} />
      </main>
    </div>
  );
}
