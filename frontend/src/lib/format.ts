import type { Level } from "../types";

export const LEVEL_LABEL: Record<Level, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
  no_travel: "No Travel",
  unknown: "No data",
};

export const LEVEL_COLOR: Record<Level, string> = {
  low: "#2e9e5b",
  moderate: "#e0b400",
  high: "#f08a24",
  severe: "#d93636",
  no_travel: "#3b0a45",
  unknown: "#9aa3ad",
};

export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${m.toString().padStart(2, "0")} m` : `${m} m`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatMiles(mi: number): string {
  return `${mi.toLocaleString(undefined, { maximumFractionDigits: mi < 10 ? 1 : 0 })} mi`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInputValue(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function hourLabel(departureIso: string, hour: number): string {
  const t = new Date(new Date(departureIso).getTime() + hour * 3_600_000);
  return t.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

export function driverLabel(driver: string | null): string {
  switch (driver) {
    case "wind":
      return "wind";
    case "rain":
      return "rain";
    case "snow":
      return "snow";
    case "wind+load":
      return "wind with heavy load";
    default:
      return "";
  }
}
