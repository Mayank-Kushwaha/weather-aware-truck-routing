import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PresetsPanel } from "@/components/form/PresetsPanel";
import { type AppliedTrip, SearchForm } from "@/components/form/SearchForm";
import { Resizer } from "@/components/layout/Resizer";
import { Brand, Footer, HowItWorks, SkeletonCards } from "@/components/layout/Sidebar";
import { WelcomeModal } from "@/components/modals/WelcomeModal";
import { AdvisorCard } from "@/components/results/AdvisorCard";
import { CheckpointTable } from "@/components/results/CheckpointTable";
import { DecisionFunnel } from "@/components/results/DecisionFunnel";
import { RouteCards } from "@/components/results/RouteCards";
import { useAnalysis } from "@/hooks/useAnalysis";
import type { Preset } from "@/types";

// The map (MapLibre is ~1 MB) and the guide load on demand so the sidebar is interactive immediately.
const MapView = lazy(() => import("@/components/map/MapView"));
const GuideModal = lazy(() => import("@/components/modals/GuideModal").then((m) => ({ default: m.GuideModal })));

const WELCOME_KEY = "welcome-seen";

function MapFallback() {
  return (
    <div className="map-loading" role="status" aria-live="polite">
      <span className="spinner dark" aria-hidden="true" />
      Loading map…
    </div>
  );
}

export default function App() {
  const { result, request, loading, error, run } = useAnalysis();
  const [selectedId, setSelectedId] = useState("");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [traceOn, setTraceOn] = useState(false);
  const [applied, setApplied] = useState<AppliedTrip | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !sessionStorage.getItem(WELCOME_KEY));
  const [guideOpen, setGuideOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const nonce = useRef(0);

  // A fresh result resets selection, trace and focus, and brings the results into view.
  useEffect(() => {
    if (!result) return;
    setSelectedId(result.recommended_id);
    setFocusIndex(null);
    setTraceOn(false);
    setPresetsOpen(false);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const closeWelcome = useCallback(() => {
    sessionStorage.setItem(WELCOME_KEY, "1");
    setWelcomeOpen(false);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setFocusIndex(null);
  }, []);

  const applyTrip = useCallback((trip: NonNullable<typeof request>) => setApplied({ trip, nonce: ++nonce.current }), []);

  const pickPreset = (p: Preset) =>
    applyTrip({ origin: p.origin, destination: p.destination, departure: p.departure, load_lb: p.load_lb, interval_mi: p.interval_mi });

  const applyDelay = (hours: number) => {
    if (!request) return;
    const departure = new Date(new Date(request.departure).getTime() + hours * 3_600_000).toISOString();
    applyTrip({ ...request, departure });
  };

  const selected = result?.routes.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="app">
      <aside className="panel">
        <Brand busy={loading} onGuide={() => setGuideOpen(true)} />
        <SearchForm loading={loading} applied={applied} onSubmit={run} />
        <PresetsPanel disabled={loading} open={presetsOpen} onToggle={() => setPresetsOpen((o) => !o)} onPick={pickPreset} />
        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
        {!result && !loading && !error && <HowItWorks />}
        {loading && !result && <SkeletonCards />}
        {result && (
          <div ref={resultsRef} className={`results ${loading ? "dim" : ""}`}>
            {result.warnings.map((w) => (
              <div key={w} className="banner warn">
                {w}
              </div>
            ))}
            <AdvisorCard result={result} onApplyDelay={applyDelay} />
            <div className="section-title">
              <h2>Routes</h2>
              <span className="muted">
                {result.routes.length} options · analyzed in {(result.timings_ms.total / 1000).toFixed(1)} s
              </span>
            </div>
            <RouteCards result={result} selectedId={selectedId} onSelect={select} />
            <DecisionFunnel result={result} />
            {selected && (
              <CheckpointTable
                route={selected}
                focusIndex={focusIndex}
                tracing={traceOn}
                onFocus={setFocusIndex}
                onToggleTrace={() => setTraceOn((t) => !t)}
              />
            )}
          </div>
        )}
        <Footer />
      </aside>
      <Resizer />
      <main>
        <Suspense fallback={<MapFallback />}>
          <MapView
            result={result}
            origin={request?.origin ?? null}
            destination={request?.destination ?? null}
            selectedId={selectedId}
            focusIndex={focusIndex}
            traceOn={traceOn}
            onSelect={select}
            onFocus={setFocusIndex}
            onTraceClose={() => setTraceOn(false)}
          />
        </Suspense>
      </main>
      <WelcomeModal
        open={welcomeOpen}
        onClose={closeWelcome}
        onOpenGuide={() => {
          closeWelcome();
          setGuideOpen(true);
        }}
      />
      {guideOpen && (
        <Suspense fallback={null}>
          <GuideModal open onClose={() => setGuideOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
