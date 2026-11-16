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

export interface AnalyzeResult {
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
