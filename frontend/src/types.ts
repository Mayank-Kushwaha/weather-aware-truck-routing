export type Level = "low" | "moderate" | "high" | "severe" | "no_travel" | "unknown";

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export interface Weather {
  wind_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
}

export interface Checkpoint {
  mile: number;
  lat: number;
  lng: number;
  eta: string;
  level: Level;
  score: number | null;
  driver: string | null;
  weather: Weather | null;
  scores_by_hour: (number | null)[];
}

export interface RouteStats {
  no_travel_mi: number;
  severe_mi: number;
  high_mi: number;
  moderate_mi: number;
  low_mi: number;
  unknown_mi: number;
  avg_risk: number;
}

export interface Route {
  id: string;
  rank: number;
  summary: string;
  is_detour: boolean;
  distance_mi: number;
  duration_s: number;
  eta: string;
  reason: string;
  no_travel: boolean;
  stats: RouteStats;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  checkpoints: Checkpoint[];
}

export type Criterion = "no_travel" | "severe" | "high" | "avg_risk" | "time";

/** One step of the lexicographic ranking: who was best on this criterion and who was eliminated. */
export interface LadderStep {
  criterion: Criterion;
  label: string;
  unit: string;
  values: Record<string, number>;
  survivors: string[];
  eliminated: string[];
  decisive: boolean;
}

export interface BriefStats {
  no_travel_mi: number;
  severe_mi: number;
  high_mi: number;
  avg_risk: number;
}

/** Departure advisor: is a later start materially safer, and does the winner survive a late start? */
export interface Advisor {
  status: "keep" | "delay" | "unknown";
  stable: boolean;
  flip: { delay_h: number; route_id: string } | null;
  headline?: string;
  delay_h?: number;
  route_id?: string;
  before?: BriefStats;
  after?: BriefStats;
}

export interface Timings {
  routing: number;
  weather: number;
  compute: number;
  total: number;
}

export interface AnalyzeResult {
  decision: { ladder: LadderStep[] };
  advisor: Advisor;
  timings_ms: Timings;
  recommended_id: string;
  departure: string;
  interval_mi: number;
  load_lb: number;
  heatmap_hours: number;
  warnings: string[];
  routes: Route[];
}

export interface Preset {
  id: string;
  title: string;
  kind: "harsh" | "calm";
  region: string;
  origin: Place;
  destination: Place;
  load_lb: number;
  interval_mi: 10 | 25 | 50;
  departure: string;
  peak: { level: Level; driver: string; value: number; unit: string; at: string };
}

export interface AnalyzeRequest {
  origin: Place;
  destination: Place;
  departure: string;
  load_lb: number;
  interval_mi: 10 | 25 | 50;
}
