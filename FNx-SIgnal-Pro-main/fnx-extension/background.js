let cachedPrice = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'FNX_LIVE_TICKS') {
    const payload = {
      activeAsset: message.activeAsset,
      ticks: message.ticks || [],
      timestamp: message.timestamp,
    };

    if (payload.ticks.length > 0) {
      const normActive = (message.activeAsset || '').replace(/\s*\(OTC\)/i, '_otc').replace('/', '').toLowerCase();
      const match = payload.ticks.find((t) => t.asset.toLowerCase().includes(normActive));
      cachedPrice = match ? match.price : payload.ticks[0].price;
    }

    chrome.storage.local.set({
      fnxStatus: {
        connected: true,
        activeAsset: message.activeAsset || 'Quotex Chart',
        lastPrice: cachedPrice,
        lastUpdated: Date.now(),
      },
    });

    fetch('http://localhost:3000/api/bridge/push-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
});