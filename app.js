const BACKEND_URL = 'https://crypto-backends-production.up.railway.app';

const TOKENS = [
  { short: 'BTC', name: 'Bitcoin',  icon: '₿', color: '#F7931A', bg: 'rgba(247,147,26,0.15)' },
  { short: 'ETH', name: 'Ethereum', icon: 'Ξ', color: '#627EEA', bg: 'rgba(98,126,234,0.15)' },
  { short: 'BNB', name: 'BNB',      icon: 'B', color: '#F3BA2F', bg: 'rgba(243,186,47,0.15)' },
  { short: 'SOL', name: 'Solana',   icon: '◎', color: '#9945FF', bg: 'rgba(153,69,255,0.15)' },
  { short: 'XRP', name: 'Ripple',   icon: '✕', color: '#00AAE4', bg: 'rgba(0,170,228,0.15)'  },
];

const EXCHANGES = [
  { id: 'binance', name: 'Binance', color: '#F3BA2F' },
  { id: 'mexc',    name: 'MEXC',    color: '#00B2FF' },
  { id: 'kucoin',  name: 'KuCoin',  color: '#00C076' },
  { id: 'okx',     name: 'OKX',     color: '#3D5AFE' },
];

let priceData = {};

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

async function fetchAllPrices() {
  const btn  = document.getElementById('refreshBtn');
  const icon = document.getElementById('refreshIcon');
  btn.disabled = true;
  icon.classList.add('spinning');

  try {
    const response = await fetch(`${BACKEND_URL}/prices`);
    const data = await response.json();

    TOKENS.forEach(token => {
      const tokenData = data[token.short];
      if (!tokenData) return;

      let mainPrice = null;

      EXCHANGES.forEach(ex => {
        const price = tokenData[ex.id];
        const el = document.querySelector(`.ex-price-${token.short}-${ex.id}`);
        if (!el) return;

        if (price && !isNaN(price)) {
          el.textContent = formatPrice(price);
          el.classList.remove('loading');
          el.style.transition = 'color 0.3s';
          el.style.color = '#00f5a0';
          setTimeout(() => { el.style.color = ''; }, 500);
          if (!mainPrice) mainPrice = price;
        } else {
          el.textContent = 'N/A';
          el.classList.remove('loading');
          el.classList.add('error');
        }
      });

      if (mainPrice) {
        const priceEl = document.getElementById('price-' + token.short);
        if (priceEl) {
          priceEl.textContent = formatPrice(mainPrice);
          priceEl.classList.remove('loading');
        }
      }
    });

    // Binance WebSocket for change %
    connectBinance();

    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      'Last updated: ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });

  } catch(e) {
    console.error('Fetch error:', e);
  }

  btn.disabled = false;
  icon.classList.remove('spinning');
}

function connectBinance() {
  const TOKENS_WS = ['btcusdt','ethusdt','bnbusdt','solusdt','xrpusdt'];
  const streams = TOKENS_WS.map(t => t + '@ticker').join('/');
  const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const data = msg.data;
    const short = data.s.replace('USDT', '');
    const change = parseFloat(data.P);

    const changeEl = document.getElementById('change-' + short);
    if (changeEl) {
      changeEl.textContent = formatChange(change);
      changeEl.className = 'change ' + (change >= 0 ? 'up' : 'down');
    }
  };

  ws.onclose = () => setTimeout(connectBinance, 3000);
}

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

// Auto refresh har 30 second
setInterval(fetchAllPrices, 30000);

// Start
buildCards();
fetchAllPrices();
