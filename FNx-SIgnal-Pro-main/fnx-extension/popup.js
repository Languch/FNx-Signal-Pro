function refreshPopup() {
  chrome.storage.local.get(['fnxStatus'], (res) => {
    const st = res.fnxStatus;
    const statusEl = document.getElementById('statusText');
    const assetEl = document.getElementById('assetText');
    const priceEl = document.getElementById('priceText');

    if (st && Date.now() - st.lastUpdated < 5000) {
      statusEl.textContent = '● Bridge Connected (LIVE)';
      statusEl.className = 'status live';
      assetEl.textContent = 'Active Asset: ' + (st.activeAsset || '--');
      if (st.lastPrice) {
        priceEl.textContent = 'Last Tick: ' + st.lastPrice;
      }
    } else {
      statusEl.textContent = '● Waiting for Quotex Chart';
      statusEl.className = 'status wait';
    }
  });
}
refreshPopup();
setInterval(refreshPopup, 1000);