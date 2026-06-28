'use strict';

// ── Theme ──────────────────────────────────────────────────────────────────
const root     = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const sunIcon  = themeBtn.querySelector('.sun-icon');
const moonIcon = themeBtn.querySelector('.moon-icon');

let dark = localStorage.getItem('theme')
  ? localStorage.getItem('theme') === 'dark'
  : window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyTheme() {
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  sunIcon.style.display  = dark ? 'none' : '';
  moonIcon.style.display = dark ? ''     : 'none';
}
applyTheme();

themeBtn.addEventListener('click', () => {
  dark = !dark;
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme();
});

// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.converter').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!isFinite(n) || isNaN(n)) return '—';
  if (Math.abs(n) > 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(4);
  const abs = Math.abs(n);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n);
}

function fill(el, opts, defaultVal) {
  const prev = el.value || defaultVal;
  el.innerHTML = '';
  opts.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if (value === prev) o.selected = true;
    el.appendChild(o);
  });
  if (!el.value) el.value = defaultVal;
}

function wire(fromSel, toSel, inputEl, swapBtn, convertFn) {
  fromSel.addEventListener('change', convertFn);
  toSel.addEventListener('change', convertFn);
  inputEl.addEventListener('input', convertFn);
  swapBtn.addEventListener('click', () => {
    [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
    convertFn();
  });
}

// ── Currency ───────────────────────────────────────────────────────────────
const FRANKFURTER = 'https://api.frankfurter.app';
const POPULAR     = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'AED', 'SAR'];
const CACHE_KEY   = 'uc_fx_cache';

let rates    = null;
let rateDate = '';
let currMode = 'live'; // 'live' | 'manual'

const cfrom      = document.getElementById('currency-from');
const cto        = document.getElementById('currency-to');
const cinput     = document.getElementById('currency-input');
const cresult    = document.getElementById('currency-result');
const crateinfo  = document.getElementById('currency-rate-info');
const cswap      = document.getElementById('currency-swap');
const cloading   = document.getElementById('currency-loading');
const connPill   = document.getElementById('conn-pill');
const connLabel  = document.getElementById('conn-label');
const modeSeg    = document.getElementById('mode-seg');
const manualRow  = document.getElementById('manual-rate-row');
const manualRate = document.getElementById('manual-rate');
const mrFrom     = document.getElementById('mr-from');
const mrTo       = document.getElementById('mr-to');

// Cache helpers
function saveCache(r, d, c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: r, date: d, currencies: c })); } catch {}
}
function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

// Connection status
function setConn(online) {
  connPill.className = 'conn-pill ' + (online ? 'online' : 'offline');
  connLabel.textContent = online ? 'Online' : 'Offline';
}
setConn(navigator.onLine);
window.addEventListener('online',  () => { setConn(true);  if (currMode === 'live') loadCurrencies(); });
window.addEventListener('offline', () => setConn(false));

// Mode switching
modeSeg.addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn || btn.dataset.mode === currMode) return;
  setMode(btn.dataset.mode);
});

