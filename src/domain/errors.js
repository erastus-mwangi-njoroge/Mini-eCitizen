/**
 * Application errors carry an HTTP status so the HTTP layer can turn any
 * thrown error into a clean JSON response without knowing the business rules.
 */
class AppError extends Error {
  /**
   * @param {number} status   HTTP status code
   * @param {string} message  Safe, human-readable message
   * @param {object} [fields] Per-field validation messages, e.g. { email: "Required" }
   */
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

module.exports = {
  AppError,
  badRequest: (message, fields) => new AppError(400, message, fields),
  unauthorized: (message = "Please sign in to continue.") => new AppError(401, message),
  forbidden: (message = "You do not have access to that.") => new AppError(403, message),
  notFound: (message = "Not found.") => new AppError(404, message),
  conflict: (message, fields) => new AppError(409, message, fields),
  tooManyRequests: () => new AppError(429, "Too many attempts. Please wait a minute and try again."),
};
