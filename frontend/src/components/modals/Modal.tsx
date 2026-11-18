import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Accessible dialog: Esc and backdrop close, focus moves in and is trapped, background scroll is locked. */
export function Modal({ open, title, onClose, wide, children, footer }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: click-outside to close; keyboard users have Esc and the close button
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={box}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close" data-autofocus>
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
