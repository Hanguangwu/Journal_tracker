# Journal & Conference Tracker

A pure-static, zero-backend site that tracks submission deadlines and requirements for top-tier venues across **Computer Science, AI, History, Economics, and Finance**.

Deployed via **GitHub Actions → GitHub Pages**. No server, no runtime — just static files served to the world.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Deadline Dashboard** | Live countdown to the next critical deadline across all disciplines |
| **Critical Deadline Highlighting** | Red pulsing borders ⚡ for deadlines you absolutely cannot miss |
| **Bilingual UI** | Toggle between English and Chinese — all strings externalized |
| **Dark/Light Mode** | Theme persists across sessions via `localStorage` |
| **Venue Search & Filter** | Search, filter by discipline/type/priority, sort by deadline proximity |
| **Detailed Requirement Cards** | Full submission guidelines (page limits, format, anonymization, fees, etc.) |
| **Timeline View** | Visual vertical timeline of upcoming deadlines |
| **My Saved Dates** | Bookmark venues with a click — saved to browser `localStorage` |
| **Responsive Design** | Mobile-first with drawer menu for small screens |

---

## 🚀 Live Demo

Once deployed: [https://your-username.github.io/journal-tracker/](https://your-username.github.io/journal-tracker/)

---

## 📁 Project Structure

```
journal-tracker/
├── index.html              # Dashboard: countdown banner + critical deadlines + discipline cards
├── venues.html             # All venues listing with search/filter/sort
├── venue.html              # Dynamic venue detail page (?id=xxx)
├── css/
│   └── styles.css          # Custom styles + dark mode + animations
├── js/
│   └── app.js              # Data loader, router, i18n, theme, countdown logic
├── data/
│   ├── config.json         # Discipline colors, priority levels, deadline type metadata
│   ├── cs-ai-conferences.json   # 9 major CS/AI conferences
│   ├── economics-journals.json   # 7 top economics journals
│   ├── history-journals.json     # 5 top history journals
│   └── finance-journals.json     # 5 top finance journals
├── i18n/
│   ├── en.json             # English translations
│   └── zh.json             # Chinese (Simplified) translations
├── .github/workflows/
│   └── deploy.yml          # GitHub Actions → Pages deployment
├── README.md
└── AGENTS.md
```

---

## 📊 Data Model Overview

Each venue (conference or journal) has:

- **Identifying info**: `id`, `name`, `shortName`, `website`, `submitLink`, `ranking`
- **Discipline tags**: `discipline`, `subfield[]`, `important` flag
- **Requirements**: `paperLength`, `format`, `anonymization`, `dualSubmission`, `abstractRequired`, `openReview`, `fee`, `pageLimit`, `impactFactor`, `acceptanceRate`, `turnaround`, etc.
- **Deadlines**: array of `{ type, date, time, timezone, important, priority, description }`

### Priority Levels

| Priority | Visual | Meaning |
|---|---|---|
| `critical` | 🔴 Red border + pulsing glow + ⚡ icon | Must not miss — missing this date means no submission possible |
| `important` | 🟠 Amber border + ⚠️ icon | Should not miss — affects final acceptance and publication |
| `normal` | ⚪ Gray border + 📅 icon | Informational — keep an eye on timeline |

### Deadline Types

`abstract`, `submission`, `notification`, `cameraReady`, `registration`, `specialIssue`, `supplemental`, `withdraw`

---

## 🔧 Adding or Updating Venues

All data lives in static JSON files under `data/`. To add or update a venue:

1. Edit the appropriate file in `data/` (e.g., `cs-ai-conferences.json`)
2. Add or modify a venue object following the existing schema
3. Commit and push — GitHub Actions will validate JSON and redeploy automatically

### Example venue entry:

```json
{
  "id": "nips",
  "name": "Conference on Neural Information Processing Systems",
  "shortName": "NeurIPS",
  "type": "conference",
  "discipline": "ai",
  "subfield": ["machine-learning", "deep-learning"],
  "important": true,
  "ranking": "A*",
  "website": "https://neurips.cc/",
  "submitLink": "https://openreview.net/group?id=neurips.cc/2025/Conference",
  "requirements": {
    "paperLength": "8 pages + unlimited references",
    "format": "NeurIPS LaTeX style file",
    "anonymization": "double-blind",
    "supplemental": "allowed, must be anonymized",
    "dualSubmission": false,
    "abstractRequired": true,
    "openReview": true,
    "fee": "$1200 USD (student: $600)",
    "abstractWordLimit": "500 words"
  },
  "deadlines": [
    {
      "type": "abstract",
      "date": "2025-05-15",
      "time": "13:00:00-04:00",
      "timezone": "America/New_York",
      "important": true,
      "priority": "critical",
      "description": "Abstract registration deadline"
    },
    {
      "type": "submission",
      "date": "2025-05-22",
      "time": "13:00:00-04:00",
      "timezone": "America/New_York",
      "important": true,
      "priority": "critical",
      "description": "Full paper submission deadline (no extensions)"
    }
  ]
}
```

---

## 🛠️ Local Development

This is a pure static site — no installation or build step required.

```bash
# Option 1: Open directly in browser (no server needed)
open index.html

# Option 2: With a local server for JSON fetch support
npx serve .      # or: python3 -m http.server 8000

# Validate JSON files
python3 -c "
import json, glob
for f in glob.glob('data/*.json') + glob.glob('i18n/*.json'):
    json.load(open(f))
    print(f'✓ {f}')
"
```

---

## 🚀 Deployment to GitHub Pages

This project deploys via **GitHub Actions** (direct deployment) — not a manually-managed `gh-pages` branch. When you push to `main`, a workflow automatically builds, validates, and publishes the site. GitHub's `deploy-pages` action manages the `gh-pages` branch internally; you never need to create or maintain it yourself.

### How It Works

1. **Push trigger**: On every push to `main`/`master`, or via manual `workflow_dispatch`, the workflow runs.
2. **JSON validation**: The workflow validates all `data/*.json` and `i18n/*.json` files. If any file is invalid, the workflow fails and no deployment occurs.
3. **Build job**: Uploads all project files as a Pages artifact named `github-pages`.
4. **Deploy job**: Downloads the artifact and publishes it to GitHub Pages via the `deploy-pages` action, which internally manages the `gh-pages` branch.

### Concurrency (Per-Branch)

The workflow uses a concurrency group keyed by branch ref:

```yaml
concurrency:
  group: pages-${{ github.ref }}
```

This ensures that pushes to different branches don't cancel each other's deployments, while rapid pushes to the same branch (e.g., during rapid iteration) will cancel in-progress runs to keep things efficient.

### Step-by-Step Setup

1. **Push to GitHub** — commit and push your changes to `main`:

   ```bash
   git add .
   git commit -m "Update venue deadlines"
   git push origin main
   ```

2. **Watch the workflow** — go to your repo's **Actions** tab. You'll see the "Deploy to GitHub Pages" workflow running. Wait for it to complete (usually ~1 minute).

3. **Configure Pages source** — one time only, go to **Settings → Pages** in your GitHub repo. Under "Build and deployment", set **Source** to **GitHub Actions**. (The workflow name will auto-populate.)

4. **Visit your site** — once the workflow succeeds, your site is live at:
   ```
   https://<your-username>.github.io/<repo-name>/
   ```

### Manual Trigger

You can also trigger a deployment manually from the **Actions** tab → "Deploy to GitHub Pages" → **Run workflow** dropdown → **Run workflow**.

### What If JSON Validation Fails?

If any `data/*.json` or `i18n/*.json` file has a syntax error, the workflow stops at the "Pre-validate data files" step and no deployment happens. Fix the JSON error, commit, and push again.

---

## 📦 Tech Stack

| Category | Technology |
|---|---|
| **UI Framework** | Vanilla HTML5 + TailwindCSS (CDN) |
| **Interactivity** | Vanilla JS + Alpine.js (CDN, minimal) |
| **Icons** | Emoji + Bootstrap Icons (CDN) |
| **Data** | Static JSON files (no API) |
| **i18n** | JSON resource files |
| **Build** | None — pure static |
| **CI/CD** | GitHub Actions |
| **Hosting** | GitHub Pages |
| **Theme** | CSS attribute-based dark mode (`data-theme="dark"`) |

---

## 🤝 Contributing

1. Fork the repository
2. Add/update venue data in `data/`
3. Update translations in `i18n/` if UI text changed
4. Open a PR — GitHub Actions will run JSON validation

All contributions welcome! Especially deadline updates and new venue additions.

---

## 📄 License

MIT — use freely for research and academic purposes.
