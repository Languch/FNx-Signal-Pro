(function () {
  const host = window.location.hostname.toLowerCase();
  // Works on any Quotex mirror domain
  if (!host.includes('qx') && !host.includes('quotex') && !host.includes('broker')) {
    return;
  }

  const OriginalWebSocket = window.WebSocket;

  function parseQuotePayload(text) {
    try {
      // Find first '[' or '{' (skips Engine.IO '42', '\x04', '451-' prefixes)
      const firstBracket = text.indexOf('[');
      const firstBrace = text.indexOf('{');
      let startIdx = -1;
      if (firstBracket !== -1 && firstBrace !== -1) {
        startIdx = Math.min(firstBracket, firstBrace);
      } else {
        startIdx = Math.max(firstBracket, firstBrace);
      }
      if (startIdx === -1) return;

      const data = JSON.parse(text.substring(startIdx));
      const ticks = [];

      function scanForTicks(node) {
        if (!node) return;
        if (Array.isArray(node)) {
          // Format: ["EURUSD_otc", 1731489123, 1.08542, 0]
          if (
            node.length >= 3 &&
            typeof node[0] === 'string' &&
            node[0].length >= 4 &&
            node[0].length <= 24 &&
            typeof node[1] === 'number' &&
            typeof node[2] === 'number' &&
            node[2] > 0
          ) {
            ticks.push({ asset: node[0], price: node[2] });
            return;
          }
          // Format: ["EURUSD_otc", 1.08542]
          if (
            node.length === 2 &&
            typeof node[0] === 'string' &&
            node[0].length >= 4 &&
            node[0].length <= 24 &&
            typeof node[1] === 'number' &&
            node[1] > 0 &&
            node[1] < 1000000
          ) {
            ticks.push({ asset: node[0], price: node[1] });
            return;
          }
          for (let i = 0; i < node.length; i++) {
            scanForTicks(node[i]);
          }
        } else if (typeof node === 'object') {
          const asset = node.asset || node.pair || node.symbol;
          const price = parseFloat(node.price ?? node.close ?? node.value ?? node.quote);
          const payout = node.profit !== undefined ? Number(node.profit) : undefined;
          if (typeof asset === 'string' && !isNaN(price) && price > 0) {
            ticks.push({ asset, price, payout });
          }
        }
      }

      scanForTicks(data);

      if (ticks.length > 0) {
        window.postMessage({ source: 'FNX_QUOTEX_BRIDGE', ticks }, '*');
      }
    } catch (e) {}
  }

  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new OriginalWebSocket(url, protocols) : new OriginalWebSocket(url);

    ws.addEventListener('message', function (event) {

      if (typeof event.data === 'string') {
        parseQuotePayload(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        try {
          const decoded = new TextDecoder('utf-8').decode(event.data);
          parseQuotePayload(decoded);
        } catch (e) {}
      } else if (event.data instanceof Blob) {
        event.data.text().then((txt) => parseQuotePayload(txt)).catch(() => {});
      }
    });

    return ws;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
})();