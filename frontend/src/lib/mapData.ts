import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { AnalyzeResult, Route } from "../types";
import { LEVEL_COLOR } from "./format";

const ROUTE_COLORS = ["#1d4ed8", "#7c3aed", "#0f766e"];

/** Route identity colors are by rank so the recommended route is always the same color. */
export function routeColor(rank: number): string {
  return ROUTE_COLORS[(rank - 1) % ROUTE_COLORS.length];
}

export function routesGeoJSON(result: AnalyzeResult): FeatureCollection<LineString> {
  return {
    type: "FeatureCollection",
    features: result.routes.map(
      (r): Feature<LineString> => ({
        type: "Feature",
        properties: { id: r.id, color: routeColor(r.rank), rank: r.rank },
        geometry: r.geometry,
      }),
    ),
  };
}

export function checkpointsGeoJSON(route: Route): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: route.checkpoints.map(
      (c, i): Feature<Point> => ({
        type: "Feature",
        properties: { index: i, level: c.level, color: LEVEL_COLOR[c.level] },
        geometry: { type: "Point", coordinates: [c.lng, c.lat] },
      }),
    ),
  };
}

/**
 * All checkpoints of all routes with one numeric property per forecast hour (h0..h48).
 * MapLibre stringifies array properties inside GeoJSON sources, so hours are flattened.
 */
export function heatGeoJSON(result: AnalyzeResult): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const r of result.routes) {
    for (const c of r.checkpoints) {
      const props: Record<string, number> = {};
      c.scores_by_hour.forEach((s, h) => {
        if (s !== null) props[`h${h}`] = s;
      });
      features.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [c.lng, c.lat] } });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Heat weight for the chosen hour: risk score 0-4 scaled to 0-1 (Low adds no heat). */
export function heatWeightExpression(hour: number) {
  return ["/", ["coalesce", ["get", `h${hour}`], 0], 4];
}

export function boundsOf(routes: Route[]): [[number, number], [number, number]] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const r of routes) {
    for (const [x, y] of r.geometry.coordinates) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [[minX, minY], [maxX, maxY]];
}
