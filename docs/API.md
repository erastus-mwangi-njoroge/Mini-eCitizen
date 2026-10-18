# API reference

JSON over HTTP. There are two independent sessions: the citizen portal uses the `session` cookie and the staff portal uses `staff_session`. Neither grants access to the other's endpoints. Errors look like `{ "error": "message", "fields": { "email": "…" } }` (`fields` only for validation errors).

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/meta` | anyone | Categories, statuses, allowed transitions, priorities, wards, max photo size, staff domain, whether staff sign-up is open |
| `POST /api/auth/register` | anyone | Citizen portal. `{ name, email, phone, password }` → creates a citizen and signs in. `@muranga.go.ke` emails are refused |
| `POST /api/auth/login` | anyone | Citizen portal. `{ email, password }`. Staff accounts are rejected as incorrect |
| `POST /api/auth/logout` | anyone | Ends the session |
| `GET /api/auth/me` | anyone | `{ user }` (citizen) or `{ user: null }` |
| `POST /api/auth/forgot-password` | anyone | `{ email }` — emails a reset link if a citizen account exists; always answers `{ ok: true }` |
| `POST /api/auth/reset-password` | anyone | `{ token, password }` — token from the email (single-use, 30 min), password 8+ chars |
| `POST /api/staff/auth/forgot-password`, `POST /api/staff/auth/reset-password` | anyone | Same for staff accounts (password 10+ chars) |
| `POST /api/staff/auth/register` | anyone | Staff portal. `{ name, email, password, accessCode }` — email must be `@muranga.go.ke`, password 10+ chars |
| `POST /api/staff/auth/login` | anyone | Staff portal. `{ email, password }` — only `@muranga.go.ke` accounts; citizen accounts are rejected |
| `POST /api/staff/auth/logout`, `GET /api/staff/auth/me` | anyone | End the staff session / read it |
| `GET /api/track/:ref` | anyone | Public status + progress for a reference number (no personal data) |
| `POST /api/requests` | citizen | `{ category, subCounty, ward, locationDetail, description, image? }` — `image` is a PNG/JPEG/WebP data URL |
| `GET /api/requests` | citizen | The caller's own requests |
| `GET /api/requests/:id` | owning citizen | One request with full timeline |
| `GET /api/requests/:id/image` | owning citizen | The photo |
| `GET /api/admin/requests/:id` and `/image` | staff | Any request with full timeline and reporter details / its photo |
| `GET /api/admin/requests` | staff | Query: `status` (`open`, `pending`, `in_progress`, `resolved`), `category`, `ward`, `priority`, `q`, `sort` (`newest`, `oldest`, `priority`), `page`, `pageSize` |
| `PATCH /api/admin/requests/:id` | staff | `{ status?, priority?, note? }` — status must follow the workflow |
| `GET /api/admin/analytics` | staff | Totals, resolution rate, average resolution time, by category/ward, last 14 days |
| `GET /api/admin/export.csv` | staff | CSV of requests (same filters as the list) |

Status workflow: `pending → in_progress → resolved`, and `resolved → in_progress` (re-open).
