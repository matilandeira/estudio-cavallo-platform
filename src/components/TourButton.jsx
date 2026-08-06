import React, { useEffect, useRef } from "react";
import { driver } from "driver.js";

const seenKey = (tourId) => `ec-tour-seen:${tourId}`;

/* "❓ Ayuda / Tutorial" button for a tab, backed by driver.js. Steps target
   real DOM elements via `data-tour="..."` attributes (see src/lib/tours.js
   for the step definitions) — driver.js resolves those as plain CSS
   selectors at click time, so nothing needs to be wired up with refs.
   `skipMissingElement` lets a step quietly skip itself if its target isn't
   in the DOM right now (e.g. an empty list, or a bulk-action bar that only
   appears once something is selected), instead of erroring the whole tour. */
export default function TourButton({ tourId, steps }) {
  const hasCheckedAutoStart = useRef(false);

  const runTour = () => {
    driver({
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente →",
      prevBtnText: "← Atrás",
      doneBtnText: "Listo",
      popoverClass: "ec-tour-popover",
      allowClose: true,
      overlayOpacity: 0.55,
      steps: steps.map((s) => ({ ...s, skipMissingElement: true })),
    }).drive();
  };

  useEffect(() => {
    // React 18 StrictMode (see main.jsx) double-invokes effects in dev —
    // this guard keeps the auto-tour from firing twice on first mount.
    if (hasCheckedAutoStart.current) return;
    hasCheckedAutoStart.current = true;

    const key = seenKey(tourId);
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    // Small delay so the tab's own first render (and anything it fetches
    // into view) has settled before driver.js measures elements to highlight.
    const t = setTimeout(runTour, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  return (
    <button onClick={runTour} className="ec-btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }}>
      ❓ Ayuda / Tutorial
    </button>
  );
}
