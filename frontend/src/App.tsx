import { useCallback, useEffect, useRef, useState } from "react";
import { analyze } from "./api";
import { CheckpointTable } from "./components/CheckpointTable";
import { MapView } from "./components/MapView";
import { Resizer } from "./components/Resizer";
import { RouteCards } from "./components/RouteCards";
import { PresetsPanel } from "./components/PresetsPanel";
import { GuideModal } from "./components/GuideModal";
import { SearchForm, type AppliedPreset } from "./components/SearchForm";
import { WelcomeModal } from "./components/WelcomeModal";
import type { AnalyzeRequest, AnalyzeResult, Place } from "./types";

const WELCOME_KEY = "welcome-seen";

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
  const [traceOn, setTraceOn] = useState(false);
  const [applied, setApplied] = useState<AppliedPreset | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !sessionStorage.getItem(WELCOME_KEY));
  const [guideOpen, setGuideOpen] = useState(false);

  const closeWelcome = useCallback(() => {
    sessionStorage.setItem(WELCOME_KEY, "1");
    setWelcomeOpen(false);
  }, []);

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
      setTraceOn(false);
      setPresetsOpen(false);
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
          <button type="button" className="help-btn" onClick={() => setGuideOpen(true)}>? Guide</button>
        </header>
        <SearchForm loading={loading} applied={applied} onSubmit={run} />
        <PresetsPanel
          disabled={loading}
          open={presetsOpen}
          onToggle={() => setPresetsOpen((o) => !o)}
          onPick={(preset) => setApplied({ preset, nonce: ++nonce.current })}
        />
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
            {selected && (
              <CheckpointTable route={selected} focusIndex={focusIndex} tracing={traceOn} onFocus={setFocusIndex} onToggleTrace={() => setTraceOn((t) => !t)} />
            )}
          </div>
        )}
        <footer>
          Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> (CC BY 4.0). Routing: Mapbox. Map: © OpenStreetMap contributors, OpenFreeMap.
          Forecast model data, not a substitute for driver judgment.
        </footer>
      </aside>
      <WelcomeModal
        open={welcomeOpen}
        onClose={closeWelcome}
        onOpenGuide={() => {
          closeWelcome();
          setGuideOpen(true);
        }}
      />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <Resizer />
      <main>
        <MapView result={result} origin={places?.origin ?? null} destination={places?.destination ?? null} selectedId={selectedId} focusIndex={focusIndex} traceOn={traceOn} onSelect={select} onFocus={setFocusIndex} onTraceClose={() => setTraceOn(false)} />
      </main>
    </div>
  );
}
