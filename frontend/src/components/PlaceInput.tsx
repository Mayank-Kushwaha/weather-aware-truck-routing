import { useEffect, useId, useRef, useState } from "react";
import { geocode } from "../api";
import type { Place } from "../types";

interface Props {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
}

/** Debounced autocomplete backed by /api/geocode. A place counts as chosen only after a suggestion is picked. */
export function PlaceInput({ label, value, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [options, setOptions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // Keep the text in sync when the parent sets a place directly (example button).
  useEffect(() => {
    if (value) setText(value.label);
  }, [value]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 3 || (value && value.label === text)) {
      setOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await geocode(q, ctrl.signal);
        if (mine === seq.current) {
          setOptions(res);
          setOpen(true);
          setError(null);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "Search failed");
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [text, value]);

  const pick = (p: Place) => {
    setText(p.label);
    setOptions([]);
    setOpen(false);
    onChange(p);
  };

  return (
    <div className="field place">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        autoComplete="off"
        placeholder="City or address"
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && open && options[0]) {
            e.preventDefault();
            pick(options[0]);
          }
        }}
      />
      {error && <small className="err">{error}</small>}
      {open && options.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="suggestions">
          {options.map((o) => (
            <li key={`${o.lat},${o.lng}`} role="option" aria-selected={false} onMouseDown={() => pick(o)}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
