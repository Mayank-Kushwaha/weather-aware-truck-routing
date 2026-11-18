import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";

const KEY = "sidebar-width";
const MIN = 320;
const MAX = 680;
const DEFAULT = 420;
const STEP = 16;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n)));

function apply(px: number) {
  document.documentElement.style.setProperty("--sw", `${px}px`);
}

function stored(): number {
  const n = Number(localStorage.getItem(KEY));
  return Number.isFinite(n) && n > 0 ? clamp(n) : DEFAULT;
}

/**
 * Drag handle between sidebar and map. While dragging only a CSS variable changes (no React re-render),
 * the width is saved on release. Arrow keys resize, double-click resets.
 */
export function Resizer() {
  const [width, setWidth] = useState(stored);
  const [dragging, setDragging] = useState(false);
  const live = useRef(width);

  useEffect(() => {
    apply(width);
    live.current = width;
  }, [width]);

  const commit = (px: number) => {
    const v = clamp(px);
    apply(v);
    live.current = v;
    setWidth(v);
    localStorage.setItem(KEY, String(v));
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    document.body.classList.add("resizing");
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const v = clamp(e.clientX);
    live.current = v;
    requestAnimationFrame(() => apply(v));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    document.body.classList.remove("resizing");
    commit(live.current);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") commit(live.current - STEP);
    else if (e.key === "ArrowRight") commit(live.current + STEP);
    else if (e.key === "Home") commit(MIN);
    else if (e.key === "End") commit(MAX);
    else return;
    e.preventDefault();
  };

  return (
    <div
      className={`resizer ${dragging ? "active" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={() => commit(DEFAULT)}
      onKeyDown={onKey}
    >
      <span className="grip" />
    </div>
  );
}
