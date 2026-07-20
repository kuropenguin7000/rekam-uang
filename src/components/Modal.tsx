"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Shared dialog shell for the add/edit modals.
 *
 * Renders through a portal into <body> on purpose. A `position: fixed` overlay
 * is only relative to the viewport while no ancestor has a transform, filter or
 * perspective — any of those become its containing block instead. The dashboard
 * has both (the tab-switch entrance keeps a transform after it finishes, and
 * cards lift on hover), which sized the overlay to that element and pushed the
 * dialog off-screen. Portalling out of the tree removes the whole hazard.
 *
 * The overlay scrolls rather than centring rigidly, so a tall dialog stays
 * reachable on a short phone screen instead of overflowing off both ends.
 */
export function Modal({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  // Close on Escape, and stop the page behind from scrolling while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Modals only mount from a user action, so document always exists by now;
  // this guard just keeps the static export's prerender pass safe.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className="animate-pop w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
