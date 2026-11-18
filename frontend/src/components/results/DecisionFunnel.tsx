import { formatDuration, formatMiles } from "@/lib/format";
import { routeColor } from "@/lib/mapData";
import type { AnalyzeResult, LadderStep } from "@/types";

interface Props {
  result: AnalyzeResult;
}

function formatValue(step: LadderStep, v: number): string {
  if (step.criterion === "time") return formatDuration(v);
  if (step.criterion === "avg_risk") return `${v.toFixed(2)}/4`;
  return formatMiles(v);
}

/**
 * Audit trail of the recommendation: the criteria are applied in the assessment's order and each step
 * shows which routes survive. A step that eliminates someone is the one that decided.
 */
export function DecisionFunnel({ result }: Props) {
  const rank = new Map(result.routes.map((r) => [r.id, r.rank]));
  const winner = result.routes.find((r) => r.id === result.recommended_id);
  return (
    <details className="card funnel">
      <summary>
        <span>
          <strong>How the winner was chosen</strong>
          <small className="muted"> · step by step</small>
        </span>
        <span className="chev" aria-hidden="true">
          ▾
        </span>
      </summary>
      <ol className="steps">
        {result.decision.ladder.map((step, i) => (
          <li key={step.criterion} className={step.decisive ? "decisive" : ""}>
            <div className="step-head">
              <span className="step-no">{i + 1}</span>
              <strong>{step.label}</strong>
              {step.decisive && <span className="tag decides">decides</span>}
              {!step.decisive && <span className="tag">tie</span>}
            </div>
            <div className="chips">
              {result.routes.map((r) => {
                const out = step.eliminated.includes(r.id);
                const alive = step.survivors.includes(r.id);
                return (
                  <span
                    key={r.id}
                    className={`vchip ${out ? "out" : alive ? "in" : "gone"}`}
                    title={out ? "Eliminated at this step" : undefined}
                  >
                    <i style={{ background: routeColor(rank.get(r.id) ?? 1) }} />R{rank.get(r.id)}{" "}
                    <b>{formatValue(step, step.values[r.id])}</b>
                  </span>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {winner && <p className="funnel-foot">Route {winner.rank} is the only route left after the last step.</p>}
      <p className="units muted">
        Differences under 1 mile (or 0.05 average risk) count as a tie so travel time can break it. Travel time is the last criterion.
      </p>
    </details>
  );
}
