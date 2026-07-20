/**
 * Fixed gradient artwork behind the whole app.
 *
 * Two soft radial halos carry the diffuse colour wash; four gradient blobs with
 * asymmetric border-radii sit in front of them at different Z depths, rotating
 * so their silhouettes read as fluid. A veil in the page colour goes over the
 * lot, which is what keeps dashboard text legible on top of saturated artwork.
 *
 * All styling lives in globals.css (.bd*). Not a client component — this is
 * static markup with no state.
 */
export function Backdrop() {
  return (
    <div className="bd" aria-hidden="true">
      <div className="bd-stage">
        <div className="bd-glow bd-glow-1" />
        <div className="bd-glow bd-glow-2" />
        <div className="bd-blob bd-blob-1" />
        <div className="bd-blob bd-blob-2" />
        <div className="bd-blob bd-blob-3" />
        <div className="bd-blob bd-blob-4" />
      </div>
      {/* Outside the stage and last in the DOM, so it paints over every blob. */}
      <div className="bd-veil" />
    </div>
  );
}
