/** Staff are identified by their county email domain. Citizens may never use it, and staff must. */
const STAFF_DOMAIN = "muranga.go.ke";

const isStaffEmail = (email) => String(email).toLowerCase().endsWith("@" + STAFF_DOMAIN);

module.exports = { STAFF_DOMAIN, isStaffEmail };
