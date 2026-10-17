# API reference

JSON over HTTP. Authentication is a `session` HttpOnly cookie set by login/register. Errors look like `{ "error": "message", "fields": { "email": "…" } }` (`fields` only for validation errors).

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/meta` | anyone | Categories, statuses, allowed transitions, priorities, wards, max photo size |
| `POST /api/auth/register` | anyone | `{ name, email, phone, password }` → creates a citizen and signs in |
| `POST /api/auth/login` | anyone | `{ email, password }` |
| `POST /api/auth/logout` | anyone | Ends the session |
| `GET /api/auth/me` | anyone | `{ user }` or `{ user: null }` |
| `GET /api/track/:ref` | anyone | Public status + progress for a reference number (no personal data) |
| `POST /api/requests` | citizen | `{ category, subCounty, ward, locationDetail, description, image? }` — `image` is a PNG/JPEG/WebP data URL |
| `GET /api/requests` | signed in | The caller's own requests |
| `GET /api/requests/:id` | owner or admin | One request with full timeline |
| `GET /api/requests/:id/image` | owner or admin | The photo |
| `GET /api/admin/requests` | admin | Query: `status` (`open`, `pending`, `in_progress`, `resolved`), `category`, `ward`, `priority`, `q`, `sort` (`newest`, `oldest`, `priority`), `page`, `pageSize` |
| `PATCH /api/admin/requests/:id` | admin | `{ status?, priority?, note? }` — status must follow the workflow |
| `GET /api/admin/analytics` | admin | Totals, resolution rate, average resolution time, by category/ward, last 14 days |
| `GET /api/admin/export.csv` | admin | CSV of requests (same filters as the list) |

Status workflow: `pending → in_progress → resolved`, and `resolved → in_progress` (re-open).
