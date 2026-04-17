const STOCKS = [
  { symbol: "AAPL", name: "Apple", sector: "Technology", base: 190 },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology", base: 430 },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer", base: 180 },
  { symbol: "TSLA", name: "Tesla", sector: "Automotive", base: 175 },
  { symbol: "JPM", name: "JPMorgan", sector: "Financials", base: 200 }
];

const NEWS = {
  AAPL: ["Apple expands AI features in latest update", "Analysts positive on iPhone demand"],
  MSFT: ["Cloud growth remains resilient for Microsoft", "Enterprise AI adoption accelerates"],
  AMZN: ["E-commerce margins improve in latest quarter", "Amazon invests in logistics automation"],
  TSLA: ["Tesla deliveries show mixed regional trend", "Battery efficiency update draws attention"],
  JPM: ["JPMorgan reports stable credit quality", "Banking sector watches rate decision"]
};

const POSITIVE = ["positive", "growth", "improve", "resilient", "accelerates"];
const NEGATIVE = ["mixed", "risk", "fall", "weak", "decline"];
const INITIAL_HISTORY_POINTS = 80;
const MAX_HISTORY_POINTS = 100;
const TICK_INTERVAL_MS = 2000;
const PREDICTION_CONF_MIN = 52;
const PREDICTION_CONF_MAX = 95;
const PREDICTION_CONF_BASE = 60;
const PREDICTION_CONF_SCALE = 4;
const DEMO_AUTH_WARNING = "Demo-only local auth (not for production use).";

let selectedSymbol = "AAPL";
let user = localStorage.getItem("user") || "";
let series = {};
let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
let portfolio = JSON.parse(localStorage.getItem("portfolio") || "{}");
let alerts = JSON.parse(localStorage.getItem("alerts") || "[]");

STOCKS.forEach((stock) => {
  const values = [];
  let p = stock.base;
  for (let i = 0; i < INITIAL_HISTORY_POINTS; i += 1) {
    p += (Math.random() - 0.48) * 2;
    values.push(Number(p.toFixed(2)));
  }
  series[stock.symbol] = values;
});

const el = (id) => document.getElementById(id);

function saveState() {
  localStorage.setItem("favorites", JSON.stringify(favorites));
  localStorage.setItem("portfolio", JSON.stringify(portfolio));
  localStorage.setItem("alerts", JSON.stringify(alerts));
}

