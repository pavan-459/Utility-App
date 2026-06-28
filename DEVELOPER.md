# Utility Convertor — Developer Documentation

## Table of Contents

1. [Aim](#1-aim)
2. [Requirements](#2-requirements)
3. [System Design](#3-system-design)
4. [Technology Decisions](#4-technology-decisions)
5. [Hosting: GitHub Pages](#5-hosting-github-pages)
6. [Currency API Design](#6-currency-api-design)
7. [Offline Strategy](#7-offline-strategy)
8. [PWA Implementation](#8-pwa-implementation)
9. [Development Process](#9-development-process)
10. [Known Limitations](#10-known-limitations)
11. [Roadmap](#11-roadmap)
12. [Conclusion](#12-conclusion)

---

## 1. Aim

### What is it?

Utility Convertor is a personal, everyday-use web app for converting currencies, units of measurement, and time zones. It is designed around real, frequent needs — checking USD to INR when shopping online, converting height and weight between metric and imperial systems, knowing what time it is for friends living in different countries, and understanding how many crores 20 million dollars is.

### Why build it?

The problem with most converter tools online is that they are:

- Cluttered with ads
- Slow to load
- Require internet for every conversion
- Not personalised (e.g. no quick USD → INR button)
- Not yours — you can't extend them

This app solves all of that. It is self-hosted, ad-free, instant, offline-capable, and fully under your control. Features are added progressively as new needs arise.

### Who is it for?

Primarily a single user (the developer), used daily. The design goal is **zero friction** — open the app, type a number, get the answer in under 2 seconds, without touching a mouse or waiting for a network.

---

## 2. Requirements

### 2.1 Functional Requirements

| # | Requirement | Status |
| --- | --- | --- |
| F1 | Convert currencies with live exchange rates | ✅ |
| F2 | Manual rate entry when offline | ✅ |
| F3 | Cache last-known rates in browser storage | ✅ |
| F4 | Convert length units (mm to miles and everything between) | ✅ |
| F5 | Convert weight units (mcg to metric ton) | ✅ |
| F6 | Convert temperatures (°C, °F, Kelvin) | ✅ |
| F7 | Live world clock for specific countries | ✅ |
| F8 | Time zone converter (any local time → friends' times) | ✅ |
| F9 | Dark / light theme with system preference detection | ✅ |
| F10 | Quick-pair shortcuts for common currency pairs | ✅ |
| F11 | Swap FROM ↔ TO with one click | ✅ |
| F12 | Reference tables for common conversion facts | ✅ |
| F13 | Convert western scale (millions/billions) to Indian scale (crores/lakhs) | ✅ |
| F14 | Convert area units (m², acres, hectares, etc.) | ✅ |
| F15 | Convert speed units (km/h, mph, m/s, knots, Mach) | ✅ |
| F16 | Convert data sizes (bit, byte, KB, MB, GB, TB, PB) | ✅ |
| F17 | Installable as a home-screen app (PWA) | ✅ |
| F18 | Works fully offline including navigation (Service Worker) | ✅ |
| F19 | Copy result to clipboard with one tap | ✅ |
| F20 | Remember last-used units and tab across sessions | ✅ |
| F21 | Deep-linkable converter tabs via URL hash | ✅ |

### 2.2 Non-Functional Requirements

| # | Requirement | Rationale |
| --- | --- | --- |
| NF1 | **Zero build step** | Open `index.html` directly in a browser — no Node.js, no bundler, no CLI commands needed |
| NF2 | **Zero dependencies** | No npm packages, no CDN libraries, no framework — the app is entirely self-contained |
| NF3 | **Free to host** | The entire app is static files; no server, no database, no compute cost |
| NF4 | **Offline-capable** | All conversions and navigation work with zero network after first load |
| NF5 | **Mobile responsive** | Usable on a phone in one hand; installs to home screen as a native-feeling app |
| NF6 | **Fast** | No JavaScript framework parsing overhead; page is interactive in under 200ms on any connection |
| NF7 | **Progressively extensible** | New converter tabs can be added by following the existing pattern without touching unrelated code |
| NF8 | **CORS-safe** | All external API calls work from any origin, including `file://` (local filesystem) |

---

## 3. System Design

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                           │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │index.html│  │ style.css│  │       app.js         │  │
│  │(Structure)│  │(Styles)  │  │(Logic + State + DOM) │  │
│  └──────────┘  └──────────┘  └──────────┬───────────┘  │
│                                         │               │
│                         ┌───────────────┴────────────┐  │
│                         │         localStorage        │  │
│                         │  uc_fx_cache (rates)        │  │
│                         │  uc_st (converter state)    │  │
│                         │  theme                      │  │
│                         └────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  Service Worker (sw.js)           │   │
│  │  Cache: index.html, style.css, app.js,           │   │
│  │         manifest.json, icon.svg                  │   │
│  │  Strategy: cache-first (static), network-first   │   │
│  │            (API), offline fallback               │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP (when online)
                           ▼
              ┌────────────────────────┐
              │  jsDelivr CDN          │
              │  (@fawazahmed0/        │
              │   currency-api)        │
              └────────────────────────┘
```

There is no backend. No server. No database. No authentication. The entire application is a handful of static files that run inside the browser.

### 3.2 File Structure

```
Utility-Convertor/
├── index.html       # DOM structure, semantic markup, all sections
├── style.css        # Design tokens, layout, component styles, responsive rules
├── app.js           # All logic: state, conversions, API calls, DOM updates
├── manifest.json    # PWA manifest (name, icons, display mode, theme colour)
├── sw.js            # Service Worker: cache strategy, offline support
├── icon.svg         # App icon (used as favicon, apple-touch-icon, PWA icon)
├── README.md        # User-facing documentation
├── DEVELOPER.md     # This file
├── LICENSE          # MIT
└── .gitattributes   # LF line ending normalisation
```

The deliberate choice to keep everything at the root with no `src/`, `dist/`, or `public/` folder is intentional. GitHub Pages serves the root directory directly — no build configuration needed.

### 3.3 State Management

There is no state management library. State lives in two places:

**In-memory (JavaScript variables in app.js):**

```
├── dark          (boolean)   — current theme
├── rates         (object)    — currency rates keyed by code { USD: 1, INR: 83.4 }
├── rateDate      (string)    — date the rates were last fetched
└── currMode      (string)    — 'live' | 'manual'
```

**Persisted (localStorage):**

```
uc_fx_cache    — { rates, date, currencies }  — last known exchange rates
uc_st          — { fx_from, fx_to, len_from, len_to, wt_from, wt_to,
                   tmp_from, tmp_to, area_from, area_to, spd_from, spd_to,
                   dat_from, dat_to, last_tab }  — last-used units per converter
theme          — 'dark' | 'light'
```

State mutations always immediately trigger a DOM update via the relevant `convertX()` function. There is no virtual DOM, diffing, or batching — the DOM is the source of truth for UI state.

**Why this works at this scale:** With nine converter sections and a few dozen DOM elements, managing state manually is faster and more transparent than introducing a framework. React or Vue would add 40–100 KB of JavaScript overhead, slower startup, and a build pipeline — none of which deliver user value here.

### 3.4 Module Pattern

`app.js` is organised into vertical slices, one per converter. Each slice follows the same pattern:

```js
// 1. Data (unit definitions with conversion factors relative to a base unit)
const LENGTH = [
  { value: 'mm', label: 'Millimeter (mm)', factor: 1e-3 },
  { value: 'm',  label: 'Meter (m)',       factor: 1    },
  ...
];

// 2. DOM references (query once, reuse)
const lfrom  = document.getElementById('length-from');
const lto    = document.getElementById('length-to');

// 3. Initialise selects with data, restoring last-used value from state
fill(lfrom, LENGTH, getState('len_from', 'cm'));
fill(lto,   LENGTH, getState('len_to',   'in'));

// 4. Conversion function (pure calculation → write result to DOM)
function convertLength() { ... }

// 5. Wire events (with automatic state persistence)
wirePersist(lfrom, lto, linput, lswap, convertLength, 'len');
convertLength(); // run once to set initial value
```

Adding a new converter means adding one block following this exact pattern. Nothing else needs to change.

The two wiring helpers are:

- `wire(from, to, input, swap, fn)` — plain event binding, no persistence
- `wirePersist(from, to, input, swap, fn, key)` — same, but saves `key_from` / `key_to` to `localStorage` on every change and restores them on next load

### 3.5 CSS Architecture

CSS uses **custom properties (variables)** as a design token system:

```css
:root {
  --bg: #f1f5f9;        /* page background */
  --surface: #ffffff;   /* card background */
  --border: #e2e8f0;    /* borders and dividers */
  --text: #1e293b;      /* primary text */
  --muted: #64748b;     /* secondary text, labels */
  --primary: #6366f1;   /* accent — indigo */
  --primary-dim: rgba(99,102,241,.12); /* accent with opacity for focus rings */
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  /* ... overrides only */
}
```

When the theme toggles, a single attribute change on `<html>` (`data-theme="dark"`) cascades through every variable — no JavaScript touching individual elements, no class toggling on hundreds of nodes. Every component automatically adapts.

**Mobile navigation:** On screens ≤ 640px, the tab bar moves to the bottom as a fixed navigation bar with backdrop blur, safe-area padding for iPhone home indicators, and horizontal scrolling for the full nine-tab set. Each tab has a minimum width of 58px so labels are readable. The active tab is scrolled into view automatically when switched.

### 3.6 Conversion Logic

**Linear converters (length, weight, area, speed, data):** All units are defined with a `factor` — their value relative to a common base unit (metres for length, grams for weight, m² for area, m/s for speed, bytes for data). Conversion is always:

```
result = inputValue × fromFactor / toFactor
```

This means adding a new unit requires only one line of data — no new code paths.

**Temperature:** Non-linear (Celsius ↔ Fahrenheit involves an offset, not just scaling). All conversions route through Kelvin as an intermediate:

```
input → toKelvin(value, fromUnit) → fromKelvin(kelvin, toUnit) → result
```

**Currency:** Two-step conversion through USD as a common base:

```
amount → ÷ rates[fromCurrency] → × rates[toCurrency] → result
```

Since all rates are stored as `{ USD: 1, INR: 83.4, EUR: 0.92, ... }` (all relative to USD), any pair can be converted without fetching a specific pair from the API.

**Time zones:** Entirely delegated to the browser's built-in `Intl.DateTimeFormat` API with the `timeZone` option. The browser handles daylight saving time, historical transitions, and formatting automatically. Zero custom timezone logic.

**Crores / Scale:** The value is computed as `amount × westernScaleFactor` (e.g. 20 × 1,000,000 = 20,000,000), then divided by 1e7 for crores and 1e5 for lakhs. A secondary block converts to INR using live rates and formats both blocks using `Intl.NumberFormat('en-IN')` for proper Indian comma placement (1,00,00,000 style).

### 3.7 Hash Routing

Tab navigation is reflected in the URL hash (`#currency`, `#length`, `#speed`, etc.) using `history.replaceState`. This allows:

- Direct links to a specific converter (e.g. sharing `…/Utility-App/#data`)
- Browser back/forward to work across tab switches (where the platform supports it)
- The app to restore the last-used tab on next open (falls back to `localStorage` if no hash)

The restore runs at the bottom of `app.js` after all converters are initialised:

```js
(function () {
  const hash = window.location.hash.slice(1) || getState('last_tab', '');
  if (hash) {
    const t = document.querySelector(`.tab[data-tab="${hash}"]`);
    if (t) t.click(); // triggers full tab-switch logic including scrollIntoView
  }
}());
```

### 3.8 Copy to Clipboard

Every result box has an absolutely-positioned copy button that is invisible until the user hovers (or slightly visible on touch devices). On click:

1. `navigator.clipboard.writeText(text)` copies the result text
2. The button icon swaps to a green checkmark for 1.5 seconds
3. The result text itself is never modified — only the button state changes

This keeps the interaction clean: the number stays readable while feedback is given.

---

## 4. Technology Decisions

### 4.1 Why Plain HTML / CSS / JS — Not a Framework?

The most common question: "Why not React / Vue / Svelte?"

| Factor | Framework | Plain JS |
| --- | --- | --- |
| Bundle size | 40–150 KB min (React + ReactDOM) | 0 KB overhead |
| Build step | Required (Vite, webpack, etc.) | None |
| Time to interactive | 200–600ms on slow connections | <50ms |
| Hosting complexity | Needs build output or CDN | Any static file server |
| Debugging | Source maps, devtools plugins | F12, read the file |
| Adding a feature | Component, state, props, re-render | One function, one section |
| Dependency updates | npm audit, breaking changes | Nothing to update |

At the scale of this app (nine converters, ~700 lines of JS), a framework solves no real problem and introduces significant overhead. The app is already fast, maintainable, and extensible without one.

The single architectural risk of plain JS — global state collisions and spaghetti DOM manipulation — is mitigated by the strict vertical-slice pattern described in §3.4.

### 4.2 Why No npm / Node.js At All?

Every npm-based project eventually encounters:

- Broken installs after `npm install` fails
- Security audit warnings from transitive dependencies
- `node_modules` folder that is hundreds of MB
- Build scripts that fail after a Node.js version upgrade

This project has none of those problems. It runs identically today, in five years, and on any machine with a browser — because it has no build toolchain to break.

### 4.3 Why Three Separate Files Instead of One?

A single `index.html` with inline `<style>` and `<script>` would also work, but three files are used because:

1. **Browser caching:** CSS and JS are cached separately from HTML. On repeat visits, only the HTML is re-fetched; the CSS and JS files are served from disk cache (or the Service Worker cache).
2. **Editor support:** Separate files get proper syntax highlighting, linting, and formatting in any editor.
3. **Maintainability:** Changing the layout never touches logic; changing logic never touches styles.

---

## 5. Hosting: GitHub Pages

### 5.1 Why GitHub Pages?

GitHub Pages was chosen because:

1. **Zero configuration for static files.** Point it at a branch + directory, and it serves every file as-is. No `vercel.json`, no `netlify.toml`, no build commands.
2. **Integrated with the git workflow.** Every `git push` deploys automatically. There is no separate deploy step, no deploy key, no webhook to set up.
3. **The repository already lives on GitHub.** Using Pages means the source code and the live deployment are in the same place — one URL for both.
4. **Free custom domain with HTTPS.** GitHub Pages supports custom domains with automatic TLS certificates via Let's Encrypt.
5. **No vendor lock-in for the app.** Because the app is plain files, it can be moved to any other host at any time by copying the files.

### 5.2 How GitHub Pages Works

```
git push origin main
        │
        ▼
GitHub receives the commit
        │
        ▼
Pages build job runs (for plain files: no build, instant)
        │
        ▼
Files are distributed to GitHub's CDN (Fastly)
        │
        ▼
https://pavan-459.github.io/Utility-App/ is live
        │  (typically < 60 seconds after push)
```

For a plain HTML/CSS/JS project, the "build" is a no-op — GitHub simply copies the files to its CDN. This is why deployments complete in under a minute.

### 5.3 Alternatives Comparison

| Host | Free Tier | Build Needed | Custom Domain | CDN | Deploy Trigger | Best For |
| --- | --- | --- | --- | --- | --- | --- |
| **GitHub Pages** ✅ | Unlimited | No | ✓ (free HTTPS) | Fastly | `git push` | Static files already on GitHub |
| **Netlify** | 100 GB/month | Optional | ✓ (free HTTPS) | Fastly | `git push` or drag-drop | Static sites with serverless functions |
| **Vercel** | Hobby tier | Optional | ✓ (free HTTPS) | Edge Network | `git push` | Next.js and React apps |
| **Cloudflare Pages** | Unlimited | Optional | ✓ (free HTTPS) | Cloudflare | `git push` | Best raw performance (Cloudflare CDN) |
| **Firebase Hosting** | 10 GB/month | No | ✓ (free HTTPS) | Google CDN | `firebase deploy` | Apps in the Google/Firebase ecosystem |
| **Surge.sh** | Unlimited | No | ✓ (paid HTTPS) | Fastly | `surge` CLI | Quick one-off deployments |

**Why not Netlify?** Netlify is slightly better technically (drag-and-drop deploy, better branch previews, form handling). For this project, GitHub Pages wins on simplicity — the app is already on GitHub and a push deploys it with no additional accounts or configuration.

**Why not Vercel?** Vercel is optimised for Next.js and React applications. For a no-framework project, it adds nothing over GitHub Pages.

**Why not Cloudflare Pages?** Cloudflare Pages actually has the best CDN performance globally. It is a legitimate alternative. The only reason it was not chosen here is that GitHub Pages requires one less account setup step.

### 5.4 Limitations of GitHub Pages

- **No server-side logic.** No API routes, no server-rendered pages. This app does not need any of that.
- **Public repositories only on free accounts.** The source code is public. For a personal utility tool with no secrets, this is fine.
- **Soft bandwidth limit.** GitHub recommends sites stay under 100 GB/month. A personal tool will never approach this.
- **Build minutes limit.** 2,000 minutes/month on free accounts. Since there is no build, this is never consumed.

---

## 6. Currency API Design

### 6.1 Requirements for the Currency API

The API must:

- Return live exchange rates
- Be **free with no API key** (no account sign-up, no token in the codebase)
- Have **CORS headers that allow all origins**, including `file://` (local filesystem)
- Be reliable enough for daily personal use

### 6.2 Why `@fawazahmed0/currency-api` via jsDelivr?

This is an open-source currency dataset published to npm and served via the jsDelivr CDN.

```
https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json
```

**Why this wins over every alternative:**

| Factor | jsDelivr CDN | Frankfurter | open.er-api.com | ExchangeRate-API | Fixer.io |
| --- | --- | --- | --- | --- | --- |
| API key required | None | None | None | Free signup | Required |
| CORS: all origins | ✅ | ❌ (blocks `file://`) | ✅ | ✅ | ✅ |
| CORS: `file://` | ✅ | ❌ | ✅ | ✅ | ✅ |
| Rate limit | None (CDN) | Reasonable | 1,500/month | 1,500/month | 100/month |
| Currency names | ✅ | ✅ | ❌ | ❌ | ✅ |
| Update frequency | Daily | Business days | Daily | Daily | Hourly (paid) |
| Reliability | CDN-grade (99.99%) | Single server | Single server | Single server | Single server |
| Cost if traffic grows | Free (CDN) | May throttle | May throttle | Paid tier needed | Paid tier needed |

The CDN delivery is the critical differentiator. jsDelivr is a public CDN serving npm packages — it has global edge nodes, 99.99% uptime SLAs, and is explicitly designed to serve any origin. Frankfurter was the original choice but blocked requests from `file://` protocol (the browser sends `Origin: null` for local files, which Frankfurter rejects with a CORS error).

### 6.3 API Response Format

**Currency names endpoint:**

```
GET …/v1/currencies.json

Response: { "usd": "US Dollar", "eur": "Euro", "inr": "Indian Rupee", ... }
```

**Rates endpoint (USD base):**

```
GET …/v1/currencies/usd.json

Response: { "date": "2024-06-28", "usd": { "eur": 0.9212, "inr": 83.45, ... } }
```

**Note:** All currency codes are lowercase. The app converts them to uppercase on ingestion to keep the rest of the codebase consistent (`rates['INR']` not `rates['inr']`).

### 6.4 Conversion Arithmetic

All rates are stored relative to USD (`rates.USD = 1`). Converting between any two non-USD currencies:

```
result = amount × rates[to] / rates[from]
```

This works because both rates are already expressed as "X units per 1 USD", so dividing one by the other gives the cross rate. No separate API call is needed per currency pair.

---

## 7. Offline Strategy

### 7.1 Three-Layer Fallback (Currency)

```
User opens app
      │
      ▼
Layer 1: MINIMAL_CURRENCIES (hardcoded)
  → Selects populated instantly, quick-pair buttons always work
  → No network needed, no delay
      │
      ▼
Layer 2: localStorage cache (uc_fx_cache)
  → If previously fetched rates exist, use them immediately
  → Show "Cached rates from YYYY-MM-DD (offline)" message if offline
      │
      ▼
Layer 3: Live API fetch (if online)
  → Fetch fresh rates, update cache, repopulate selects
  → Silently upgrades layer 2 data
```

### 7.2 Service Worker Cache (All Files)

Beyond the currency cache, the Service Worker (`sw.js`) caches the entire application shell on first load:

- `index.html`, `style.css`, `app.js`, `manifest.json`, `icon.svg` are pre-cached at install time
- **Static files:** cache-first strategy — served from cache immediately, updated in background
- **API calls (jsDelivr):** network-first strategy — try fresh data, fall back to cached response if offline
- **Navigation fallback:** if a request fails and nothing is cached, serve `index.html` so the app still loads

This means after the first visit with internet, the app loads and functions completely offline. The Service Worker cache is versioned (`uc-v2`); bumping the version number triggers a cache refresh on next load.

### 7.3 Manual Mode

When the user has no internet and no cache (first-ever load, offline), Live mode cannot provide rates. Manual mode fills this gap:

- A `1 [FROM] = [___] [TO]` input row appears
- The user types their own exchange rate (looked up elsewhere, memorised, etc.)
- Conversion proceeds using that rate with no network dependency
- If live rates later load, switching back to Live mode removes the manual input

### 7.4 Connection Detection

```js
setConn(navigator.onLine);  // initial state

window.addEventListener('online',  () => { setConn(true);  loadCurrencies(); });
window.addEventListener('offline', () => setConn(false));
```

The status pill in the corner updates in real time. If the user loses and regains connectivity, the app automatically re-fetches rates without requiring a page reload.

---

## 8. PWA Implementation

### 8.1 What Makes It a PWA?

A Progressive Web App requires three things:

1. **HTTPS** — satisfied by GitHub Pages (automatic)
2. **Web App Manifest** — `manifest.json`
3. **Service Worker** — `sw.js`

When all three are present and valid, Chrome/Edge on Android shows an "Add to Home Screen" install prompt. iOS Safari supports installation via the Share → Add to Home Screen flow.

### 8.2 Manifest

`manifest.json` tells the browser how to present the app when installed:

```json
{
  "name": "Utility Convertor",
  "short_name": "Convertor",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#f1f5f9",
  "theme_color": "#6366f1",
  "icons": [{ "src": "icon.svg", "sizes": "any", "purpose": "any maskable" }]
}
```

Key choices:

- `"display": "standalone"` — hides the browser URL bar and navigation chrome; feels like a native app
- `"start_url": "./"` — relative path, works on any subdirectory (GitHub Pages `/Utility-App/` or a custom domain `/`)
- `"theme_color": "#6366f1"` — the indigo accent colour; tints the Android status bar and the browser tab header

### 8.3 Icon

`icon.svg` is a vector icon: an indigo rounded square with two swap arrows drawn in white stroke. SVG is used rather than PNG because:

- **No image editor needed** — SVG is hand-authored text
- **Infinite resolution** — looks sharp at any density (1×, 2×, 3×, 4×)
- **Modern support** — Chrome on Android and Safari on iOS 16+ both accept SVG manifest icons; the `"sizes": "any"` value signals this

For maximum compatibility with older iOS (which requires a specific PNG at exactly 180×180), a PNG apple-touch-icon can be added later. The SVG already works in practice for modern devices.

### 8.4 Service Worker Lifecycle

```
First visit (online)
    │
    ├── SW registers and fires 'install'
    │     └── caches static files (HTML, CSS, JS, manifest, icon)
    │
    ├── SW fires 'activate'
    │     └── deletes caches with old version keys
    │
    └── SW intercepts all fetch events going forward

Subsequent visits (offline OK)
    │
    └── SW serves HTML, CSS, JS from cache
          └── Currency API: attempts network, falls back to cached rates
```

The `skipWaiting()` + `clients.claim()` pattern ensures a new service worker takes control immediately on install rather than waiting for all tabs to be closed.

### 8.5 iOS Specific Meta Tags

Safari on iOS does not use the manifest for some properties; separate `<meta>` tags are required:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Convertor">
<link rel="apple-touch-icon" href="icon.svg">
```

The `default` status bar style keeps the native status bar visible (time, battery, signal) above the app, which is the correct choice for a utility app.

---

## 9. Development Process

### 9.1 Philosophy

**Progressive enhancement over upfront design.** Each feature is added only when there is a concrete need for it. No features were built speculatively. The roadmap exists to capture ideas, not to drive a sprint.

**No abstractions until the third repetition.** The `wire()`, `fill()`, and `wirePersist()` helper functions were extracted only after the same pattern appeared across multiple converter sections. Until then, the code was repeated explicitly — duplication is cheaper than the wrong abstraction.

### 9.2 Iteration History

| Version | What was built | Why |
| --- | --- | --- |
| v1 | Currency, Length, Weight, Temperature | Core daily-use converters |
| v2 | Live/Manual mode, connection status, localStorage cache | Currency API was unreliable; needed offline fallback |
| v3 | Time Zones tab (world clock + converter) | Friends across 6 countries, needed at-a-glance times |
| v4 | Fix quick-pairs in manual mode | Bug: selects empty before API loads; added MINIMAL_CURRENCIES fallback |
| v5 | Switch from Frankfurter to jsDelivr CDN | Frankfurter blocked `file://` origin (CORS) |
| v6 | Crores / Scale converter | Need: understand USD millions in Indian crore terms |
| v7 | Dark/light theme, mobile bottom nav | Polish: system preference detection, phone usability |
| v8 | PWA (manifest + Service Worker + icon) | Install to home screen, true offline-first |
| v8 | Area, Speed, Data converters | Fill remaining everyday conversion gaps |
| v8 | Copy to clipboard, state persistence, hash routing | Quality-of-life: one tap to copy, remember last units, deep links |

### 9.3 Decisions That Were Deliberately Not Made

- **No TypeScript** — adds a build step for no runtime benefit at this scale
- **No CSS preprocessor (Sass/Less)** — CSS custom properties already solve the theming problem natively
- **No test suite** — unit tests for `fmt()` or `convertLength()` would be straightforward to add, but the manual verification cost is low for a personal tool
- **No linter / formatter config** — the code is consistent enough without tooling enforcement
- **No IndexedDB** — localStorage is sufficient; the data stored (rates, unit prefs, theme) is small and non-critical if cleared

---

## 10. Known Limitations

| Limitation | Impact | Potential Fix |
| --- | --- | --- |
| US timezone defaults to Eastern (New York) | Friends in US Pacific, Central, Mountain see wrong time | Add a US timezone selector |
| Currency rates update once daily | Cannot track intraday fluctuations | Use a paid real-time API (Alpha Vantage, etc.) |
| localStorage can be cleared by browser | Cache lost, reverts to MINIMAL_CURRENCIES until online | Use IndexedDB for more persistent storage |
| No keyboard shortcuts to switch tabs | Extra clicks on desktop | Add `1`–`9` key shortcuts |
| SVG icon only (no PNG) | Older iOS versions may not show icon correctly on home screen | Generate 192×192 and 512×512 PNGs and add to manifest |
| Speed: Mach speed uses sea-level sound speed (343 m/s) | Mach varies with altitude and temperature | Accept this limitation for everyday use; the value is close enough |

---

## 11. Roadmap

Planned additions (in rough priority order):

- [ ] **Height display mode** — show feet + inches together (5'7") alongside cm, not just one or the other
- [ ] **Fuel efficiency** — L/100km, mpg US, mpg UK (three different standards)
- [ ] **US timezone selector** — let the user pick which US timezone their friend is in
- [ ] **Keyboard shortcuts** — number keys `1`–`9` to switch tabs, `Tab` to move between fields
- [ ] **PNG icons** — generate 192×192 and 512×512 PNGs for full iOS home-screen icon support
- [ ] **BMI / body metrics** — given height and weight, compute BMI with category label
- [ ] **Currency sparkline** — 7-day rate trend for the selected pair (using the API's dated endpoints)

---

## 12. Conclusion

### What was achieved

A fully functional, zero-dependency, zero-install, zero-cost utility app that:

- Works fully offline (all unit conversions, time zones, currency via Service Worker cache)
- Installs to the home screen on Android and iOS as a standalone app
- Works on any device with a browser
- Loads in under 200ms
- Is hosted for free on GitHub Pages
- Can be extended by adding one code block per new converter
- Remembers your preferences and last-used settings across sessions

### The core architectural lesson

The best technology for a personal tool is the one with the **lowest total maintenance cost over time**, not the most popular or the most capable.

- A React app would have needed `npm audit fix` within weeks
- A backend would have needed a server to manage and a cost to sustain
- A third-party converter site would have shown ads, reset preferences, and been unavailable offline

A handful of plain files, a CDN-hosted API, and GitHub Pages deliver the same outcome with essentially zero ongoing maintenance burden. The code written today will still run correctly in ten years, without touching it, because HTML, CSS, and browser JavaScript are stable standards — not npm packages.

### Design principle

> Build the simplest thing that fully solves the problem. Add complexity only when the simplest thing demonstrably cannot scale to the next requirement.

This app is not "simple because it's small." It is simple by deliberate design — every complexity that was considered (frameworks, build tools, backends, databases) was rejected because the problem did not justify it. That is a design decision, not an oversight.
