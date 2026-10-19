/** The kinds of problem a citizen can report. Add an entry here to add a category everywhere. */
const CATEGORIES = [
  { id: "streetlight", label: "Broken streetlight", icon: "💡", department: "Roads & Lighting" },
  { id: "water", label: "Water supply issue", icon: "💧", department: "Water & Sanitation" },
  { id: "garbage", label: "Garbage collection", icon: "🗑️", department: "Environment" },
  { id: "roads", label: "Pothole / damaged road", icon: "🚧", department: "Roads & Lighting" },
  { id: "drainage", label: "Blocked drain / sewer", icon: "🚰", department: "Water & Sanitation" },
  { id: "other", label: "Other", icon: "📋", department: "Public Service & Administration" },
];

const categoryIds = () => CATEGORIES.map((c) => c.id);
const findCategory = (id) => CATEGORIES.find((c) => c.id === id);

module.exports = { CATEGORIES, categoryIds, findCategory };
