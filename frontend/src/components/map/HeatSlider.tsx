import { memo, useState } from "react";
import { hourLabel } from "@/lib/format";

interface Props {
  departure: string;
  maxHour: number;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  /** Called on every change; the map applies it imperatively so React never re-renders the map. */
  onHour: (hour: number) => void;
}

/** Owns only the label state, so dragging re-renders this tiny component and nothing else. */
function HeatSliderImpl({ departure, maxHour, enabled, onToggle, onHour }: Props) {
  const [hour, setHour] = useState(0);
  return (
    <div className="overlay slider">
      <label className="toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} /> Weather heatmap
      </label>
      <input
        type="range"
        min={0}
        max={maxHour}
        step={1}
        value={hour}
        disabled={!enabled}
        onChange={(e) => {
          const h = Number(e.target.value);
          setHour(h);
          onHour(h);
        }}
        aria-label="Forecast hour after departure"
      />
      <div className="sliderlabel">
        <strong>{hour === 0 ? "Departure" : `+${hour} h`}</strong> · {hourLabel(departure, hour)}
        <span className="muted"> · forecast along the routes</span>
      </div>
    </div>
  );
}

export const HeatSlider = memo(HeatSliderImpl);
