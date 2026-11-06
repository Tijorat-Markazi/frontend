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

Every page calls relative `/api/...` paths. Production serves this image behind
the infra repository's Caddy proxy on the same origin as the backend. The proxy
also forwards `/ws` and `/uploads/` to the backend without stripping their paths.

## Verification and production image

Use Node 24 (see `.node-version`). No frontend dependency, framework or bundler is
required. `npm ci` installs no runtime packages.

```bash
npm ci
npm test
npm run build
docker build -t tijorat-frontend .
```

The build validates browser and inline scripts, local assets and the session
contract, then stages only public files in `dist/`. The final image contains
static files and NGINX, runs as UID/GID 101 on port 8080, and exposes `/healthz`.
It supports a read-only root filesystem with writable `/tmp`. Missing files return
404; files revalidate after deployment because their names are not fingerprinted.
TLS, IPv6 internet connectivity and HTTP/3 are configured by infra's edge proxy.
Follow the [infra setup guide](https://github.com/Tijorat-Markazi/infra/blob/main/SETUP.md)
for first deployment. Infra validation and deployment are jobs in one workflow
run; validation failures prevent deployment and app cleanup.

## Sessions

`auth.js` is loaded before application scripts on every page. It bootstraps
`/api/auth/session` and sends same-origin cookies and CSRF headers on writes.
Credentials are sent only to `/api/auth/login`; browser storage holds no login
credentials or role authority. Existing credential caches are removed on load.
Logout revokes the server session. Private downloads use the cookie, with no
passwords in URLs. A browser shares one account session across its tabs.

Guests have a server-issued browser identity; email/name fields are contact
information and cannot select another person's data. Guest assistant chats stay
in memory; account chat history belongs to the authenticated account. Restricted
rights access remains available through `mening-malumotlarim.html` without
restoring cabinet privileges. The frontend requires no production secrets or
environment variables; those belong in the infra repository's `prod` environment.

Backend: https://github.com/Tijorat-Markazi/backend

## Dedicated Docker server

The existing shared Caddy terminates TLS for `tijoratmarkazi.uz` and forwards to
Compose service `tijoratmarkazi-frontend:8080`. Nginx serves the static site and
proxies `/api`, `/ws` and `/uploads` (including subpaths) to the private Docker
alias `tijoratmarkazi-backend-upstream:4321`. Prefixes and cookies are preserved.
Lazy DNS lets frontend health pass before backend startup. The frontend joins
the edge and project backend networks, never the shared database network.

Public listeners and certificates remain with the shared edge; the project's
host port stays bound to 127.0.0.1. Frontend images from before this routing
change are incompatible with the new layout. Published-image scans now also
exercise HTTP routing, forwarded identity, WebSocket upgrades and token-safe
logging using a disposable backend fixture. No production credentials are used.
See the infra repository's SETUP.md for the approved frontend-first cutover.
