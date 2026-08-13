/**
 * Freeze the page behind a dialog without losing the reader's place.
 *
 * ## Why not `body { overflow: hidden }`
 *
 * That was the original approach and it scrolled the page to the top every
 * time a dialog opened. `html, body { height: 100% }` in globals.css, and
 * `html` carries `overflow-x: clip` — so the root's overflow is not
 * `visible`, which means the BODY's overflow no longer propagates to the
 * viewport and body becomes its own scroll container instead. At exactly
 * viewport height with its content clipped, the document's scrollable range
 * collapses to one screen and the browser clamps the scroll offset to 0.
 * Nothing restored it on close, so every popup sent you back to the hero.
 * That is very visible on the landing page, where the demo sits far down.
 *
 * Instead we pin the body at its current offset with `position: fixed`, which
 * keeps the rendered position identical while making the page unscrollable,
 * then scroll back to the saved offset on release.
 *
 * ## Reference counting is required, not a nicety
 *
 * Dialogs stack: the commitment simulator opens the commitment form, and the
 * outlook chart opens a month breakdown from inside that same sheet. Once the
 * body is fixed, `window.scrollY` reads 0 — so a second naive lock would save
 * 0 and the first release would scroll the reader to the top, which is the
 * very bug this exists to fix. Only the outermost lock saves and restores.
 */

let depth = 0;
let savedY = 0;
/** Inline styles we overwrote, so an unrelated one set elsewhere survives. */
let previous: Record<string, string> = {};

const PROPS = ["position", "top", "left", "right", "width", "overflow", "paddingRight"] as const;

/**
 * Lock page scrolling. Returns the release function — call it exactly once,
 * from the same effect's cleanup.
 */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  const body = document.body;

  if (depth === 0) {
    savedY = window.scrollY;
    previous = {};
    for (const p of PROPS) previous[p] = body.style[p];

    // Removing the scrollbar would widen the content and shift it sideways;
    // pad by exactly the width the scrollbar occupied. 0 on overlay-scrollbar
    // platforms, so this is a no-op there.
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.position = "fixed";
    body.style.top = `-${savedY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
  }

  depth++;
  let released = false;

  return () => {
    // Guard against a double release, which would unlock while an outer
    // dialog is still open.
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth > 0) return;

    for (const p of PROPS) body.style[p] = previous[p] ?? "";
    // Restoring the styles alone leaves the viewport at 0; put the reader back.
    window.scrollTo(0, savedY);
  };
}
