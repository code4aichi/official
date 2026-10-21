/* v2.9.20: retain native filter bindings; decorative map copies are retired. */
(() => {
  'use strict';
  function install() {
    const shell = document.getElementById('v2918-shell');
    if (!shell) return false;
    shell.classList.add('v2919-ready');
    return true;
  }
  function boot() {
    if (install()) return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (install() || ++attempts >= 30) clearInterval(timer);
    }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
