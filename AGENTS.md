# AGENTS.md — Journal Tracker Development Guide

> Single source of truth for how to work in this codebase. Read before writing any code.

## Project Overview

Pure-static conference/journal submission deadline tracker. Zero backend. Deployed to GitHub Pages via GitHub Actions.

## Tech Stack

- **Frontend**: Vanilla HTML5 + TailwindCSS (CDN) + minimal Alpine.js (CDN)
- **Data**: Static JSON files in `data/`
- **i18n**: JSON files in `i18n/` — **never** hardcode English/Chinese text in HTML
- **Build**: None. No Node.js, no Webpack, no compilation step.
- **Deployment**: GitHub Actions workflow at `.github/workflows/deploy.yml`

## Architecture

```
index.html   ← Dashboard (countdown banner, critical deadlines, discipline cards)
venues.html  ← Listing page (search, filters, venue cards)
venue.html   ← Detail page (dynamic via ?id= param)
css/styles.css ← Custom styles, dark mode, animations
js/app.js    ← All logic: data loading, routing, i18n, theme, countdown, localStorage
data/        ← Static data JSON files
i18n/        ← Translation files
```

### Navigation Model

- Hash-based routing: `#/`, `#/venues`, `#/venue?id=xyz`, `#/timeline`, `#/about`
- `js/app.js` handles all routing — pages are "views" within a SPA-like structure
- Each HTML page contains all markup; JS shows/hides sections based on hash

### Data Loading

- `app.js` fetches ALL data files on load: `data/*.json` + `i18n/{lang}.json`
- Data is cached in a global `STATE` object
- All venue data is merged into a single `VENUES` array at runtime
- Fetch is relative-path based — works on `file://` and HTTPS (GitHub Pages)

## Coding Standards

### HTML
- Use `data-i18n="key"` attributes on ALL translatable text elements
- Use `data-priority="critical|important|normal"` on deadline items
- Use `data-discipline="ai|cs|history|economics|finance"` on discipline-tagged elements
- All external CDN links use `https://`
- Mobile-first: drawer menu (`#mobile-menu` toggled by `#menu-toggle`)

### CSS (`css/styles.css`)
- Use `[data-theme="dark"]` selector for dark mode (NOT CSS variables)
- Priority colors from `data/config.json` priorityLevels
- Pulsing animation class: `.pulse-critical` (for critical deadline highlights)
- Timeline: vertical line with dots, `.timeline-item` with colored border-left
- Print styles: `.printable` class for deadline export

### JavaScript (`js/app.js`)
- **No framework** — vanilla JS only. Alpine.js used sparingly for reactive UI elements
- Global `STATE` object holds: `venues`, `config`, `translations`, `currentLang`, `currentTheme`, `savedVenues`
- All DOM manipulation uses vanilla `document.querySelector` / `addEventListener`
- **Must not**: use `eval`, modify `data/` JSON files, make external API calls
- **Must**: validate JSON on load, handle missing data gracefully, update countdowns every 60s
- Date formatting: use `Intl.DateTimeFormat` with locale from current language
- localStorage keys: `jt_theme` (light/dark), `jt_lang` (en/zh), `jt_saved` (array of venue IDs)

### Data Schema (`data/*.json`)
```typescript
// config.json
discipline: { name, zh, color, textColor, border }
priorityLevels: { critical|important|normal: { text, zh, color, textColor, border, ring, description } }
deadlineTypes: { [key]: { text, zh, icon, color } }

// venue objects
id: string
name: string
shortName: string
type: "conference" | "journal"
discipline: "ai" | "cs" | "history" | "economics" | "finance"
subfield: string[]
website: string
submitLink: string
important: boolean
ranking: string
requirements: object (varies by type)
deadlines: [{ type, date, time, timezone, important, priority, description }]
```

## Development Workflow

1. Edit data in `data/*.json` or content in `i18n/*.json`
2. Edit UI in `index.html`, `venues.html`, `venue.html`
3. Edit logic in `js/app.js`
4. Edit styles in `css/styles.css`
5. Validate JSON: `python3 -c "import json,glob; [json.load(open(f)) for f in glob.glob('data/*.json')+glob.glob('i18n/*.json')]; print('✓ valid')"`
6. Test locally: `npx serve .` or `python3 -m http.server`
7. Commit + push → GitHub Actions deploys to Pages

## Testing Checklist

Before any PR:
- [ ] All JSON files validate with no syntax errors
- [ ] `index.html` loads and dashboard renders countdowns
- [ ] `venues.html` loads and filter/search works
- [ ] `venue.html?id=xxx` loads correct venue data
- [ ] Critical deadlines have red pulsing border + ⚡ icon
- [ ] Dark mode toggle persists (check localStorage `jt_theme`)
- [ ] Language toggle persists (check localStorage `jt_lang`)
- [ ] "Save to My Dates" works (check localStorage `jt_saved`)
- [ ] Countdown timers update live (60s interval)
- [ ] Mobile drawer menu works on small screens
- [ ] GitHub Actions workflow passes JSON validation

## Key Deadlines Highlighting Rules

| Priority | Border | Ring | Icon | Animation |
|---|---|---|---|---|
| critical | `border-red-500` | `ring-red-500` | ⚡ | `animate-pulse` |
| important | `border-amber-500` | `ring-amber-500` | ⚠️ | none |
| normal | `border-gray-400` | `ring-gray-400` | 📅 | none |

## AGENTS.md Maintenance

Update this file when:
- Adding new disciplines or priority levels (update `data/config.json` schema)
- Changing routing patterns (update hash routes)
- Adding new data files (update data loading in `app.js`)
- Changing i18n structure (update translation key format)
