import { formatMiles, formatShort } from "@/lib/format";
import type { AnalyzeResult } from "@/types";

interface Props {
  result: AnalyzeResult;
  onApplyDelay: (hours: number) => void;
}

function Delta({ label, from, to }: { label: string; from: number; to: number }) {
  if (Math.round(from) === Math.round(to)) return null;
  return (
    <span className="delta">
      {label} <s>{formatMiles(from)}</s> → <b>{formatMiles(to)}</b>
    </span>
  );
}

/** Departure advisor: turns the forecast into an action ("leave 3 h later") the driver can apply in one click. */
export function AdvisorCard({ result, onApplyDelay }: Props) {
  const { advisor } = result;
  if (advisor.status === "unknown") return null;
  const rank = new Map(result.routes.map((r) => [r.id, r.rank]));
  const departAt = (h: number) => formatShort(new Date(new Date(result.departure).getTime() + h * 3_600_000).toISOString());
  const delay = advisor.status === "delay" && advisor.delay_h !== undefined && advisor.before && advisor.after;

  return (
    <section className={`card advisor ${delay ? "better" : "fine"}`} aria-label="Departure advisor">
      <div className="advisor-head">
        <span className="advisor-ico" aria-hidden="true">
          {delay ? "⏱" : "✓"}
        </span>
        <div>
          <strong>{delay ? `Better window: leave ${advisor.delay_h} h later` : "Departure looks good"}</strong>
          {delay && <span className="muted"> · {departAt(advisor.delay_h ?? 0)}</span>}
        </div>
      </div>
      <p className="advisor-text">{advisor.headline}</p>
      {delay && advisor.before && advisor.after && (
        <div className="deltas">
          <Delta label="No Travel" from={advisor.before.no_travel_mi} to={advisor.after.no_travel_mi} />
          <Delta label="Severe" from={advisor.before.severe_mi} to={advisor.after.severe_mi} />
          <Delta label="High" from={advisor.before.high_mi} to={advisor.after.high_mi} />
          {advisor.route_id && advisor.route_id !== result.recommended_id && (
            <span className="delta">Best route then: Route {rank.get(advisor.route_id)}</span>
          )}
        </div>
      )}
      <p className={`stability ${advisor.stable ? "ok" : "warn"}`}>
        {advisor.stable
          ? "✓ The recommendation holds if you leave up to 2 h late."
          : `⚠ If you leave ${advisor.flip?.delay_h} h late, Route ${rank.get(advisor.flip?.route_id ?? "")} becomes the better choice.`}
      </p>
      {delay && (
        <button type="button" className="btn primary small" onClick={() => onApplyDelay(advisor.delay_h ?? 0)}>
          Re-run leaving {advisor.delay_h} h later
        </button>
      )}
    </section>
  );
}