function movingAverage(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (!losses) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function ema(values, period) {
  const k = 2 / (period + 1);
  let prev = values[0];
  for (let i = 1; i < values.length; i += 1) prev = values[i] * k + prev * (1 - k);
  return prev;
}

function macd(values) {
  if (values.length < 26) return null;
  return ema(values, 12) - ema(values, 26);
}

function predict(values) {
  if (values.length < 2) {
    return { direction: "UP", confidence: PREDICTION_CONF_MIN, reason: "Insufficient data." };
  }
  const last = values.at(-1);
  const ma10 = movingAverage(values, 10);
  const momentum = last - (values.length >= 6 ? values.at(-6) : values[0]);
  const score = ((ma10 === null ? 0 : last - ma10)) + momentum * 0.8;
  const direction = score >= 0 ? "UP" : "DOWN";
  const confidence = Math.min(
    PREDICTION_CONF_MAX,
    Math.max(PREDICTION_CONF_MIN, Math.round(PREDICTION_CONF_BASE + Math.abs(score) * PREDICTION_CONF_SCALE))
  );
  return {
    direction,
    confidence,
    reason: `Price vs MA10 (${(last - ma10).toFixed(2)}) and 5-period momentum (${momentum.toFixed(2)}) imply ${direction}.`
  };
}

function sentimentScore(headline) {
  const lower = headline.toLowerCase();
  let score = 0;
  POSITIVE.forEach((w) => { if (lower.includes(w)) score += 1; });
  NEGATIVE.forEach((w) => { if (lower.includes(w)) score -= 1; });
  return score;
}

function drawChart(values) {
  const canvas = el("chart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = 20;
  const scaleX = (canvas.width - 2 * pad) / (values.length - 1);
  const scaleY = (canvas.height - 2 * pad) / (max - min || 1);
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad + i * scaleX;
    const y = canvas.height - pad - (v - min) * scaleY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderStocks() {
  const term = el("search").value.toLowerCase();
  const sector = el("sector-filter").value;
  const root = el("stock-list");
  root.innerHTML = "";
  STOCKS.filter((s) => {
    const matchesTerm = !term || s.name.toLowerCase().includes(term) || s.symbol.toLowerCase().includes(term);
    const matchesSector = !sector || s.sector === sector;
    return matchesTerm && matchesSector;
  }).forEach((s) => {
    const row = document.createElement("div");
    row.className = "stock-item";
    const price = series[s.symbol].at(-1);
    row.innerHTML = `<div><strong>${s.symbol}</strong> · ${s.name} (${s.sector})<br/>$${price.toFixed(2)}</div>`;
    const right = document.createElement("div");
    const open = document.createElement("button");
    open.textContent = "View";
    open.onclick = () => { selectedSymbol = s.symbol; renderSelected(); };
    const fav = document.createElement("button");
    fav.textContent = favorites.includes(s.symbol) ? "★" : "☆";
    fav.onclick = () => {
      if (favorites.includes(s.symbol)) favorites = favorites.filter((x) => x !== s.symbol);
      else favorites.push(s.symbol);
      saveState();
      renderFavorites();
      renderStocks();
    };
    right.append(open, fav);
    row.append(right);
    root.append(row);
  });
}

function renderFavorites() {
  const root = el("favorites");
  root.innerHTML = "";
  favorites.forEach((symbol) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = symbol;
    chip.onclick = () => { selectedSymbol = symbol; renderSelected(); };
    root.append(chip);
  });
  if (!favorites.length) root.textContent = "No favorites yet.";
}

function renderPortfolio() {
  const items = Object.entries(portfolio);
  const summary = el("portfolio-summary");
  if (!items.length) {
    summary.textContent = "No holdings yet.";
    return;
  }
  let invested = 0;
  let value = 0;
  const rows = items.map(([symbol, shares]) => {
    const stock = STOCKS.find((s) => s.symbol === symbol);
    const current = series[symbol].at(-1);
    invested += stock.base * shares;
    value += current * shares;
    return `<li>${symbol}: ${shares} shares · $${(current * shares).toFixed(2)}</li>`;
  }).join("");
  const perf = ((value - invested) / invested) * 100;
  summary.innerHTML = `<ul>${rows}</ul><p>Total value: $${value.toFixed(2)} · P/L: ${perf.toFixed(2)}%</p>`;
}

function renderNews(symbol) {
  const root = el("news-list");
  root.innerHTML = "";
  (NEWS[symbol] || []).forEach((headline) => {
    const li = document.createElement("li");
    const score = sentimentScore(headline);
    const sentiment = score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral";
    li.textContent = `${headline} — Sentiment: ${sentiment}`;
    root.append(li);
  });
}

function renderAlerts() {
  const root = el("alert-log");
  root.innerHTML = "";
  alerts.forEach((a) => {
    const li = document.createElement("li");
    li.textContent = `${a.symbol}: price ≥ ${a.priceTarget ?? "-"} / prediction ${a.predictionTarget ?? "-"} (${a.status ?? "active"})`;
    root.append(li);
  });
}

function updateAuthStatus() {
  el("auth-status").textContent = user
    ? `Signed in as ${user}. ${DEMO_AUTH_WARNING}`
    : `Not signed in (guest mode). ${DEMO_AUTH_WARNING}`;
}

function maybeNotify(message) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(message);
    } catch (_) {}
  }
}

