import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { buildPath, mileAtProgress, nextIndex, pointAt, prevIndex, type LngLat } from "../lib/trace";
import type { Route } from "../types";

const STEP_MS = 1600; // time to travel between two checkpoints at 1x
export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** Animated walk along a route's checkpoints with play/pause, step and scrub. */
export function useTrace(route: Route | null, active: boolean, mapRef: RefObject<MapRef | null>, onFocus: (i: number | null) => void) {
  const n = route?.checkpoints.length ?? 0;
  const path = useMemo(() => (route ? buildPath(route.geometry.coordinates as LngLat[]) : null), [route]);
  const miles = useMemo(() => route?.checkpoints.map((c) => c.mile) ?? [], [route]);
  const [p, setP] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [follow, setFollow] = useState(true);
  const pRef = useRef(0);

  const truck: LngLat | null = useMemo(() => {
    if (!path || n < 2) return null;
    const total = miles[n - 1] || 1;
    return pointAt(path, mileAtProgress(miles, p) / total);
  }, [path, miles, n, p]);

  const move = useCallback((next: number) => {
    pRef.current = next;
    setP(next);
  }, []);

  // Restart whenever tracing starts or the traced route changes.
  const routeId = route?.id;
  useEffect(() => {
    if (!active || n < 2) return;
    move(0);
    setPlaying(true);
    const start = path ? pointAt(path, 0) : null;
    if (start) mapRef.current?.flyTo({ center: start, zoom: 6, duration: 900 });
    return () => onFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, routeId]);

  // Animation clock.
  useEffect(() => {
    if (!active || !playing || n < 2) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const next = Math.min(n - 1, pRef.current + (dt * speed) / STEP_MS);
      move(next);
      if (next >= n - 1) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing, speed, n, move]);

  // Camera follows the truck. jumpTo while playing (smooth already), easeTo for manual steps.
  useEffect(() => {
    if (!active || !follow || !truck) return;
    const map = mapRef.current;
    if (!map) return;
    if (playing) map.jumpTo({ center: truck });
    else map.easeTo({ center: truck, duration: 350 });
  }, [active, follow, truck, playing, mapRef]);

  const idx = Math.min(Math.max(Math.round(p), 0), Math.max(n - 1, 0));
  useEffect(() => {
    if (active && n > 0) onFocus(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, idx, n]);

  return {
    active: active && n >= 2,
    n,
    p,
    idx,
    truck,
    playing,
    speed,
    follow,
    checkpoint: route?.checkpoints[idx] ?? null,
    toggle: () => {
      if (!playing && pRef.current >= n - 1) move(0);
      setPlaying((v) => !v);
    },
    next: () => {
      setPlaying(false);
      move(nextIndex(pRef.current, n));
    },
    prev: () => {
      setPlaying(false);
      move(prevIndex(pRef.current));
    },
    first: () => {
      setPlaying(false);
      move(0);
    },
    last: () => {
      setPlaying(false);
      move(n - 1);
    },
    scrub: (v: number) => {
      setPlaying(false);
      move(Math.min(n - 1, Math.max(0, v)));
    },
    cycleSpeed: () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]),
    setFollow,
  };
}

export type Trace = ReturnType<typeof useTrace>;
