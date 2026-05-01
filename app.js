// ── TOKENS ──
const TOKENS = [
  { binance: 'btcusdt', mexc: 'BTCUSDT', kucoin: 'BTC-USDT', okx: 'BTC-USDT', short: 'BTC', name: 'Bitcoin',  icon: '₿', color: '#F7931A', bg: 'rgba(247,147,26,0.15)' },
  { binance: 'ethusdt', mexc: 'ETHUSDT', kucoin: 'ETH-USDT', okx: 'ETH-USDT', short: 'ETH', name: 'Ethereum', icon: 'Ξ', color: '#627EEA', bg: 'rgba(98,126,234,0.15)' },
  { binance: 'bnbusdt', mexc: 'BNBUSDT', kucoin: 'BNB-USDT', okx: 'BNB-USDT', short: 'BNB', name: 'BNB',      icon: 'B', color: '#F3BA2F', bg: 'rgba(243,186,47,0.15)' },
  { binance: 'solusdt', mexc: 'SOLUSDT', kucoin: 'SOL-USDT', okx: 'SOL-USDT', short: 'SOL', name: 'Solana',   icon: '◎', color: '#9945FF', bg: 'rgba(153,69,255,0.15)' },
  { binance: 'xrpusdt', mexc: 'XRPUSDT', kucoin: 'XRP-USDT', okx: 'XRP-USDT', short: 'XRP', name: 'Ripple',   icon: '✕', color: '#00AAE4', bg: 'rgba(0,170,228,0.15)'  },
];

const EXCHANGES = [
  { id: 'binance', name: 'Binance', color: '#F3BA2F' },
  { id: 'mexc',    name: 'MEXC',    color: '#00B2FF' },
  { id: 'kucoin',  name: 'KuCoin',  color: '#00C076' },
  { id: 'okx',     name: 'OKX',     color: '#3D5AFE' },
];

let priceData = {};

// ── FORMAT PRICE ──
function formatPrice(price) {
  if (!price || isNaN(price)) return '---';
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)    return '$' + price.toFixed(4);
  return '$' + price.toFixed(6);
}

function formatChange(change) {
  if (change === null || change === undefined || isNaN(change)) return null;
  return (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
}

// ── CARDS BANAO ──
function buildCards() {
  const grid = document.getElementById('tokenGrid');
  grid.innerHTML = '';

  TOKENS.forEach((token) => {
    const exRows = EXCHANGES.map(ex => `
      <div class="ex-row" data-exchange="${ex.id}">
        <span class="ex-name">
          <span class="ex-dot" style="background:${ex.color}"></span>
          ${ex.name}
        </span>
        <span class="ex-price loading ex-price-${token.short}-${ex.id}">Loading...</span>
      </div>
    `).join('');

    const card = document.createElement('div');
    card.className = 'token-card';
    card.id = 'card-' + token.short;
    card.dataset.symbol = token.short;

    card.innerHTML = `
      <div class="card-top">
        <div class="token-info">
          <div class="token-icon" style="background:${token.bg}; color:${token.color}">
            ${token.icon}
          </div>
          <div>
            <div class="token-symbol">${token.short}</div>
            <div class="token-name">${token.name}</div>
          </div>
        </div>
        <div class="usdt-badge">USDT</div>
      </div>
      <div class="price-row">
        <div class="price loading" id="price-${token.short}">Loading...</div>
        <div class="change neutral" id="change-${token.short}">--%</div>
      </div>
      <div class="exchange-prices">${exRows}</div>
    `;

    grid.appendChild(card);
  });
}

// ── PRICE UPDATE ──
function updateExchangePrice(short, exchangeId, price) {
  const el = document.querySelector(`.ex-price-${short}-${exchangeId}`);
  if (!el) return;

  el.textContent = formatPrice(price);
  el.classList.remove('loading');

  // Flash animation
  el.style.transition = 'color 0.3s';
  el.style.color = '#00f5a0';
  setTimeout(() => { el.style.color = ''; }, 500);

  // Save karo
  if (!priceData[short]) priceData[short] = {};
  priceData[short][exchangeId] = price;

  // Main price update karo (Binance se)
  if (exchangeId === 'binance') {
    const priceEl = document.getElementById('price-' + short);
    if (priceEl) {
      priceEl.textContent = formatPrice(price);
      priceEl.classList.remove('loading');
    }
  }

  // Time update
  const now = new Date();
  document.getElementById('lastUpdated').textContent =
    'Last updated: ' + now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// ── BINANCE WEBSOCKET ──
function connectBinance() {
  const streams = TOKENS.map(t => t.binance + '@ticker').join('/');
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const data = msg.data;
    const token = TOKENS.find(t => t.binance === data.s.toLowerCase());
    if (!token) return;

    const price  = parseFloat(data.c);
    const change = parseFloat(data.P);

    updateExchangePrice(token.short, 'binance', price);

    // Change badge update
    const changeEl = document.getElementById('change-' + token.short);
    if (changeEl) {
      changeEl.textContent = formatChange(change);
      changeEl.className = 'change ' + (change >= 0 ? 'up' : 'down');
    }
  };

  ws.onclose = () => setTimeout(connectBinance, 3000);
}

// ── MEXC WEBSOCKET ──
function connectMEXC() {
  const ws = new WebSocket('wss://wbs.mexc.com/ws');

  ws.onopen = () => {
    TOKENS.forEach(token => {
      ws.send(JSON.stringify({
        method: 'SUBSCRIPTION',
        params: [`spot@public.miniTicker.v3.api@${token.mexc}`]
      }));
    });
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (!msg.d || !msg.s) return;

      const token = TOKENS.find(t => t.mexc === msg.s);
      if (!token) return;

      const price = parseFloat(msg.d.c);
      if (!isNaN(price)) updateExchangePrice(token.short, 'mexc', price);
    } catch(e) {}
  };

  ws.onclose = () => setTimeout(connectMEXC, 3000);
}

