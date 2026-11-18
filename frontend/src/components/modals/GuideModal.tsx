import { useRef } from "react";
import { Modal } from "@/components/modals/Modal";
import { LEVEL_COLOR, LEVEL_LABEL } from "@/lib/format";
import type { Level } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTIONS = [
  ["overview", "Overview"],
  ["start", "Getting started"],
  ["presets", "Presets"],
  ["results", "Reading results"],
  ["risk", "Risk rules"],
  ["map", "Map and heatmap"],
  ["trace", "Trace route"],
  ["tips", "Tips and limits"],
] as const;

const LEVELS: Level[] = ["low", "moderate", "high", "severe", "no_travel"];

function Dot({ level }: { level: Level }) {
  return <i className="gdot" style={{ background: LEVEL_COLOR[level] }} aria-hidden="true" />;
}

export function GuideModal({ open, onClose }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const jump = (id: string) => body.current?.querySelector(`#guide-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Modal open={open} title="Guide and documentation" onClose={onClose} wide>
      <nav className="guide-nav" aria-label="Guide sections">
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" onClick={() => jump(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="guide" ref={body}>
        <section id="guide-overview">
          <h3>Overview</h3>
          <p>
            This app helps a truck driver choose the safest route. It gets up to three routes between two places, forecasts the weather at
            checkpoints along each one <em>at the time the truck is expected to be there</em>, applies the weather risk rules and your load
            weight, and recommends the best route. It also shows a 48-hour weather heatmap along the trip.
          </p>
        </section>

        <section id="guide-start">
          <h3>Getting started</h3>
          <ol>
            <li>
              <strong>Wake the backend (first visit).</strong> The server sleeps on a free plan. Open the health link from the welcome
              window once. City search and presets work after that.
            </li>
            <li>
              <strong>Origin and destination.</strong> Type at least 3 letters and <em>pick a suggestion</em> from the list. Typed text
              alone is not accepted. The ⇅ button swaps them.
            </li>
            <li>
              <strong>Departure.</strong> Any time from one hour ago to 14 days ahead (the forecast range). The time is in your local time
              zone.
            </li>
            <li>
              <strong>Load.</strong> Whole pounds from 0 to 80,000. A line under the field tells you which wind rules apply.
            </li>
            <li>
              <strong>Checkpoint every 10, 25 or 50 mi.</strong> Smaller gives more detail but more weather lookups. Very long trips at 10
              mi are refused with a hint to widen the interval.
            </li>
            <li>
              Press <strong>Find safest route</strong>. A typical search takes a few seconds.
            </li>
          </ol>
          <p>
            <strong>Try an example:</strong> the dashed button under the fields fills Chicago → Denver. Press Find safest route to run it.
          </p>
          <p>
            <strong>Resize the sidebar:</strong> drag the divider between the sidebar and the map. Double-click it to reset, or focus it and
            use the arrow keys.
          </p>
        </section>

        <section id="guide-presets">
          <h3>Presets</h3>
          <p>
            Under the form is the <strong>Quick presets</strong> card with 16 ready-made trips: routes in India, Nepal, Bhutan, Bangladesh,
            Pakistan and the USA. One end is in India for every trip outside the USA. Use the <strong>All / Harsh / Calm</strong> tabs to
            filter.
          </p>
          <ul>
            <li>
              Clicking a preset fills the form and <strong>runs the analysis immediately</strong>.
            </li>
            <li>
              The departure is chosen from the live forecast: the harshest window in the next 13 days for harsh presets, the calmest soon
              for calm ones.
            </li>
            <li>
              The coloured chip shows the strongest forecast near the corridor, for example "wind 48.7 mph · Wed 11:32 PM". It comes from a
              straight line between the two cities, so the full analysis on the real roads can differ.
            </li>
            <li>A harsh corridor can honestly look calm out of season (for example monsoon routes in winter).</li>
          </ul>
        </section>

        <section id="guide-results">
          <h3>Reading the results</h3>
          <ul>
            <li>
              <strong>Route cards.</strong> Each shows distance, drive time, arrival time and a bar of miles by risk level. Click a card to
              select that route on the map. A "Recommended" badge marks the winner, with a one-line reason.
            </li>
            <li>
              <strong>How the winner is chosen.</strong> In order: fewest <em>No Travel</em> miles, fewest <em>Severe</em> miles, fewest{" "}
              <em>High</em> miles, lowest average risk, then shortest time. Differences under 1 mile (or 0.05 average risk) count as equal
              so time can decide.
            </li>
            <li>
              <strong>Fewer than three routes.</strong> If the map service only finds two distinct roads, you see two and a notice.
            </li>
            <li>
              <strong>Checkpoint table.</strong> Every stop with mile, ETA, risk, wind (mph), rain and snow (in/hr). Click a row to jump to
              it on the map.
            </li>
            <li>
              <strong>No data.</strong> If a checkpoint is beyond the forecast range, it is excluded from the risk totals and a warning
              explains it.
            </li>
          </ul>
        </section>

        <section id="guide-risk">
          <h3>Risk rules</h3>
          <p>Each checkpoint takes the worst of wind, rain and snow:</p>
          <div className="gtable">
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Wind (mph)</th>
                  <th>Rain (in/hr)</th>
                  <th>Snow (in/hr)</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["low", "< 25", "< 0.10", "< 0.5"],
                    ["moderate", "25 to < 35", "0.10 to < 0.25", "0.5 to < 1.0"],
                    ["high", "35 to < 45", "0.25 to < 0.50", "1.0 to < 2.0"],
                    ["severe", "45 to < 55", "0.50 to 1.00", "2.0 to 3.0"],
                    ["no_travel", "55 or more", "> 1.00", "> 3.0"],
                  ] as [Level, string, string, string][]
                ).map(([l, w, r, s]) => (
                  <tr key={l}>
                    <td>
                      <Dot level={l} />
                      {LEVEL_LABEL[l]}
                    </td>
                    <td>{w}</td>
                    <td>{r}</td>
                    <td>{s}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            <strong>Load rules (wind only, they can only raise a level):</strong>
          </p>
          <ul>
            <li>Wind 55 mph or more: No Travel for any load.</li>
            <li>Wind 45 to 54 mph with a load over 30,000 lb: No Travel.</li>
            <li>Wind 35 to 44 mph with a load over 40,000 lb: at least Severe.</li>
          </ul>
        </section>

        <section id="guide-map">
          <h3>Map and heatmap</h3>
          <ul>
            <li>
              <strong>Routes.</strong> Three colours, the selected one is thick. Click a line to select it. A and B mark the ends.
            </li>
            <li>
              <strong>Checkpoint dots.</strong> Coloured by risk at the ETA of that stop. Click one for the time and weather.
            </li>
            <li>
              <strong>Heatmap.</strong> The glow along the routes shows risk. Faint green means Low; yellow, orange, red and dark purple
              mean Moderate, High, Severe and No Travel. Tick or untick <em>Weather heatmap</em> to show or hide it.
            </li>
            <li>
              <strong>0 to 48 hour slider.</strong> Drag it to see the forecast at departure plus N hours along each route. It updates
              instantly and makes no network calls, because all 49 hours arrive with the first result.
            </li>
            <li>
              <strong>Legend</strong> (top left) lists the five colours.
            </li>
          </ul>
          <div className="glegend">
            {LEVELS.map((l) => (
              <span key={l}>
                <Dot level={l} />
                {LEVEL_LABEL[l]}
              </span>
            ))}
          </div>
        </section>

        <section id="guide-trace">
          <h3>Trace route</h3>
          <p>
            Press <strong>▶ Trace route</strong> under the checkpoint table to watch a truck drive the selected route checkpoint by
            checkpoint.
          </p>
          <ul>
            <li>
              <strong>▶ / ❚❚</strong> play and pause (⟲ replays when it ends).
            </li>
            <li>
              <strong>◀ and ▶</strong> step to the previous or next checkpoint. <strong>⏮ ⏭</strong> jump to the start or end.
            </li>
            <li>
              <strong>Slider</strong> scrubs anywhere along the route.
            </li>
            <li>
              <strong>1× / 2× / 4×</strong> changes the speed. <strong>Follow</strong> keeps the camera on the truck.
            </li>
            <li>The card shows the mile, ETA, risk and weather of the current stop, and the matching table row highlights.</li>
            <li>
              Close the panel or press <strong>■ Stop trace</strong> to return to the full view.
            </li>
          </ul>
        </section>

        <section id="guide-tips">
          <h3>Tips and limits</h3>
          <ul>
            <li>
              If suggestions or presets do not load, the backend is probably asleep. Use the wake link from the welcome window and wait up
              to a minute.
            </li>
            <li>
              Routing has no truck profile, so truck-only restrictions and truck speeds are not modelled. ETAs are driving time only, with
              no breaks.
            </li>
            <li>Wind is sustained 10 m wind, not gusts. Forecast resolution is about 10 km.</li>
            <li>The forecast is model data. It is not a substitute for a driver's judgement or official road warnings.</li>
            <li>
              Data: weather from Open-Meteo (CC BY 4.0), routing and search from Mapbox, map tiles from OpenStreetMap contributors via
              OpenFreeMap.
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}
