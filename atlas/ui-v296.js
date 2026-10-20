/* MIERU AICHI v2.9.6: synchronize the sidebar to the fully visible map card.
   A self-contained, UI-only observer; does not change source data or map geometry. */
(() => {
  'use strict';
  const mq = window.matchMedia('(min-width: 1021px)');
  const mapCard = document.querySelector('#explore .workspace > .map-column');
  const workspace = document.querySelector('#explore .workspace');
  if (!mapCard || !workspace) return;
  let last = 0;
  let scheduled = false;
  const update = () => {
    scheduled = false;
    if (!mq.matches) {
      workspace.style.removeProperty('--v296-map-card-height');
      last = 0;
      return;
    }
    // Measure the map card, not the variable-height detail panel.
    const h = Math.ceil(mapCard.getBoundingClientRect().height);
    if (!(h > 0) || !Number.isFinite(h)) return;
    if (Math.abs(h - last) > 1) {
      workspace.style.setProperty('--v296-map-card-height', `${h}px`);
      last = h;
    }
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  };
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(schedule);
    observer.observe(mapCard);
  }
  if (typeof MutationObserver !== 'undefined') {
    const mapView = document.getElementById('map-view');
    if (mapView) new MutationObserver(schedule).observe(mapView, {childList:true, subtree:false});
  }
  mq.addEventListener?.('change', schedule);
  window.addEventListener('resize', schedule, {passive:true});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  schedule();
})();
