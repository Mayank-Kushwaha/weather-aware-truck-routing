import type { ReactNode } from "react";

/** Small presentational pieces of the sidebar that carry no state. */

export function Brand({ busy, onGuide }: { busy: boolean; onGuide: () => void }) {
  return (
    <header className={`brand ${busy ? "busy" : ""}`}>
      <img className="logo" src="/logo.png" alt="" width={48} height={48} fetchPriority="high" />
      <div>
        <h1>Weather-Aware Truck Routing</h1>
        <p>Compare 3 routes by weather risk at your arrival time, load and travel time.</p>
      </div>
      <button type="button" className="help-btn" onClick={onGuide}>
        ? Guide
      </button>
    </header>
  );
}

export function SkeletonCards() {
  return (
    <div className="routes" role="status" aria-busy="true" aria-label="Loading routes">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card skel" style={{ ["--i" as string]: i }}>
          <div className="skel-line w40" />
          <div className="skel-row">
            <span />
            <span />
            <span />
          </div>
          <div className="skel-line w100 thin" />
        </div>
      ))}
      <p className="muted center">Fetching routes and forecasts…</p>
    </div>
  );
}

const STEPS: [string, string, string][] = [
  ["1", "Enter a trip", "Pick origin, destination, departure time and load."],
  ["2", "We sample the weather", "Forecast at each checkpoint, at the time your truck gets there."],
  ["3", "Pick the safest route", "Ranked by No Travel, Severe and High miles, then time."],
];

export function HowItWorks() {
  return (
    <section className="card how" aria-label="How it works">
      {STEPS.map(([n, title, text]) => (
        <div key={n} className="step">
          <span className="stepno">{n}</span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export function Footer(): ReactNode {
  return (
    <footer>
      Weather:{" "}
      <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Open-Meteo
      </a>{" "}
      (CC BY 4.0). Routing: Mapbox. Map: © OpenStreetMap contributors, OpenFreeMap. Forecast model data, not a substitute for driver
      judgment.
    </footer>
  );
}
