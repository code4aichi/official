/* MIERU AICHI v2.9.3 - align PC card heights, leave tablet/mobile untouched. */
(() => {
  'use strict';
  const setup = () => {
    const map = document.querySelector('#explore .workspace > .map-column');
    const info = document.querySelector('#explore .workspace > .info-column');
    if (!map || !info) return;
    const mq = window.matchMedia('(min-width:1021px)');
    let raf = 0;
    let previous = -1;
    const apply = () => {
      raf = 0;
      if (!mq.matches) {
        map.style.removeProperty('min-height');
        info.style.removeProperty('min-height');
        previous = -1;
        return;
      }
      const baseline = window.innerHeight <= 760 ? 610 : 700;
      // The statistics panel can grow substantially. Cap map height to keep the
      // geographic view useful; leave long statistics scrollable on the page.
      const desired = Math.min(1160, Math.max(baseline, Math.ceil(info.getBoundingClientRect().height)));
      if (Math.abs(previous - desired) < 2) return;
      previous = desired;
      map.style.minHeight = `${desired}px`;
      info.style.minHeight = `${baseline}px`;
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(info);
    window.addEventListener('resize', schedule, {passive:true});
    mq.addEventListener?.('change', schedule);
    // Changes to panels usually affect the info-column height; observing it
    // handles tab changes and asynchronous statistics without intercepting events.
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
  else setup();
})();