function setMode(mode) {
  currMode = mode;
  modeSeg.querySelectorAll('.seg-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );

  if (mode === 'live') {
    manualRow.style.display = 'none';
    if (!rates) loadCurrencies();
    else convertCurrency();
  } else {
    manualRow.style.display = 'flex';
    // Pre-fill with live rate if available
    if (rates && cfrom.value && cto.value) {
      const r = (rates[cto.value] ?? 1) / (rates[cfrom.value] ?? 1);
      manualRate.value = parseFloat(r.toFixed(6));
    }
    convertCurrency();
  }
}

// Sync "1 USD = ___ INR" labels
function syncManualLabels() {
  mrFrom.textContent = cfrom.value || 'FROM';
  mrTo.textContent   = cto.value   || 'TO';
  if (currMode === 'manual' && rates && cfrom.value && cto.value) {
    const r = (rates[cto.value] ?? 1) / (rates[cfrom.value] ?? 1);
    manualRate.value = parseFloat(r.toFixed(6));
  }
}

// Conversion
function convertCurrency() {
  const amount = parseFloat(cinput.value);
  if (isNaN(amount)) { cresult.textContent = '—'; return; }

  const f = cfrom.value;
  const t = cto.value;

  if (currMode === 'manual') {
    const r = parseFloat(manualRate.value);
    if (!r || r <= 0) {
      cresult.textContent = '—';
      crateinfo.textContent = 'Enter the exchange rate above (e.g. 83.5).';
      return;
    }
    cresult.classList.remove('error');
    cresult.textContent = fmt(amount * r);
    crateinfo.textContent = `Manual rate: 1 ${f} = ${fmt(r)} ${t}`;
    return;
  }

  if (!rates) { cresult.textContent = '—'; return; }
  const inUSD  = amount / (rates[f] ?? 1);
  const result = inUSD  * (rates[t]  ?? 1);
  cresult.classList.remove('error');
  cresult.textContent = fmt(result);
  const rate = (rates[t] ?? 1) / (rates[f] ?? 1);
  crateinfo.textContent = `1 ${f} = ${fmt(rate)} ${t}  ·  Rates as of ${rateDate}`;
}

// Populate selects
function populateSelects(currencies) {
  const opts = Object.entries(currencies)
    .sort(([a], [b]) => {
      const ai = POPULAR.indexOf(a), bi = POPULAR.indexOf(b);
      if (ai > -1 && bi > -1) return ai - bi;
      if (ai > -1) return -1;
      if (bi > -1) return 1;
      return a.localeCompare(b);
    })
    .map(([code, name]) => ({ value: code, label: `${code}  —  ${name}` }));

  fill(cfrom, opts, 'USD');
  fill(cto,   opts, 'INR');
  syncManualLabels();
}

function enableControls() {
  [cfrom, cto, cinput, cswap].forEach(el => el.removeAttribute('disabled'));
  cloading.classList.add('hidden');
}

// Load currencies (with cache-first strategy)
async function loadCurrencies() {
  const cache = loadCache();

  // Show cached data immediately (if any) while fetching fresh
  if (cache) {
    rates    = cache.rates;
    rateDate = cache.date;
    populateSelects(cache.currencies);
    enableControls();
    convertCurrency();
  }

  // If offline, stop here
  if (!navigator.onLine) {
    if (cache) {
      crateinfo.textContent = `Cached rates from ${rateDate} (you're offline)`;
    } else {
      cloading.classList.add('hidden');
      cresult.classList.add('error');
      cresult.textContent = 'Offline — no cached rates';
      crateinfo.textContent = 'Switch to Manual mode and enter the rate yourself.';
    }
    return;
  }

  // Fetch fresh rates
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const [cRes, rRes] = await Promise.all([
      fetch(`${FRANKFURTER}/currencies`, { signal: controller.signal }),
      fetch(`${FRANKFURTER}/latest?from=USD`, { signal: controller.signal }),
    ]);
    clearTimeout(timeout);

    if (!cRes.ok || !rRes.ok) throw new Error(`API ${cRes.status}`);

    const currencies = await cRes.json();
    const rData      = await rRes.json();

    rates    = { ...rData.rates, USD: 1 };
    rateDate = rData.date;
    saveCache(rates, rateDate, currencies);
    populateSelects(currencies);
    enableControls();
    convertCurrency();
  } catch (err) {
    if (!cache) {
      // Nothing to fall back to
      cloading.classList.add('hidden');
      cresult.classList.add('error');
      cresult.textContent = err.name === 'AbortError' ? 'Request timed out' : 'Could not load rates';
      crateinfo.textContent = 'Check your connection, or switch to Manual mode.';
    }
    // else keep showing cached data silently
  }
}

