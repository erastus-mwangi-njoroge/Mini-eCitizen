/** County departments a staff member can belong to. Request categories are routed to one of these (see categories.js). */
const DEPARTMENTS = [
  "Roads & Lighting",
  "Water & Sanitation",
  "Environment",
  "Health Services",
  "Education & Social Services",
  "Trade & Licensing",
  "Lands & Physical Planning",
  "Agriculture & Livestock",
  "ICT & Innovation",
  "Public Service & Administration",
];

module.exports = { DEPARTMENTS, isDepartment: (name) => DEPARTMENTS.includes(name) };
