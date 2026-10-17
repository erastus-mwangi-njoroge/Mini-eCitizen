# Murang'a Service Requests

A mini **eCitizen-style Public Service Request System** for Murang'a County. Citizens report problems (broken streetlight, water issue, garbage collection…), staff work them through **Pending → In Progress → Resolved**, and an admin dashboard shows open vs resolved cases at a glance.

Zero dependencies: Node.js 18+ is all you need. No build step, no database server.

## Quick start

```bash
node server.js          # http://localhost:3000
npm run seed            # optional: 5 demo citizens + 42 sample requests (run before or after first start)
npm test                # 30 automated tests
```

| Role | Sign in with |
|---|---|
| Admin (staff) | `admin@muranga.go.ke` / `ChangeMe123` (created on first run) |
| Demo citizen (after `npm run seed`) | `citizen1@example.com` / `Password123` |
| New citizen | Use **Create account** on the site |

**Finding the admin dashboard:** click **Staff login** in the top bar (or *Staff sign-in* in the footer), sign in with the admin account above, and you land on the dashboard. A normal citizen account never sees it. To make an existing account an admin: `npm run make-admin -- someone@example.com`.

Configuration is optional; copy `.env.example` to `.env` to change anything (see [Configuration](#configuration)).

## Features

**Required**
- **Citizen registration / login** — scrypt-hashed passwords, signed HttpOnly session cookie.
- **Submit a request** — category, sub-county → ward, exact location, description, optional photo.
- **Admin dashboard** — every request, with search, filters (status, category, priority), sorting and pagination.
- **Status tracking** — Pending → In Progress → Resolved, enforced on the server; each change is stored in a timeline with the staff member's name and an optional note the citizen can read.
- **Basic analytics** — open vs resolved counts, plus: pending / in-progress split, resolution rate, average time to resolve, cases open > 7 days, breakdown by category and by ward, and a 14-day submitted-vs-resolved chart.

**Bonus**
- Public **tracking by reference number** (e.g. `SR-2026-00042`) with no sign-in — shows progress only, no personal or location detail.
- **Priority** levels (Low / Normal / High / Urgent) set by staff; sort by priority.
- **Re-open** a resolved request if the fix did not hold.
- **CSV export** of the filtered list (formula-injection safe).
- Photos are **verified by content** (PNG/JPEG/WebP magic bytes, size limit) and shrunk in the browser before upload.
- Responsive layout (tables become cards on phones), dark mode, keyboard and screen-reader friendly (skip link, labels, `aria-live`, status never conveyed by colour alone).
- Security: rate limiting, CSRF defences (SameSite=Strict + Origin check), strict Content-Security-Policy, ownership checks on every request.
- Demo-data seeder and an automated test suite.

## How it works (user journeys)

1. **Citizen** registers → *Report a problem* → receives a reference number → follows the timeline on *My requests*.
2. **Admin** signs in → lands on the dashboard → clicks a request → moves it to *In Progress* (optionally setting priority and writing a note) → later marks it *Resolved*.
3. **Anyone** can type a reference number on *Track a request* to see its status.

## Project structure

```
server.js                 entry point (starts the HTTP server)
src/
  config.js               the only file that reads environment variables
  container.js            composition root: creates and wires every object
  domain/                 pure rules, no I/O: categories, statuses & transitions, locations, validation, image checks, errors
  repositories/           persistence: jsonStore (atomic file writes), userRepository, requestRepository
  services/               use cases: authService, requestService, analyticsService, imageStorage
  security/               passwordHasher, tokenService, rateLimiter, secret
  http/                   router, context (body/cookies), guards, static files, app (headers, sessions, errors)
  routes/index.js         every API endpoint in one readable list
public/                   front end: plain ES modules, no build
  js/core/                api client, session, hash router, formatters, toasts, DOM helper
  js/components/          navbar, footer, badges, timeline, form helpers, charts
  js/views/               one file per screen; each registers its own route
  css/style.css           design tokens, components, responsive rules
test/                     node:test suites (domain, auth, requests/admin/analytics)
scripts/seed.js           demo data
docs/API.md               endpoint reference
```

Design notes:
- **Layers depend downwards**: routes → services → repositories/domain. Services hold the business rules (who may see what, which status changes are legal); routes only translate HTTP.
- **Swapping storage** (e.g. to PostgreSQL) means writing new repositories — services and routes do not change. `container.js` is the only place that picks concrete classes.
- **Adding a category** = one line in `src/domain/categories.js`. **Adding a screen** = one file in `public/js/views/` plus an import in `main.js`.
- The front end builds DOM with `h()` (never `innerHTML`), so user text cannot inject HTML.

## Configuration

Set as environment variables or in `.env` (Node 20.12+ loads it automatically).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | Folder for `db.json`, `uploads/` and the session secret |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@muranga.go.ke` / `ChangeMe123` | First admin, created only if no admin exists. **Password is required** in production |
| `SESSION_SECRET` | auto-generated once | Signs login cookies |
| `SESSION_HOURS` | `8` | Login lifetime |
| `NODE_ENV` | – | `production` turns on Secure cookies and removes the default admin password |
| `MAX_IMAGE_MB` | `5` | Largest photo |
| `RATE_LIMIT` | `20` | Sign-in/registration/tracking attempts per minute per client |

## Deploying

Run `NODE_ENV=production ADMIN_PASSWORD=<strong> node server.js` behind an HTTPS reverse proxy (Nginx, Caddy…); keep `DATA_DIR` on persistent storage and back it up. The JSON store holds everything in memory and suits a single server process and thousands of requests; for larger scale, implement the two repositories against a database.

## Testing

`npm test` starts the real server on a random port with a temporary data folder and exercises it over HTTP: registration and login rules, tampered cookies, rate limiting, request validation, photo checks, access control (citizen vs admin vs anonymous), the status workflow, public tracking privacy, filtering/pagination, analytics totals, and CSV safety.

## Known limitations

- Ward data follows the 35 IEBC wards. *Maragua* and *Murang'a South* share Maragua-constituency wards because no verified split was available; edit `src/domain/locations.js` if the county has one.
- No email/SMS notifications or password reset (citizens see updates in the app). These are natural next steps.
- Rate limiting is per process and uses the socket address; behind a proxy, configure the proxy to rate-limit too.
