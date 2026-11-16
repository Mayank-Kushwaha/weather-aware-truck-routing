import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import Map, { Layer, Marker, NavigationControl, Popup, Source, type LayerProps, type MapRef } from "react-map-gl/maplibre";
import { LEVEL_COLOR, LEVEL_LABEL, driverLabel, formatDateTime, hourLabel } from "../lib/format";
import { boundsOf, checkpointsGeoJSON, heatGeoJSON, heatWeightExpression, routesGeoJSON } from "../lib/mapData";
import type { AnalyzeResult, Place } from "../types";

maplibregl.setWorkerUrl(workerUrl);

const STYLE = "https://tiles.openfreemap.org/styles/positron";

interface Props {
  result: AnalyzeResult | null;
  origin: Place | null;
  destination: Place | null;
  selectedId: string;
  focusIndex: number | null;
  onSelect: (id: string) => void;
  onFocus: (i: number | null) => void;
}

const routeCasing: LayerProps = { id: "routes-casing", type: "line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 8, "line-opacity": 0.9 } };

function routeLine(selectedId: string): LayerProps {
  return {
    id: "routes-line",
    type: "line",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["get", "color"],
      "line-width": ["case", ["==", ["get", "id"], selectedId], 6, 3.5],
      "line-opacity": ["case", ["==", ["get", "id"], selectedId], 1, 0.6],
    },
  };
}

const checkpointLayer: LayerProps = {
  id: "checkpoints",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 8, 7, 12, 9],
    "circle-color": ["get", "color"],
    "circle-stroke-color": "#fff",
    "circle-stroke-width": 2,
  },
};

function heatLayer(hour: number): LayerProps {
  return {
    id: "heat",
    type: "heatmap",
    paint: {
      "heatmap-weight": heatWeightExpression(hour) as never,
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 9, 1],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 14, 5, 30, 7, 70, 9, 140, 11, 200],
      "heatmap-opacity": 0.85,
      "heatmap-color": [
        "interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(46,158,91,0)",
        0.06, "rgba(46,158,91,0.35)",
        0.22, "rgba(46,158,91,0.55)",
        0.36, "rgba(224,180,0,0.65)",
        0.55, "rgba(240,138,36,0.72)",
        0.78, "rgba(217,54,54,0.8)",
        1, "rgba(59,10,69,0.9)",
      ],
    },
  };
}

function MapViewImpl({ result, origin, destination, selectedId, focusIndex, onSelect, onFocus }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [hour, setHour] = useState(0);
  const [showHeat, setShowHeat] = useState(true);

  const routes = useMemo(() => (result ? routesGeoJSON(result) : null), [result]);
  const heat = useMemo(() => (result ? heatGeoJSON(result) : null), [result]);
  const selected = result?.routes.find((r) => r.id === selectedId) ?? null;
  const checkpoints = useMemo(() => (selected ? checkpointsGeoJSON(selected) : null), [selected]);
  const line = useMemo(() => routeLine(selectedId), [selectedId]);
  const heatStyle = useMemo(() => heatLayer(hour), [hour]);

  // Keep the canvas sized when the sidebar is dragged.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mapRef.current?.resize());
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!result) return;
    setHour(0);
    mapRef.current?.fitBounds(boundsOf(result.routes), { padding: { top: 60, bottom: 110, left: 60, right: 60 }, duration: 900 });
  }, [result]);

  const focused = selected && focusIndex !== null ? selected.checkpoints[focusIndex] : null;
  useEffect(() => {
    if (focused) mapRef.current?.easeTo({ center: [focused.lng, focused.lat], duration: 500 });
  }, [focused]);

  return (
    <div className="mapwrap" ref={wrapRef}>
      <Map
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={{ longitude: -96, latitude: 38.5, zoom: 3.6 }}
        mapStyle={STYLE}
        interactiveLayerIds={result ? ["routes-line", "checkpoints"] : []}
        cursor="auto"
        onClick={(e) => {
          const f = e.features?.[0];
          if (!f) return onFocus(null);
          if (f.layer.id === "checkpoints") onFocus(Number(f.properties?.index));
          else if (typeof f.properties?.id === "string") onSelect(f.properties.id);
        }}
        onMouseMove={(e) => {
          const c = e.target.getCanvas();
          c.style.cursor = e.features?.length ? "pointer" : "";
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        {heat && showHeat && (
          <Source id="heat" type="geojson" data={heat}>
            <Layer {...heatStyle} />
          </Source>
        )}
        {routes && (
          <Source id="routes" type="geojson" data={routes}>
            <Layer {...routeCasing} />
            <Layer {...line} />
          </Source>
        )}
        {checkpoints && (
          <Source id="checkpoints" type="geojson" data={checkpoints}>
            <Layer {...checkpointLayer} />
          </Source>
        )}
        {result && origin && <Marker longitude={origin.lng} latitude={origin.lat}><div className="pin a"><span>A</span></div></Marker>}
        {result && destination && <Marker longitude={destination.lng} latitude={destination.lat}><div className="pin b"><span>B</span></div></Marker>}
        {focused && (
          <Popup longitude={focused.lng} latitude={focused.lat} onClose={() => onFocus(null)} closeOnClick={false} offset={14} maxWidth="260px">
            <div className="popup">
              <strong>Mile {focused.mile}</strong>
              <div>ETA {formatDateTime(focused.eta)}</div>
              <div>
                <span className="pill" style={{ background: LEVEL_COLOR[focused.level] }}>{LEVEL_LABEL[focused.level]}</span>
                {focused.driver && <small> due to {driverLabel(focused.driver)}</small>}
              </div>
              {focused.weather && (
                <div className="wx">
                  Wind {focused.weather.wind_mph} mph · Rain {focused.weather.rain_in_hr} in/h · Snow {focused.weather.snow_in_hr} in/h
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {!result && <div className="hint">Enter a trip to compare 3 routes by weather risk.</div>}

      {result && (
        <div className="overlay slider">
          <label className="toggle">
            <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} /> Weather heatmap
          </label>
          <input
            type="range"
            min={0}
            max={result.heatmap_hours}
            step={1}
            value={hour}
            disabled={!showHeat}
            onChange={(e) => setHour(Number(e.target.value))}
            aria-label="Forecast hour after departure"
          />
          <div className="sliderlabel">
            <strong>{hour === 0 ? "Departure" : `+${hour} h`}</strong> · {hourLabel(result.departure, hour)}
            <span className="muted"> · forecast along the routes</span>
          </div>
        </div>
      )}

      <div className="overlay legend" aria-label="Risk legend">
        {(["low", "moderate", "high", "severe", "no_travel"] as const).map((l) => (
          <span key={l}><i style={{ background: LEVEL_COLOR[l] }} />{LEVEL_LABEL[l]}</span>
        ))}
      </div>
    </div>
  );
}

export const MapView = memo(MapViewImpl);