// Wire currency events
cfrom.addEventListener('change', () => { syncManualLabels(); convertCurrency(); });
cto.addEventListener('change',   () => { syncManualLabels(); convertCurrency(); });
cinput.addEventListener('input', convertCurrency);
manualRate.addEventListener('input', convertCurrency);
cswap.addEventListener('click', () => {
  [cfrom.value, cto.value] = [cto.value, cfrom.value];
  syncManualLabels();
  convertCurrency();
});

document.querySelectorAll('.pair-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cfrom.value = btn.dataset.from;
    cto.value   = btn.dataset.to;
    syncManualLabels();
    convertCurrency();
  });
});

loadCurrencies();

// ── Length ─────────────────────────────────────────────────────────────────
const LENGTH = [
  { value: 'mm',  label: 'Millimeter (mm)',    factor: 1e-3     },
  { value: 'cm',  label: 'Centimeter (cm)',    factor: 1e-2     },
  { value: 'm',   label: 'Meter (m)',          factor: 1        },
  { value: 'km',  label: 'Kilometer (km)',     factor: 1e3      },
  { value: 'in',  label: 'Inch (in)',          factor: 0.0254   },
  { value: 'ft',  label: 'Foot (ft)',          factor: 0.3048   },
  { value: 'yd',  label: 'Yard (yd)',          factor: 0.9144   },
  { value: 'mi',  label: 'Mile (mi)',          factor: 1609.344 },
  { value: 'nmi', label: 'Nautical Mile (nmi)',factor: 1852     },
];

const lfrom  = document.getElementById('length-from');
const lto    = document.getElementById('length-to');
const linput = document.getElementById('length-input');
const lresult= document.getElementById('length-result');
const lswap  = document.getElementById('length-swap');

fill(lfrom, LENGTH, 'cm');
fill(lto,   LENGTH, 'in');