async function hashPassword(username, password, createSalt) {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    let salt = localStorage.getItem(`salt:${username}`);
    if (!salt && createSalt) {
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      salt = btoa(String.fromCharCode(...saltBytes));
      localStorage.setItem(`salt:${username}`, salt);
    }
    if (!salt) return null;
    const bytes = new TextEncoder().encode(password);
    const keyMaterial = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
    const saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0));
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    return `pbkdf2:${[...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

function renderSelected() {
  const stock = STOCKS.find((s) => s.symbol === selectedSymbol);
  const values = series[selectedSymbol];
  const latest = values.at(-1);
  const ma20 = movingAverage(values, 20);
  const rsi14 = rsi(values);
  const macdValue = macd(values);
  const p = predict(values);
  el("selected-stock-title").textContent = `${stock.name} (${stock.symbol})`;
  el("selected-stock-meta").textContent = `${stock.sector} · Latest: $${latest.toFixed(2)} · Historical points: ${values.length}`;
  el("chart").setAttribute("aria-label", `${stock.symbol} stock chart, latest price ${latest.toFixed(2)} dollars`);
  drawChart(values);
  el("indicators").innerHTML = [
    `MA20: ${ma20 === null ? "N/A" : ma20.toFixed(2)}`,
    `RSI14: ${rsi14 === null ? "N/A" : rsi14.toFixed(2)}`,
    `MACD: ${macdValue === null ? "N/A" : macdValue.toFixed(2)}`,
    `AI prediction: ${p.direction} (${p.confidence}%)`
  ].map((m) => `<div class="card">${m}</div>`).join("");
  el("analysis").textContent = `Explainable AI: ${p.reason}`;
  renderNews(stock.symbol);
  renderPortfolio();
  renderAlerts();
}

function tick() {
  STOCKS.forEach((s) => {
    const arr = series[s.symbol];
    const next = Number((arr.at(-1) + (Math.random() - 0.5) * 1.6).toFixed(2));
    arr.push(Math.max(1, next));
    if (arr.length > MAX_HISTORY_POINTS) arr.shift();
  });
  alerts = alerts.map((a) => {
    if (a.status === "triggered") return a;
    const p = predict(series[a.symbol]);
    const priceHit = a.priceTarget !== null && a.priceTarget !== undefined && series[a.symbol].at(-1) >= a.priceTarget;
    const predHit = a.predictionTarget && p.direction === a.predictionTarget;
    if (priceHit || predHit) {
      maybeNotify(`Alert triggered for ${a.symbol}`);
      return { ...a, status: "triggered" };
    }
    return a;
  });
  saveState();
  renderStocks();
  renderSelected();
}

function init() {
  const sectorFilter = el("sector-filter");
  [...new Set(STOCKS.map((s) => s.sector))].forEach((sector) => {
    const opt = document.createElement("option");
    opt.value = sector;
    opt.textContent = sector;
    sectorFilter.append(opt);
  });

  ["search", "sector-filter"].forEach((id) => el(id).addEventListener("input", renderStocks));

  el("signup-btn").onclick = async () => {
    const u = el("username").value.trim();
    const p = el("password").value;
    if (!u || !p) return;
    const hashed = await hashPassword(u, p, true);
    if (!hashed) {
      el("auth-status").textContent = "Secure auth unavailable in this browser.";
      return;
    }
    localStorage.setItem(`auth:${u}`, hashed);
    user = u;
    localStorage.setItem("user", user);
    updateAuthStatus();
  };

  el("login-btn").onclick = async () => {
    const u = el("username").value.trim();
    const p = el("password").value;
    const saved = localStorage.getItem(`auth:${u}`);
    const hashed = await hashPassword(u, p, false);
    if (!hashed) {
      el("auth-status").textContent = "Secure auth unavailable in this browser.";
      return;
    }
    if (saved && saved === hashed) {
      user = u;
      localStorage.setItem("user", user);
      updateAuthStatus();
    } else {
      el("auth-status").textContent = "Login failed.";
    }
  };

  el("logout-btn").onclick = () => {
    user = "";
    localStorage.removeItem("user");
    updateAuthStatus();
  };

  el("portfolio-form").onsubmit = (e) => {
    e.preventDefault();
    const shares = Number(el("shares").value);
    if (!Number.isFinite(shares) || shares < 1) {
      el("portfolio-summary").textContent = "Please enter a valid share count.";
      return;
    }
    portfolio[selectedSymbol] = (portfolio[selectedSymbol] || 0) + shares;
    saveState();
    renderPortfolio();
    e.target.reset();
  };

  el("alert-form").onsubmit = (e) => {
    e.preventDefault();
    const priceTarget = Number(el("price-alert").value);
    if (!Number.isFinite(priceTarget)) {
      el("alert-log").innerHTML = "<li>Please enter a valid price target.</li>";
      return;
    }
    const predictionTarget = el("prediction-alert").value;
    alerts.push({
      symbol: selectedSymbol,
      priceTarget,
      predictionTarget,
      status: "active"
    });
    saveState();
    renderAlerts();
    e.target.reset();
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
  };

  updateAuthStatus();
  renderStocks();
  renderFavorites();
  renderSelected();
  setInterval(tick, TICK_INTERVAL_MS);
}

init();
