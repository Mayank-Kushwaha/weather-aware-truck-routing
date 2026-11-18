import type { LayerProps } from "react-map-gl/maplibre";
import { heatWeightExpression } from "@/lib/mapData";

/** Basemap: OpenFreeMap vector tiles, no key. The style and tile index are preloaded in index.html. */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export const HEAT_LAYER_ID = "heat";
export const ROUTE_LAYER_ID = "routes-line";
export const CHECKPOINT_LAYER_ID = "checkpoints";

export const routeCasing: LayerProps = {
  id: "routes-casing",
  type: "line",
  layout: { "line-cap": "round", "line-join": "round" },
  paint: { "line-color": "#fff", "line-width": 8, "line-opacity": 0.9 },
};

export function routeLine(selectedId: string): LayerProps {
  return {
    id: ROUTE_LAYER_ID,
    type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", ["==", ["get", "id"], selectedId], 6, 3.5],
      "line-opacity": ["case", ["==", ["get", "id"], selectedId], 1, 0.6],
    },
  };
}

/** Checkpoint dots; the focused one is larger with a dark ring. */
export function checkpointLayer(focusIndex: number | null): LayerProps {
  const at = ["==", ["get", "index"], focusIndex ?? -1];
  return {
    id: CHECKPOINT_LAYER_ID,
    type: "circle",
    // The expressions are valid MapLibre style spec; the generated TS union is too strict for case-inside-interpolate.
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, ["case", at, 8, 4], 8, ["case", at, 11, 7], 12, ["case", at, 13, 9]],
      "circle-color": ["get", "color"],
      "circle-stroke-color": ["case", at, "#0f1b2d", "#fff"],
      "circle-stroke-width": ["case", at, 3, 2],
    } as never,
  };
}

/** Heatmap layer. Weight is the only thing the slider changes (see HeatSlider and MapView.applyHour). */
export function heatLayer(hour: number): LayerProps {
  return {
    id: HEAT_LAYER_ID,
    type: "heatmap",
    paint: {
      "heatmap-weight": heatWeightExpression(hour) as never,
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 9, 1],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 14, 5, 30, 7, 70, 9, 140, 11, 200],
      "heatmap-opacity": 0.85,
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(46,158,91,0)",
        0.06,
        "rgba(46,158,91,0.35)",
        0.22,
        "rgba(46,158,91,0.55)",
        0.36,
        "rgba(224,180,0,0.65)",
        0.55,
        "rgba(240,138,36,0.72)",
        0.78,
        "rgba(217,54,54,0.8)",
        1,
        "rgba(59,10,69,0.9)",
      ],
    },
  };
}
