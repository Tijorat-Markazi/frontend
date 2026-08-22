# TIJORAT MARKAZI — Frontend

Web client for the TIJORAT MARKAZI platform. Plain HTML, CSS and browser
JavaScript — no build step, no bundler, no framework.

## Layout

| Path | What it is |
|------|------------|
| `index.html` | Landing page |
| `kirish.html`, `royxatdan-otish.html` | Login and registration |
| `admin.html` | Admin panel |
| `company.html`, `association.html`, `associations.html` | Cabinets |
| `bozor.html`, `moliya.html`, `mehnat.html` | Bozor, Moliya bozori, Human Capital markets |
| `assistant.html`, `chat.html` | AI assistant and chat |
| `ux-*.html` | Design and pattern reference pages |
| `styles.css`, `markets.css`, `patterns.css`, `bg-lab.css` | Stylesheets |
| `assets/` | Monument and naqsh artwork |

## Running

The pages are static, so any static server will serve them:

```bash
python -m http.server 8080
```

**Important:** every page calls the API at relative paths (`/api/...`), so the
frontend must be served from the **same origin** as the backend. In production
put both behind one reverse proxy, or let the backend serve this directory —
`server.js` in the backend repo already serves static files from its own root.

Backend: https://github.com/Tijorat-Markazi/backend
