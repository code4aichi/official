/* v2.9.19.2: Reuse the actual SVG map for Basic Information.
 * The existing app handles city selection, color updates and statistic rendering. */
(() => {
  'use strict';
  function install() {
    const shell = document.getElementById('v2918-shell');
    const map = document.getElementById('map-view');
    const detail = document.querySelector('#explore .info-column > .detail');
    if (!shell || !map || !detail) return false;
    if (shell.classList.contains('v29192-ready')) return true;
    shell.classList.add('v29192-ready');
    // We intentionally do NOT duplicate, move, or replace the live map DOM.
    // Existing listeners on its municipality geometry remain intact.
    return true;
  }
  function boot() {
    if (install()) return;
    let count = 0;
    const timer = setInterval(() => { if (install() || ++count > 80) clearInterval(timer); }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
