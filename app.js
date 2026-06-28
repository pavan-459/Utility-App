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
    history.replaceState(null, '', '#' + tab.dataset.tab);
    saveState({ last_tab: tab.dataset.tab });
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
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

// ── State persistence ──────────────────────────────────────────────────────
const STATE_KEY = 'uc_st';
function saveState(updates) {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
    Object.assign(s, updates);
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {}
}
function getState(key, fallback) {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}')[key] ?? fallback; }
  catch { return fallback; }
}

function wirePersist(fromSel, toSel, inputEl, swapBtn, convertFn, key) {
  fromSel.addEventListener('change', () => { saveState({ [key+'_from']: fromSel.value }); convertFn(); });
  toSel.addEventListener('change',   () => { saveState({ [key+'_to']:   toSel.value   }); convertFn(); });
  inputEl.addEventListener('input',  convertFn);
  swapBtn.addEventListener('click',  () => {
    [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
    saveState({ [key+'_from']: fromSel.value, [key+'_to']: toSel.value });
    convertFn();
  });
}

// ── Currency ───────────────────────────────────────────────────────────────
// jsDelivr CDN — no CORS issues, works on file:// and any host, updated daily
const FX_BASE  = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';
const POPULAR  = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'AED', 'SAR'];
const CACHE_KEY   = 'uc_fx_cache';

// Hardcoded fallback so selects are never empty (enables quick pairs in manual mode before API loads)
const MINIMAL_CURRENCIES = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  INR: 'Indian Rupee', AUD: 'Australian Dollar', CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc', SGD: 'Singapore Dollar', AED: 'UAE Dirham', SAR: 'Saudi Riyal',
  NZD: 'New Zealand Dollar', HKD: 'Hong Kong Dollar', MYR: 'Malaysian Ringgit',
};

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
const numCurrency = document.getElementById('num-currency'); // declared here so populateSelects can reference it

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
  if (currMode === 'manual') {
    if (rates && cfrom.value && cto.value) {
      // Pre-fill with live rate
      const r = (rates[cto.value] ?? 1) / (rates[cfrom.value] ?? 1);
      manualRate.value = parseFloat(r.toFixed(6));
    } else {
      // No live rates — clear so user knows to type their own rate
      manualRate.value = '';
    }
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

  fill(cfrom,       opts, getState('fx_from', 'USD'));
  fill(cto,         opts, getState('fx_to',   'INR'));
  fill(numCurrency, opts, numCurrency.value || 'USD');
  syncManualLabels();
  convertNumbers();
}

function enableControls() {
  [cfrom, cto, cinput, cswap].forEach(el => el.removeAttribute('disabled'));
  cloading.classList.add('hidden');
}

// Load currencies (with cache-first strategy)
async function loadCurrencies() {
  const cache = loadCache();

  // Always populate minimal list first — ensures quick pairs and manual mode
  // work immediately without waiting for the API or cache
  populateSelects(MINIMAL_CURRENCIES);
  enableControls();

  // Upgrade to cached data if available
  if (cache) {
    rates    = cache.rates;
    rateDate = cache.date;
    populateSelects(cache.currencies);
    convertCurrency();
  }

  // If offline, stop here
  if (!navigator.onLine) {
    if (cache) {
      crateinfo.textContent = `Cached rates from ${rateDate} (you're offline)`;
    } else {
      cresult.classList.add('error');
      cresult.textContent = 'Offline — no cached rates';
      crateinfo.textContent = 'Switch to Manual mode and enter the rate yourself.';
    }
    return;
  }

  // Fetch fresh rates from jsDelivr CDN (no CORS issues)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const [cRes, rRes] = await Promise.all([
      fetch(`${FX_BASE}/currencies.json`,     { signal: controller.signal }),
      fetch(`${FX_BASE}/currencies/usd.json`, { signal: controller.signal }),
    ]);
    clearTimeout(timeout);

    if (!cRes.ok || !rRes.ok) throw new Error(`API ${cRes.status}`);

    const cData = await cRes.json(); // { "usd": "US Dollar", "inr": "Indian Rupee", ... }
    const rData = await rRes.json(); // { "date": "...", "usd": { "inr": 83.4, ... } }

    // API returns lowercase codes — convert to uppercase for consistency
    const currencies = {};
    for (const [code, name] of Object.entries(cData)) {
      currencies[code.toUpperCase()] = name;
    }

    rates = { USD: 1 };
    for (const [code, val] of Object.entries(rData.usd)) {
      rates[code.toUpperCase()] = val;
    }
    rateDate = rData.date;

    saveCache(rates, rateDate, currencies);
    populateSelects(currencies);
    enableControls();
    convertCurrency();
  } catch (err) {
    if (!cache) {
      cloading.classList.add('hidden');
      cresult.classList.add('error');
      cresult.textContent = err.name === 'AbortError' ? 'Request timed out' : 'Could not load rates';
      crateinfo.textContent = 'Check your connection, or switch to Manual mode.';
    }
    // else keep showing cached data silently
  }
}

