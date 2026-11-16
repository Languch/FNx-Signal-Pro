(function () {
  const host = window.location.hostname.toLowerCase();
  const isQuotex =
    host.includes('qx') ||
    host.includes('quotex') ||
    host.includes('broker') ||
    document.title.toLowerCase().includes('quotex');

  if (!isQuotex) return;

  let latestTicksBuffer = {};
  let activeDomAsset = '';

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'FNX_QUOTEX_BRIDGE') {
      return;
    }
    const ticks = event.data.ticks || [];
    ticks.forEach((t) => {
      if (t.asset && t.price > 0) {
        latestTicksBuffer[t.asset] = {
          asset: t.asset,
          price: t.price,
          payout: t.payout,
        };
      }
    });
  });

  function readActiveAssetFromDOM() {
    const selectors = [
      '.tab.active .label',
      '.tab--active .tab__label',
      '.pair-number-wrap .pair',
      '.asset-select__button-name',
      "[class*='tab'][class*='active'] [class*='label']",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length >= 3) {
        activeDomAsset = el.textContent.trim();
        break;
      }
    }
  }

  setInterval(() => {
    readActiveAssetFromDOM();
    const ticksArray = Object.values(latestTicksBuffer);
    // Send heartbeat even if ticks buffer is momentarily empty so status stays LIVE
    chrome.runtime.sendMessage({
      type: 'FNX_LIVE_TICKS',
      activeAsset: activeDomAsset || document.title,
      ticks: ticksArray,
      timestamp: Date.now(),
    });
    latestTicksBuffer = {};
  }, 500);
})();