// ── KUCOIN WEBSOCKET ──
async function connectKuCoin() {
  try {
    // KuCoin token maango pehle
    const res = await fetch('https://api.kucoin.com/api/v1/bullet-public', { method: 'POST' });
    const data = await res.json();
    const endpoint = data.data.instanceServers[0].endpoint;
    const token = data.data.token;

    const ws = new WebSocket(`${endpoint}?token=${token}`);

    ws.onopen = () => {
      const symbols = TOKENS.map(t => t.kucoin).join(',');
      ws.send(JSON.stringify({
        id: Date.now(),
        type: 'subscribe',
        topic: `/market/ticker:${symbols}`,
        response: true
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== 'message') return;

        const symbol = msg.topic.split(':')[1];
        const token = TOKENS.find(t => t.kucoin === symbol);
        if (!token) return;

        const price = parseFloat(msg.data.price);
        if (!isNaN(price)) updateExchangePrice(token.short, 'kucoin', price);
      } catch(e) {}
    };

    ws.onclose = () => setTimeout(connectKuCoin, 3000);
  } catch(e) {
    setTimeout(connectKuCoin, 5000);
  }
}

// ── OKX WEBSOCKET ──
function connectOKX() {
  const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');

  ws.onopen = () => {
    const args = TOKENS.map(t => ({ channel: 'tickers', instId: t.okx }));
    ws.send(JSON.stringify({ op: 'subscribe', args }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (!msg.data || !msg.data[0]) return;

      const instId = msg.data[0].instId;
      const token = TOKENS.find(t => t.okx === instId);
      if (!token) return;

      const price = parseFloat(msg.data[0].last);
      if (!isNaN(price)) updateExchangePrice(token.short, 'okx', price);
    } catch(e) {}
  };

  ws.onclose = () => setTimeout(connectOKX, 3000);
}

// ── FILTER ──
function filterExchange(id, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  document.querySelectorAll('.ex-row').forEach(row => {
    if (id === 'all') {
      row.style.display = '';
    } else {
      row.style.display = row.dataset.exchange === id ? '' : 'none';
    }
  });
}

function fetchAllPrices() {
  connectBinance();
  connectMEXC();
  connectKuCoin();
  connectOKX();
}

// ── START ──
buildCards();
connectBinance();
connectMEXC();
connectKuCoin();
connectOKX();