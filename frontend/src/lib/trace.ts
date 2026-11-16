export type LngLat = [number, number];

export interface Path {
  coords: LngLat[];
  cum: number[]; // cumulative planar length at each vertex
  total: number;
}

/** Planar length is fine here: it is only used to interpolate positions along a drawn line. */
function seg(a: LngLat, b: LngLat): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]);
}

export function buildPath(coords: LngLat[]): Path {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + seg(coords[i - 1], coords[i]));
  return { coords, cum, total: cum[cum.length - 1] || 0 };
}

/** Position at a 0..1 fraction of the path length. */
export function pointAt(path: Path, frac: number): LngLat {
  const { coords, cum, total } = path;
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1 || total === 0) return coords[0];
  const target = Math.min(1, Math.max(0, frac)) * total;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const f = span === 0 ? 0 : (target - cum[lo]) / span;
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * f, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * f];
}

/** Route mile for a fractional checkpoint index (e.g. 2.5 is halfway between checkpoint 2 and 3). */
export function mileAtProgress(miles: number[], p: number): number {
  if (miles.length === 0) return 0;
  const i = Math.min(Math.max(Math.floor(p), 0), miles.length - 1);
  if (i === miles.length - 1) return miles[i];
  return miles[i] + (miles[i + 1] - miles[i]) * (p - i);
}

/** Index of the next checkpoint strictly after progress p (for the "next" button). */
export function nextIndex(p: number, n: number): number {
  return Math.min(n - 1, Math.floor(p + 1e-6) + 1);
}

/** Index of the previous checkpoint strictly before progress p. */
export function prevIndex(p: number): number {
  return Math.max(0, Math.ceil(p - 1e-6) - 1);
}
