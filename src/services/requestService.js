const { validateNewRequest, validateAdminUpdate } = require("../domain/validation");
const { findCategory } = require("../domain/categories");
const { canTransition, isOpen } = require("../domain/statuses");
const { decodeImage } = require("../domain/image");
const { badRequest, forbidden, notFound } = require("../domain/errors");

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
const MAX_PAGE_SIZE = 100;

/**
 * Use cases for service requests: submit, view, track, and (for admins) triage and update.
 * Rules about who may do what live here, so the HTTP routes stay thin.
 */
class RequestService {
  /**
   * @param {RequestRepository} requests
   * @param {UserRepository} users
   * @param {ImageStorage} images
   * @param {{ maxImageBytes: number }} options
   */
  constructor(requests, users, images, { maxImageBytes }) {
    this.requests = requests;
    this.users = users;
    this.images = images;
    this.maxImageBytes = maxImageBytes;
  }

  // ---- Citizen use cases -------------------------------------------------

  submit(user, input) {
    const data = validateNewRequest(input);
    const photo = data.image ? decodeImage(data.image, this.maxImageBytes) : null;
    const { image, ...fields } = data;

    const request = this.requests.create({
      ...fields,
      userId: user.id,
      status: "pending",
      priority: "normal",
      imageFile: null,
      imageType: null,
      history: [{ type: "created", at: new Date().toISOString(), by: user.name, status: "pending", note: "" }],
    });
    if (photo) {
      request.imageFile = this.images.save(request.id, photo.buffer, photo.ext);
      request.imageType = photo.type;
      this.requests.save();
    }
    return this.#toView(request);
  }

  listMine(user) {
    return this.requests
      .all()
      .filter((r) => r.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => this.#toView(r));
  }

  /** A citizen may open only their own requests; admins may open any. */
  get(user, id) {
    return this.#toView(this.#ownedOrAdmin(user, id), user.role === "admin");
  }

  image(user, id) {
    const request = this.#ownedOrAdmin(user, id);
    if (!request.imageFile) throw notFound("This request has no photo.");
    return { body: this.images.read(request.imageFile), type: request.imageType };
  }

  /** Public lookup by reference number: status only, no personal or location detail. */
  track(ref) {
    const request = this.requests.findByRef(String(ref).trim().toUpperCase());
    if (!request) throw notFound("No request found with that reference number.");
    return {
      ref: request.ref,
      category: request.category,
      categoryLabel: findCategory(request.category).label,
      subCounty: request.subCounty,
      ward: request.ward,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      history: request.history.filter((e) => e.type !== "note").map(({ type, at, status }) => ({ type, at, status })),
    };
  }

  // ---- Admin use cases ---------------------------------------------------

  /**
   * Filtered, sorted, paginated list for the dashboard.
   * @param {{status?, category?, ward?, priority?, q?, sort?, page?, pageSize?}} filters
   */
  list(filters = {}) {
    const rows = this.#filter(filters);
    const pageSize = Math.min(Math.max(Number(filters.pageSize) || 10, 1), MAX_PAGE_SIZE);
    const pages = Math.max(Math.ceil(rows.length / pageSize), 1);
    const page = Math.min(Math.max(Number(filters.page) || 1, 1), pages);
    const items = rows.slice((page - 1) * pageSize, page * pageSize).map((r) => this.#toView(r, true));
    return { items, total: rows.length, page, pageSize, pages };
  }

  /** Move a request along its lifecycle and/or change its priority; the optional note is shown to the citizen. */
  update(admin, id, input) {
    const { status, priority, note } = validateAdminUpdate(input);
    const request = this.requests.findById(id);
    if (!request) throw notFound("Request not found.");
    const now = new Date().toISOString();
    const events = [];

    if (status && status !== request.status) {
      if (!canTransition(request.status, status)) {
        throw badRequest(`A ${request.status.replace("_", " ")} request cannot move to ${status.replace("_", " ")}.`, { status: "That change is not allowed." });
      }
      request.status = status;
      request.resolvedAt = status === "resolved" ? now : null;
      events.push({ type: "status", status });
    } else if (status) {
      throw badRequest("The request already has that status.", { status: "Already set." });
    }
    if (priority && priority !== request.priority) {
      request.priority = priority;
      events.push({ type: "priority", priority });
    }
    // A note rides on the first event, or stands alone as a plain update.
    if (!events.length) events.push({ type: "note" });
    events[0].note = note;
    for (const event of events) request.history.push({ at: now, by: admin.name, status: request.status, note: "", ...event });

    request.updatedAt = now;
    this.requests.save();
    return this.#toView(request, true);
  }

  /** Every request matching the filters as CSV text (spreadsheet-safe). */
  exportCsv(filters = {}) {
    const header = ["Reference", "Category", "Status", "Priority", "Sub-county", "Ward", "Location detail", "Description", "Citizen", "Phone", "Submitted", "Resolved"];
    const lines = this.#filter(filters).map((r) => {
      const owner = this.users.findById(r.userId);
      return [r.ref, findCategory(r.category).label, r.status, r.priority, r.subCounty, r.ward, r.locationDetail, r.description,
        owner ? owner.name : "", owner ? owner.phone : "", r.createdAt, r.resolvedAt || ""];
    });
    return [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }

  // ---- Helpers -----------------------------------------------------------

  #ownedOrAdmin(user, id) {
    const request = this.requests.findById(id);
    if (!request) throw notFound("Request not found.");
    if (user.role !== "admin" && request.userId !== user.id) throw forbidden();
    return request;
  }

  #filter({ status, category, ward, department, priority, q, sort } = {}) {
    const needle = (q || "").trim().toLowerCase();
    const matches = (r) => {
      if (status === "open" ? !isOpen(r.status) : status && r.status !== status) return false;
      if (category && r.category !== category) return false;
      if (ward && r.ward !== ward) return false;
      if (department && (findCategory(r.category) || {}).department !== department) return false;
      if (priority && r.priority !== priority) return false;
      if (!needle) return true;
      const owner = this.users.findById(r.userId);
      return [r.ref, r.description, r.locationDetail, r.ward, owner && owner.name].some((v) => v && String(v).toLowerCase().includes(needle));
    };
    const order = {
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt),
    }[sort] || ((a, b) => b.createdAt.localeCompare(a.createdAt));
    return this.requests.all().filter(matches).sort(order);
  }

  /** Shape sent to the browser. Admin views also include who reported it. */
  #toView(r, forAdmin = false) {
    const { imageFile, imageType, userId, ...rest } = r;
    const view = { ...rest, categoryLabel: findCategory(r.category).label, hasImage: Boolean(imageFile) };
    if (forAdmin) {
      const owner = this.users.findById(userId);
      view.citizen = owner ? { name: owner.name, phone: owner.phone, email: owner.email } : null;
    }
    return view;
  }
}

/** Quote a CSV cell and neutralise spreadsheet formulas (=, +, -, @ at the start). */
function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

module.exports = { RequestService };
