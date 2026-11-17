import { useEffect, useState } from "react";
import { HEALTH_URL } from "../api";

export type BackendStatus = "checking" | "waking" | "online";

const POLL_MS = 3000;
const MAX_MS = 3 * 60 * 1000;

/** Pings /api/health until the backend answers (Render's free tier sleeps when idle). Stops once online. */
export function useBackendStatus(active: boolean): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>("checking");

  useEffect(() => {
    if (!active || status === "online") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    const ping = async () => {
      const ctrl = new AbortController();
      const abort = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(HEALTH_URL, { signal: ctrl.signal, cache: "no-store" });
        if (res.ok && !stopped) {
          setStatus("online");
          return;
        }
      } catch {
        /* still asleep or unreachable; try again */
      } finally {
        clearTimeout(abort);
      }
      if (stopped) return;
      setStatus("waking");
      if (Date.now() - startedAt < MAX_MS) timer = setTimeout(ping, POLL_MS);
    };
    ping();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, status]);

  return status;
}
