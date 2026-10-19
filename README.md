# Murang'a Service Requests

A mini **eCitizen-style Public Service Request System** for Murang'a County. Citizens report problems (broken streetlight, water issue, garbage collection…), staff work them through **Pending → In Progress → Resolved**, and an admin dashboard shows open vs resolved cases at a glance.

Zero dependencies: Node.js 18+ is all you need. No build step, no database server.

## Quick start

```bash
node server.js          # http://localhost:3000
npm run seed            # optional: 5 demo citizens + 42 sample requests (run before or after first start)
npm test                # 30 automated tests
```

The app is **two separate portals** with separate accounts, sessions and looks:

| Portal | Address | Look | Sign in with |
|---|---|---|---|
| **Citizen site** | `/` | green + gold | A citizen account (**Create account**), e.g. demo `citizen1@example.com` / `Password123` after `npm run seed` |
| **Staff portal** | `/#/staff/login` (link in the footer) | navy + cyan, split-screen sign-in | A `@muranga.go.ke` account. Default admin: `admin@muranga.go.ke` / `ChangeMe123` (created on first run) |

How the separation works:
- **Staff accounts must use a `@muranga.go.ke` email**, both to sign in and to sign up. Citizens cannot register with that domain.
- **A citizen's correct email and password are rejected by the staff portal, and a staff member's correct credentials are rejected by the citizen site** — each portal only recognises its own accounts, and uses its own session cookie. Both can be signed in at once in one browser without mixing identities.
- **Staff sign-up** (`/#/staff/register`) also asks for a **staff access code**. An email address cannot be verified by this app, so without the code anyone could type a `@muranga.go.ke` address and become staff. Dev default: `MURANGA-STAFF`. In production set `STAFF_ACCESS_CODE`; if it is unset, staff sign-up is closed and the admin creates accounts by other means.

## Forgot password (email via Brevo)

Both portals have a **Forgot your password?** link. The user enters their email, receives a one-time link (valid 30 minutes), and chooses a new password. Details:
- The reply is the same whether or not the email is registered, so it cannot be used to discover accounts.
- Only a hash of the token is stored, the link works once, and every sign-in that was open before the reset is ended.
- A citizen link only resets a citizen account, and a staff link only a `@muranga.go.ke` staff account (staff passwords need 10+ characters).
- At most one email per account per minute, plus the normal rate limits.

**Without any setup** (development) the email is printed in the server console, link included, so everything can be tested locally.

**To send real emails with Brevo** (free plan: 300 emails/day, no credit card):
1. Create an account at brevo.com.
2. **Senders, domains & dedicated IPs → Senders → Add a sender.** Enter the address you want emails to come from and click the verification link Brevo emails you. Only a verified sender can send.
3. **SMTP & API → API keys → Generate a new API key** and copy it.
4. Set these environment variables (on Render: *Environment* tab):

| Variable | Value |
|---|---|
| `BREVO_API_KEY` | the API key from step 3 |
| `MAIL_FROM_EMAIL` | the verified sender address from step 2 |
| `PUBLIC_URL` | the site's public address, e.g. `https://your-app.onrender.com` (Render sets `RENDER_EXTERNAL_URL` automatically, which is used if `PUBLIC_URL` is empty) |
| `MAIL_FROM_NAME` | optional display name |

In production, if any of these is missing, reset emails are disabled (a warning is logged and the link is never written to the logs). Notes: a free Gmail/Yahoo address as sender may land in spam; staff reset emails can only be delivered to real mailboxes, so a made-up `@muranga.go.ke` address will never receive one.


## Features

**Required**
- **Citizen registration / login** — scrypt-hashed passwords, signed HttpOnly session cookie.
- **Forgot password** for both portals, by email through Brevo (free tier).
- **Separate staff portal** — own sign-in/sign-up, own theme, `@muranga.go.ke` accounts only.
- **Submit a request** — category, sub-county → ward, exact location, description, optional photo.
- **Admin dashboard** — every request, with search, filters (status, category, priority), sorting and pagination.
- **Status tracking** — Pending → In Progress → Resolved, enforced on the server; each change is stored in a timeline with the staff member's name and an optional note the citizen can read.
- **Basic analytics** — open vs resolved counts, plus: pending / in-progress split, resolution rate, average time to resolve, cases open > 7 days, breakdown by category and by ward.

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
2. **Staff** sign in to the staff portal → land on the dashboard → clicks a request → moves it to *In Progress* (optionally setting priority and writing a note) → later marks it *Resolved*.
3. **Anyone** can type a reference number on *Track a request* to see its status.

## Project structure

```
server.js                 entry point (starts the HTTP server)
src/
  config.js               the only file that reads environment variables
  container.js            composition root: creates and wires every object
  domain/                 pure rules, no I/O: categories, statuses & transitions, locations, validation, image checks, errors
  repositories/           persistence: jsonStore (atomic file writes), userRepository, requestRepository
  services/               use cases: authService, requestService, analyticsService, imageStorage, mailer (Brevo/console), emailTemplates
  security/               passwordHasher, tokenService, rateLimiter, secret
  http/                   router, context (body/cookies), guards, static files, app (headers, sessions, errors)
  routes/index.js         every API endpoint in one readable list
public/                   front end: plain ES modules, no build
  js/core/                api client, session, hash router, formatters, toasts, DOM helper
  js/components/          navbar, footer, badges, timeline, form helpers, charts
  js/views/               one file per screen; each registers its own route (staffAuth.js = staff portal sign-in/up)
  css/style.css           design tokens, components, responsive rules
test/                     node:test suites (domain, auth, password reset, requests/admin/analytics)
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
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@muranga.go.ke` / `ChangeMe123` | First staff account, created only if no admin exists. Email must end in `@muranga.go.ke`. **Password is required** in production |
| `STAFF_ACCESS_CODE` | `MURANGA-STAFF` (dev only) | Code new staff enter to create an account. **Required in production**, otherwise staff sign-up is closed |
| `SESSION_SECRET` | auto-generated once | Signs login cookies |
| `SESSION_HOURS` | `8` | Login lifetime |
| `NODE_ENV` | – | `production` turns on Secure cookies and removes the default admin password |
| `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `PUBLIC_URL`, `MAIL_FROM_NAME` | – | Password-reset email via Brevo (see above) |
| `MAX_IMAGE_MB` | `5` | Largest photo |
| `RATE_LIMIT` | `20` | Sign-in/registration/tracking attempts per minute per client |

## Deploying

Run `NODE_ENV=production ADMIN_PASSWORD=<strong> STAFF_ACCESS_CODE=<secret> node server.js` behind an HTTPS reverse proxy (Nginx, Caddy…); keep `DATA_DIR` on persistent storage and back it up. The JSON store holds everything in memory and suits a single server process and thousands of requests; for larger scale, implement the two repositories against a database.

## Testing

`npm test` starts the real server on a random port with a temporary data folder and exercises it over HTTP: registration and login rules, tampered cookies, rate limiting, request validation, photo checks, access control (citizen vs admin vs anonymous), the status workflow, public tracking privacy, filtering/pagination, analytics totals, and CSV safety.

## Admin Dashboard
<img width="808" height="633" alt="image" src="https://github.com/user-attachments/assets/5ad4ffaa-91f6-48c3-b0a0-ba67438a4226" />


## Known limitations

- No email/SMS notifications about request updates (citizens see updates in the app); email is used only for password resets.
- Rate limiting is per process and uses the socket address; behind a proxy, configure the proxy to rate-limit too.