function convertLength() {
  const f = LENGTH.find(u => u.value === lfrom.value);
  const t = LENGTH.find(u => u.value === lto.value);
  const v = parseFloat(linput.value);
  if (!f || !t || isNaN(v)) { lresult.textContent = '—'; return; }
  lresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wire(lfrom, lto, linput, lswap, convertLength);
convertLength();

// ── Weight ─────────────────────────────────────────────────────────────────
const WEIGHT = [
  { value: 'mcg', label: 'Microgram (mcg)', factor: 1e-6         },
  { value: 'mg',  label: 'Milligram (mg)',  factor: 1e-3         },
  { value: 'g',   label: 'Gram (g)',        factor: 1            },
  { value: 'kg',  label: 'Kilogram (kg)',   factor: 1e3          },
  { value: 't',   label: 'Metric Ton (t)',  factor: 1e6          },
  { value: 'oz',  label: 'Ounce (oz)',      factor: 28.349523125 },
  { value: 'lb',  label: 'Pound (lb)',      factor: 453.59237    },
  { value: 'st',  label: 'Stone (st)',      factor: 6350.29318   },
];

const wfrom  = document.getElementById('weight-from');
const wto    = document.getElementById('weight-to');
const winput = document.getElementById('weight-input');
const wresult= document.getElementById('weight-result');
const wswap  = document.getElementById('weight-swap');

fill(wfrom, WEIGHT, 'kg');
fill(wto,   WEIGHT, 'lb');

function convertWeight() {
  const f = WEIGHT.find(u => u.value === wfrom.value);
  const t = WEIGHT.find(u => u.value === wto.value);
  const v = parseFloat(winput.value);
  if (!f || !t || isNaN(v)) { wresult.textContent = '—'; return; }
  wresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wire(wfrom, wto, winput, wswap, convertWeight);
convertWeight();

// ── Temperature ────────────────────────────────────────────────────────────
const TEMP = [
  { value: 'c', label: 'Celsius (°C)'    },
  { value: 'f', label: 'Fahrenheit (°F)' },
  { value: 'k', label: 'Kelvin (K)'      },
];

const tfrom  = document.getElementById('temperature-from');
const tto    = document.getElementById('temperature-to');
const tinput = document.getElementById('temperature-input');
const tresult= document.getElementById('temperature-result');
const tswap  = document.getElementById('temperature-swap');

fill(tfrom, TEMP, 'c');
fill(tto,   TEMP, 'f');

const TEMP_SYMBOL = { c: '°C', f: '°F', k: ' K' };

function toKelvin(v, from) {
  if (from === 'c') return v + 273.15;
  if (from === 'f') return (v - 32) * 5 / 9 + 273.15;
  return v;
}
function fromKelvin(k, to) {
  if (to === 'c') return k - 273.15;
  if (to === 'f') return (k - 273.15) * 9 / 5 + 32;
  return k;
}

function convertTemp() {
  const v = parseFloat(tinput.value);
  if (isNaN(v)) { tresult.textContent = '—'; return; }
  const result = fromKelvin(toKelvin(v, tfrom.value), tto.value);
  tresult.textContent = fmt(result) + TEMP_SYMBOL[tto.value];
}

wire(tfrom, tto, tinput, tswap, convertTemp);
convertTemp();

// ── Time Zones ─────────────────────────────────────────────────────────────
const FRIENDS = [
  { label: 'Sweden',        city: 'Stockholm', tz: 'Europe/Stockholm', flag: '🇸🇪' },
  { label: 'United States', city: 'New York',  tz: 'America/New_York', flag: '🇺🇸' },
  { label: 'UK & Scotland', city: 'London',    tz: 'Europe/London',    flag: '🇬🇧' },
  { label: 'New Zealand',   city: 'Auckland',  tz: 'Pacific/Auckland', flag: '🇳🇿' },
  { label: 'Finland',       city: 'Helsinki',  tz: 'Europe/Helsinki',  flag: '🇫🇮' },
  { label: 'Spain',         city: 'Madrid',    tz: 'Europe/Madrid',    flag: '🇪🇸' },
];

const worldClock = document.getElementById('world-clock');
const timeRef    = document.getElementById('time-ref');
const timeResults= document.getElementById('time-results');

// Build world-clock cards
FRIENDS.forEach(f => {
  const id  = f.tz.replace(/\//g, '_');
  const card = document.createElement('div');
  card.className = 'tz-card';
  card.innerHTML = `
    <div class="tz-header">
      <span class="tz-flag">${f.flag}</span>
      <div>
        <div class="tz-label">${f.label}</div>
        <div class="tz-city">${f.city}</div>
      </div>
    </div>
    <div class="tz-time" id="tz-t-${id}">–:–:–</div>
    <div class="tz-meta" id="tz-m-${id}">–</div>`;
  worldClock.appendChild(card);
});

function tzOffset(tz, date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, timeZoneName: 'shortOffset',
  }).formatToParts(date);
  return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
}

function updateWorldClock() {
  const now = new Date();
  FRIENDS.forEach(f => {
    const id = f.tz.replace(/\//g, '_');
    document.getElementById(`tz-t-${id}`).textContent =
      new Intl.DateTimeFormat('en-GB', {
        timeZone: f.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }).format(now);

    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: f.tz, weekday: 'short', month: 'short', day: 'numeric',
    }).format(now);

    document.getElementById(`tz-m-${id}`).textContent =
      `${dateStr}  ·  ${tzOffset(f.tz, now)}`;
  });
}

updateWorldClock();
setInterval(updateWorldClock, 1000);

// Default time-ref to now (local)
function localISO() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
timeRef.value = localISO();

function convertTime() {
  const val = timeRef.value;
  if (!val) { timeResults.innerHTML = ''; return; }
  const local = new Date(val);

  timeResults.innerHTML = FRIENDS.map(f => {
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: f.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(local);
    const offset = tzOffset(f.tz, local);
    return `<div class="tr-row">
      <span class="tr-flag">${f.flag}</span>
      <span class="tr-label">${f.label}</span>
      <span class="tr-time">${time}</span>
      <span class="tr-offset">${offset}</span>
    </div>`;
  }).join('');
}

timeRef.addEventListener('input', convertTime);
convertTime();
