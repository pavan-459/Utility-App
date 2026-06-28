'use strict';

// ── Theme ──────────────────────────────────────────────────────────────────
const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const sunIcon = themeBtn.querySelector('.sun-icon');
const moonIcon = themeBtn.querySelector('.moon-icon');

let dark = localStorage.getItem('theme')
  ? localStorage.getItem('theme') === 'dark'
  : window.matchMedia('(prefers-color-scheme: dark)').matches;

function applyTheme() {
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  sunIcon.style.display  = dark ? 'none'   : '';
  moonIcon.style.display = dark ? ''       : 'none';
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
  if (Math.abs(n) > 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) {
    return n.toExponential(4);
  }
  const abs = Math.abs(n);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(n);
}

function fill(el, opts, defaultVal) {
  el.innerHTML = '';
  opts.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    if (value === defaultVal) o.selected = true;
    el.appendChild(o);
  });
}

function wire(fromSel, toSel, inputEl, resultEl, swapBtn, convertFn) {
  fromSel.addEventListener('change', convertFn);
  toSel.addEventListener('change', convertFn);
  inputEl.addEventListener('input', convertFn);
  swapBtn.addEventListener('click', () => {
    const tmp = fromSel.value;
    fromSel.value = toSel.value;
    toSel.value = tmp;
    convertFn();
  });
}

// ── Currency ───────────────────────────────────────────────────────────────
const FRANKFURTER = 'https://api.frankfurter.app';
const POPULAR = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'AED', 'SAR'];

let rates = null;   // keyed from USD
let rateDate = '';

const cfrom   = document.getElementById('currency-from');
const cto     = document.getElementById('currency-to');
const cinput  = document.getElementById('currency-input');
const cresult = document.getElementById('currency-result');
const crateinfo = document.getElementById('currency-rate-info');
const cswap   = document.getElementById('currency-swap');
const cloading = document.getElementById('currency-loading');

function convertCurrency() {
  if (!rates) return;
  const amount = parseFloat(cinput.value);
  if (isNaN(amount)) { cresult.textContent = '—'; return; }

  const f = cfrom.value;
  const t = cto.value;
  const inUSD  = amount / (rates[f] ?? 1);
  const result = inUSD  * (rates[t]  ?? 1);
  cresult.textContent = fmt(result);

  const rate = (rates[t] ?? 1) / (rates[f] ?? 1);
  crateinfo.textContent = `1 ${f} = ${fmt(rate)} ${t}  ·  Rates as of ${rateDate}`;
}

async function loadCurrencies() {
  try {
    const [cRes, rRes] = await Promise.all([
      fetch(`${FRANKFURTER}/currencies`),
      fetch(`${FRANKFURTER}/latest?from=USD`),
    ]);
    if (!cRes.ok || !rRes.ok) throw new Error('API error');

    const currencies = await cRes.json();
    const rData      = await rRes.json();

    rates    = { ...rData.rates, USD: 1 };
    rateDate = rData.date;

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

    // enable controls
    [cfrom, cto, cinput, cswap].forEach(el => el.removeAttribute('disabled'));
    cloading.classList.add('hidden');
    convertCurrency();
  } catch (e) {
    cloading.classList.add('hidden');
    cresult.textContent = 'Could not load rates';
    cresult.classList.add('error');
    crateinfo.textContent = 'Check your internet connection and refresh.';
  }
}

wire(cfrom, cto, cinput, cresult, cswap, convertCurrency);

document.querySelectorAll('.pair-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!rates) return;
    document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cfrom.value = btn.dataset.from;
    cto.value   = btn.dataset.to;
    convertCurrency();
  });
});

loadCurrencies();

// ── Length ─────────────────────────────────────────────────────────────────
const LENGTH = [
  { value: 'mm',  label: 'Millimeter (mm)',      factor: 1e-3      },
  { value: 'cm',  label: 'Centimeter (cm)',       factor: 1e-2      },
  { value: 'm',   label: 'Meter (m)',             factor: 1         },
  { value: 'km',  label: 'Kilometer (km)',        factor: 1e3       },
  { value: 'in',  label: 'Inch (in)',             factor: 0.0254    },
  { value: 'ft',  label: 'Foot (ft)',             factor: 0.3048    },
  { value: 'yd',  label: 'Yard (yd)',             factor: 0.9144    },
  { value: 'mi',  label: 'Mile (mi)',             factor: 1609.344  },
  { value: 'nmi', label: 'Nautical Mile (nmi)',   factor: 1852      },
];

const lfrom   = document.getElementById('length-from');
const lto     = document.getElementById('length-to');
const linput  = document.getElementById('length-input');
const lresult = document.getElementById('length-result');
const lswap   = document.getElementById('length-swap');

fill(lfrom, LENGTH, 'cm');
fill(lto,   LENGTH, 'in');

function convertLength() {
  const f = LENGTH.find(u => u.value === lfrom.value);
  const t = LENGTH.find(u => u.value === lto.value);
  const v = parseFloat(linput.value);
  if (!f || !t || isNaN(v)) { lresult.textContent = '—'; return; }
  lresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wire(lfrom, lto, linput, lresult, lswap, convertLength);
convertLength();

// ── Weight ─────────────────────────────────────────────────────────────────
const WEIGHT = [
  { value: 'mcg', label: 'Microgram (mcg)',  factor: 1e-6          },
  { value: 'mg',  label: 'Milligram (mg)',   factor: 1e-3          },
  { value: 'g',   label: 'Gram (g)',         factor: 1             },
  { value: 'kg',  label: 'Kilogram (kg)',    factor: 1e3           },
  { value: 't',   label: 'Metric Ton (t)',   factor: 1e6           },
  { value: 'oz',  label: 'Ounce (oz)',       factor: 28.349523125  },
  { value: 'lb',  label: 'Pound (lb)',       factor: 453.59237     },
  { value: 'st',  label: 'Stone (st)',       factor: 6350.29318    },
];

const wfrom   = document.getElementById('weight-from');
const wto     = document.getElementById('weight-to');
const winput  = document.getElementById('weight-input');
const wresult = document.getElementById('weight-result');
const wswap   = document.getElementById('weight-swap');

fill(wfrom, WEIGHT, 'kg');
fill(wto,   WEIGHT, 'lb');

function convertWeight() {
  const f = WEIGHT.find(u => u.value === wfrom.value);
  const t = WEIGHT.find(u => u.value === wto.value);
  const v = parseFloat(winput.value);
  if (!f || !t || isNaN(v)) { wresult.textContent = '—'; return; }
  wresult.textContent = fmt(v * f.factor / t.factor) + ' ' + t.value;
}

wire(wfrom, wto, winput, wresult, wswap, convertWeight);
convertWeight();

// ── Temperature ────────────────────────────────────────────────────────────
const TEMP = [
  { value: 'c', label: 'Celsius (°C)'    },
  { value: 'f', label: 'Fahrenheit (°F)' },
  { value: 'k', label: 'Kelvin (K)'      },
];

const tfrom   = document.getElementById('temperature-from');
const tto     = document.getElementById('temperature-to');
const tinput  = document.getElementById('temperature-input');
const tresult = document.getElementById('temperature-result');
const tswap   = document.getElementById('temperature-swap');

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

wire(tfrom, tto, tinput, tresult, tswap, convertTemp);
convertTemp();
