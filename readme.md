# Utility Convertor

A clean, fast, everyday converter app — no installs, no login, works offline after first load. Installable on Android and iOS as a home-screen app (PWA).

**Live:** <https://pavan-459.github.io/Utility-App/>

## Features

| Converter | Units / Scope |
| --- | --- |
| Currency | 170+ currencies with live rates, offline manual mode, quick pairs |
| Length | mm, cm, m, km, in, ft, yd, mi, nautical mile |
| Weight | mcg, mg, g, kg, metric ton, oz, lb, stone |
| Temperature | Celsius, Fahrenheit, Kelvin |
| Crores / Scale | Western millions ↔ Indian crores/lakhs, with live INR conversion |
| Time Zones | Live world clock (Sweden, US, UK, NZ, Finland, Spain) + any-time converter |
| Area | mm², cm², m², km², hectare, acre, ft², yd², mi² |
| Speed | m/s, km/h, mph, knot, ft/s, Mach |
| Data | bit, byte, KB, MB, GB, TB, PB |

**Also:**

- PWA — installable on Android and iOS home screen, works fully offline
- Live currency rates via [@fawazahmed0/currency-api](https://github.com/fawazahmed0/exchange-api) (no API key)
- Three-layer offline fallback: hardcoded data → cached rates → live API
- Tap-to-copy on every result
- Remembers your last-used units and tab across sessions
- Deep-linkable tabs via URL hash (`#currency`, `#length`, etc.)
- Dark / light mode with system preference detection
- Mobile-first with bottom navigation bar

## Install on your phone

### Android (Chrome)

1. Open the live URL in Chrome
2. Tap the three-dot menu → **Add to Home Screen**
3. Tap **Install** — the app launches without browser chrome

### iOS (Safari)

1. Open the live URL in Safari
2. Tap the **Share** button → **Add to Home Screen**
3. Tap **Add** — the app launches in standalone mode

## Usage

Open `index.html` directly in any browser — no build step, no server needed. Works on `file://`, `localhost`, and any hosted URL.

## Hosting

Deployed on GitHub Pages. To deploy your own fork:

1. Go to **Settings → Pages**
2. Source: `main` branch, `/ (root)`
3. Save — live at `https://<username>.github.io/<repo>/`

Every `git push` to `main` deploys automatically.

## Roadmap

- [x] Currency with live rates + offline manual mode
- [x] Length, Weight, Temperature
- [x] Time zones (world clock + converter)
- [x] Crores / Indian scale converter
- [x] Area, Speed, Data converters
- [x] PWA (installable, offline-first)
- [x] Copy result to clipboard
- [x] Persist last-used units across sessions
- [x] Hash-based tab routing
- [ ] Height combined display (5'7" mode)
- [ ] Fuel efficiency (L/100km ↔ mpg)
- [ ] US timezone selector (Pacific / Central / Mountain / Eastern)
- [ ] Keyboard shortcuts (1–9 to switch tabs)
