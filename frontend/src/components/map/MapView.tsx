import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import GLMap, { Layer, type MapRef, Marker, NavigationControl, Popup, Source } from "react-map-gl/maplibre";
import { HeatSlider } from "@/components/map/HeatSlider";
import {
  CHECKPOINT_LAYER_ID,
  checkpointLayer,
  HEAT_LAYER_ID,
  heatLayer,
  MAP_STYLE,
  ROUTE_LAYER_ID,
  routeCasing,
  routeLine,
} from "@/components/map/layers";
import { TracePanel } from "@/components/map/TracePanel";
import { useTrace } from "@/hooks/useTrace";
import { driverLabel, formatDateTime, LEVEL_COLOR, LEVEL_LABEL } from "@/lib/format";
import { boundsOf, checkpointsGeoJSON, heatGeoJSON, heatWeightExpression, routesGeoJSON } from "@/lib/mapData";
import type { AnalyzeResult, Place } from "@/types";

maplibregl.setWorkerUrl(workerUrl);

const FIT_PADDING = { top: 60, bottom: 110, left: 60, right: 60 };

interface Props {
  result: AnalyzeResult | null;
  origin: Place | null;
  destination: Place | null;
  selectedId: string;
  focusIndex: number | null;
  traceOn: boolean;
  onSelect: (id: string) => void;
  onFocus: (i: number | null) => void;
  onTraceClose: () => void;
}

export function MapViewImpl({ result, origin, destination, selectedId, focusIndex, traceOn, onSelect, onFocus, onTraceClose }: Props) {
  const mapRef = useRef<MapRef>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showHeat, setShowHeat] = useState(true);
  const hourRef = useRef(0);
  const rafRef = useRef(0);

  const routes = useMemo(() => (result ? routesGeoJSON(result) : null), [result]);
  const heat = useMemo(() => (result ? heatGeoJSON(result) : null), [result]);
  const selected = result?.routes.find((r) => r.id === selectedId) ?? null;
  const checkpoints = useMemo(() => (selected ? checkpointsGeoJSON(selected) : null), [selected]);
  const line = useMemo(() => routeLine(selectedId), [selectedId]);
  const cpStyle = useMemo(() => checkpointLayer(focusIndex), [focusIndex]);
  // Initial paint for the heat layer. Slider moves bypass React: see applyHour.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const heatStyle = useMemo(() => heatLayer(hourRef.current), [result, showHeat]);
  const trace = useTrace(selected, traceOn, mapRef, onFocus);

  /** Slider -> GPU. Coalesced to one paint update per frame; React and the Source data are untouched. */
  const applyHour = useCallback((hour: number) => {
    hourRef.current = hour;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const map = mapRef.current?.getMap();
      if (map?.getLayer(HEAT_LAYER_ID))
        map.setPaintProperty(HEAT_LAYER_ID, "heatmap-weight", heatWeightExpression(hourRef.current) as never);
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Keep the canvas sized when the sidebar is dragged.
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

  // New result: slider back to departure (remounting HeatSlider) and frame the trip.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!result) return;
    hourRef.current = 0;
    setVersion((v) => v + 1);
    mapRef.current?.fitBounds(boundsOf(result.routes), { padding: FIT_PADDING, duration: 900 });
  }, [result]);

  // Frame the whole trip again when a trace ends.
  const wasTracing = useRef(false);
  useEffect(() => {
    if (wasTracing.current && !traceOn && result) {
      mapRef.current?.fitBounds(boundsOf(result.routes), { padding: FIT_PADDING, duration: 900 });
    }
    wasTracing.current = traceOn;
  }, [traceOn, result]);

  const focused = selected && focusIndex !== null ? selected.checkpoints[focusIndex] : null;
  useEffect(() => {
    if (focused && !traceOn) mapRef.current?.easeTo({ center: [focused.lng, focused.lat], duration: 500 });
  }, [focused, traceOn]);

  return (
    <div className="mapwrap" ref={wrapRef}>
      <GLMap
        ref={mapRef}
        mapLib={maplibregl}
        initialViewState={{ longitude: -96, latitude: 38.5, zoom: 3.6 }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={result ? [ROUTE_LAYER_ID, CHECKPOINT_LAYER_ID] : []}
        cursor="auto"
        onClick={(e) => {
          const f = e.features?.[0];
          if (!f) return onFocus(null);
          if (f.layer.id === CHECKPOINT_LAYER_ID) onFocus(Number(f.properties?.index));
          else if (typeof f.properties?.id === "string") onSelect(f.properties.id);
        }}
        onMouseMove={(e) => {
          e.target.getCanvas().style.cursor = e.features?.length ? "pointer" : "";
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
            <Layer {...cpStyle} />
          </Source>
        )}
        {trace.active && trace.truck && (
          <Marker longitude={trace.truck[0]} latitude={trace.truck[1]} anchor="center">
            <div className={`truck ${trace.playing ? "moving" : ""}`} role="img" aria-label="Truck position">
              <span>🚚</span>
            </div>
          </Marker>
        )}
        {result && origin && (
          <Marker longitude={origin.lng} latitude={origin.lat}>
            <div className="pin a">
              <span>A</span>
            </div>
          </Marker>
        )}
        {result && destination && (
          <Marker longitude={destination.lng} latitude={destination.lat}>
            <div className="pin b">
              <span>B</span>
            </div>
          </Marker>
        )}
        {focused && !traceOn && (
          <Popup
            longitude={focused.lng}
            latitude={focused.lat}
            onClose={() => onFocus(null)}
            closeOnClick={false}
            offset={14}
            maxWidth="260px"
          >
            <div className="popup">
              <strong>Mile {focused.mile}</strong>
              <div>ETA {formatDateTime(focused.eta)}</div>
              <div>
                <span className="pill" style={{ background: LEVEL_COLOR[focused.level] }}>
                  {LEVEL_LABEL[focused.level]}
                </span>
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
      </GLMap>

      {trace.active && selected && <TracePanel trace={trace} routeRank={selected.rank} onClose={onTraceClose} />}
      {!result && <div className="hint">Enter a trip to compare 3 routes by weather risk.</div>}
      {result && (
        <HeatSlider
          key={version}
          departure={result.departure}
          maxHour={result.heatmap_hours}
          enabled={showHeat}
          onToggle={setShowHeat}
          onHour={applyHour}
        />
      )}

      <div className="overlay legend" role="group" aria-label="Risk legend">
        {(["low", "moderate", "high", "severe", "no_travel"] as const).map((l) => (
          <span key={l}>
            <i style={{ background: LEVEL_COLOR[l] }} />
            {LEVEL_LABEL[l]}
          </span>
        ))}
      </div>
    </div>
  );
}

export const MapView = memo(MapViewImpl);
export default MapView;