// Wire currency events
cfrom.addEventListener('change', () => { saveState({ fx_from: cfrom.value }); syncManualLabels(); convertCurrency(); });
cto.addEventListener('change',   () => { saveState({ fx_to:   cto.value   }); syncManualLabels(); convertCurrency(); });
cinput.addEventListener('input', convertCurrency);
manualRate.addEventListener('input', convertCurrency);
cswap.addEventListener('click', () => {
  [cfrom.value, cto.value] = [cto.value, cfrom.value];
  saveState({ fx_from: cfrom.value, fx_to: cto.value });
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

fill(lfrom, LENGTH, getState('len_from', 'cm'));
fill(lto,   LENGTH, getState('len_to',   'in'));

function convertLength() {
  const f = LENGTH.find(u => u.value === lfrom.value);
  const t = LENGTH.find(u => u.value === lto.value);
  const v = parseFloat(linput.value);
  if (!f || !t || isNaN(v)) { lresult.textContent = '—'; return; }
  lresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wirePersist(lfrom, lto, linput, lswap, convertLength, 'len');
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

fill(wfrom, WEIGHT, getState('wt_from', 'kg'));
fill(wto,   WEIGHT, getState('wt_to',   'lb'));

function convertWeight() {
  const f = WEIGHT.find(u => u.value === wfrom.value);
  const t = WEIGHT.find(u => u.value === wto.value);
  const v = parseFloat(winput.value);
  if (!f || !t || isNaN(v)) { wresult.textContent = '—'; return; }
  wresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wirePersist(wfrom, wto, winput, wswap, convertWeight, 'wt');
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

fill(tfrom, TEMP, getState('tmp_from', 'c'));
fill(tto,   TEMP, getState('tmp_to',   'f'));

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

wirePersist(tfrom, tto, tinput, tswap, convertTemp, 'tmp');
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

// ── Crores / Scale Converter ───────────────────────────────────────────────
const CURR_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', SGD: 'S$', AED: 'د.إ', SAR: '﷼',
};

const numAmount   = document.getElementById('num-amount');
const numScale    = document.getElementById('num-scale');
const numResults  = document.getElementById('num-results');

// Pre-populate with minimal list (upgraded by populateSelects when rates load)
fill(numCurrency,
  Object.entries(MINIMAL_CURRENCIES).map(([c, n]) => ({ value: c, label: `${c}  —  ${n}` })),
  'USD'
);

// Indian number formatter (1,00,00,000 style)
function indFmt(n) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}

// Tag row: crores + lakhs pills
function scaleTags(n, curr, accent) {
  const crores = n / 1e7;
  const lakhs  = n / 1e5;
  const sym    = CURR_SYMBOLS[curr] ?? curr + ' ';
  const cls    = accent ? 'num-tag accent' : 'num-tag';
  return `
    <span class="${cls}">${fmt(crores)} Crore${crores !== 1 ? 's' : ''} ${curr}</span>
    <span class="${cls}">${fmt(lakhs)} Lakhs ${curr}</span>`;
}

function convertNumbers() {
  const amount = parseFloat(numAmount.value);
  const scale  = parseFloat(numScale.value);
  const curr   = numCurrency.value || 'USD';
  if (isNaN(amount) || !scale) { numResults.innerHTML = ''; return; }

  const raw = amount * scale;                        // e.g. 20 × 1,000,000 = 20,000,000
  const sym = CURR_SYMBOLS[curr] ?? curr + ' ';
  const scaleName = numScale.options[numScale.selectedIndex]?.text ?? '';

  // Block 1 — selected currency in Indian scale
  let html = `
    <div class="num-block">
      <div class="num-label">${amount} ${scaleName} in ${curr} — Indian Scale</div>
      <div class="num-big">${sym} ${indFmt(raw)}</div>
      <div class="num-tags">${scaleTags(raw, curr, false)}</div>
    </div>`;

  if (curr === 'INR') {
    // If already INR, show the USD equivalent as the second block
    if (rates && rates['USD'] && rates['INR']) {
      const usdVal = (raw / (rates['INR'] ?? 1)) * (rates['USD'] ?? 1);
      const scaleLabels = [
        { d: 1e9, n: 'Billion' }, { d: 1e6, n: 'Million' }, { d: 1e3, n: 'Thousand' },
      ];
      const best = scaleLabels.find(s => usdVal >= s.d) ?? scaleLabels[2];
      html += `
        <div class="num-divider"></div>
        <div class="num-block">
          <div class="num-label">Equivalent in USD</div>
          <div class="num-big accent">$ ${indFmt(usdVal)}</div>
          <div class="num-tags">
            <span class="num-tag accent">${fmt(usdVal / best.d)} ${best.n} USD</span>
          </div>
          <div class="num-rate">1 USD = ${fmt((rates['INR'] ?? 1) / (rates['USD'] ?? 1))} INR  ·  as of ${rateDate}</div>
        </div>`;
    }
  } else if (rates && rates[curr] && rates['INR']) {
    // Convert to INR
    const inrVal  = (raw / (rates[curr] ?? 1)) * (rates['INR'] ?? 1);
    const fxRate  = (rates['INR'] ?? 1) / (rates[curr] ?? 1);
    html += `
      <div class="num-divider"></div>
      <div class="num-block">
        <div class="num-label">Converted to INR</div>
        <div class="num-big accent">₹ ${indFmt(inrVal)}</div>
        <div class="num-tags">${scaleTags(inrVal, 'INR', true)}</div>
        <div class="num-rate">1 ${curr} = ${fmt(fxRate)} INR  ·  as of ${rateDate || 'cached'}</div>
      </div>`;
  } else {
    html += `
      <div class="num-note">
        Open the <strong>Currency</strong> tab to load live rates, then come back for the INR equivalent.
      </div>`;
  }

  numResults.innerHTML = html;
}

[numAmount, numScale, numCurrency].forEach(el => {
  el.addEventListener('input',  convertNumbers);
  el.addEventListener('change', convertNumbers);
});
convertNumbers();

// ── Area ───────────────────────────────────────────────────────────────────
const AREA = [
  { value: 'mm2',  label: 'mm² (sq mm)',   factor: 1e-6        },
  { value: 'cm2',  label: 'cm² (sq cm)',   factor: 1e-4        },
  { value: 'm2',   label: 'm² (sq m)',     factor: 1           },
  { value: 'km2',  label: 'km² (sq km)',   factor: 1e6         },
  { value: 'ha',   label: 'Hectare (ha)',  factor: 1e4         },
  { value: 'acre', label: 'Acre',          factor: 4046.856    },
  { value: 'ft2',  label: 'ft² (sq ft)',   factor: 0.092903    },
  { value: 'yd2',  label: 'yd² (sq yd)',   factor: 0.836127    },
  { value: 'mi2',  label: 'mi² (sq mi)',   factor: 2589988.11  },
];

const afrom  = document.getElementById('area-from');
const ato    = document.getElementById('area-to');
const ainput = document.getElementById('area-input');
const aresult= document.getElementById('area-result');
const aswap  = document.getElementById('area-swap');

fill(afrom, AREA, getState('area_from', 'm2'));
fill(ato,   AREA, getState('area_to',   'ft2'));

function convertArea() {
  const f = AREA.find(u => u.value === afrom.value);
  const t = AREA.find(u => u.value === ato.value);
  const v = parseFloat(ainput.value);
  if (!f || !t || isNaN(v)) { aresult.textContent = '—'; return; }
  aresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wirePersist(afrom, ato, ainput, aswap, convertArea, 'area');
convertArea();

// ── Speed ──────────────────────────────────────────────────────────────────
const SPEED = [
  { value: 'ms',   label: 'm/s',          factor: 1        },
  { value: 'kmh',  label: 'km/h',         factor: 1/3.6    },
  { value: 'mph',  label: 'mph',          factor: 0.44704  },
  { value: 'knot', label: 'Knot (kn)',    factor: 0.514444 },
  { value: 'fts',  label: 'ft/s',         factor: 0.3048   },
  { value: 'mach', label: 'Mach (≈ SL)',  factor: 343      },
];

const spfrom  = document.getElementById('speed-from');
const spto    = document.getElementById('speed-to');
const spinput = document.getElementById('speed-input');
const spresult= document.getElementById('speed-result');
const spswap  = document.getElementById('speed-swap');

fill(spfrom, SPEED, getState('spd_from', 'kmh'));
fill(spto,   SPEED, getState('spd_to',   'mph'));

function convertSpeed() {
  const f = SPEED.find(u => u.value === spfrom.value);
  const t = SPEED.find(u => u.value === spto.value);
  const v = parseFloat(spinput.value);
  if (!f || !t || isNaN(v)) { spresult.textContent = '—'; return; }
  spresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wirePersist(spfrom, spto, spinput, spswap, convertSpeed, 'spd');
convertSpeed();

// ── Data ───────────────────────────────────────────────────────────────────
const DATA = [
  { value: 'bit', label: 'Bit (b)',        factor: 0.125             },
  { value: 'b',   label: 'Byte (B)',       factor: 1                 },
  { value: 'kb',  label: 'Kilobyte (KB)',  factor: 1024              },
  { value: 'mb',  label: 'Megabyte (MB)',  factor: 1048576           },
  { value: 'gb',  label: 'Gigabyte (GB)',  factor: 1073741824        },
  { value: 'tb',  label: 'Terabyte (TB)',  factor: 1099511627776     },
  { value: 'pb',  label: 'Petabyte (PB)', factor: 1.12589990684e15  },
];

const dbfrom  = document.getElementById('data-from');
const dbto    = document.getElementById('data-to');
const dbinput = document.getElementById('data-input');
const dbresult= document.getElementById('data-result');
const dbswap  = document.getElementById('data-swap');

fill(dbfrom, DATA, getState('dat_from', 'gb'));
fill(dbto,   DATA, getState('dat_to',   'mb'));

function convertData() {
  const f = DATA.find(u => u.value === dbfrom.value);
  const t = DATA.find(u => u.value === dbto.value);
  const v = parseFloat(dbinput.value);
  if (!f || !t || isNaN(v)) { dbresult.textContent = '—'; return; }
  dbresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wirePersist(dbfrom, dbto, dbinput, dbswap, convertData, 'dat');
convertData();

// ── Copy to clipboard ──────────────────────────────────────────────────────
const COPY_SVG  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const el = document.getElementById(btn.dataset.for);
    if (!el) return;
    const text = el.textContent.trim();
    if (!text || text === '—') return;
    try {
      await navigator.clipboard.writeText(text);
      btn.classList.add('ok');
      btn.innerHTML = CHECK_SVG;
      setTimeout(() => { btn.classList.remove('ok'); btn.innerHTML = COPY_SVG; }, 1500);
    } catch {}
  });
});

// ── Hash routing / restore last tab ───────────────────────────────────────
(function () {
  const hash = window.location.hash.slice(1) || getState('last_tab', '');
  if (hash) {
    const t = document.querySelector(`.tab[data-tab="${hash}"]`);
    if (t) t.click();
  }
}());
