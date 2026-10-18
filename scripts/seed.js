/**
 * Fills the database with realistic demo data so the admin dashboard has something to show.
 *   npm run seed
 * Safe to re-run: it does nothing if requests already exist.
 */
try { process.loadEnvFile(); } catch { /* optional */ }
const { loadConfig } = require("../src/config");
const { buildApp } = require("../src/container");
const { SUBCOUNTY_WARDS } = require("../src/domain/locations");

const config = loadConfig();
const { services, repositories } = buildApp(config);

if (repositories.requests.all().length) {
  console.log("Requests already exist - nothing to seed.");
  process.exit(0);
}

const DAY = 86_400_000;
const samples = {
  streetlight: ["The streetlight outside the market has been out for two weeks.", "Flickering light on the main road, dangerous for pedestrians at night.", "Three consecutive poles are dark near the school gate."],
  water: ["No water in our estate for four days.", "A burst pipe is leaking clean water onto the road.", "Water pressure is very low every morning."],
  garbage: ["Garbage has not been collected on our street for over a week.", "Overflowing bins near the bus stage are attracting flies.", "Illegal dumping at the open plot by the river."],
  roads: ["Large pothole on the tarmac road, vehicles are swerving.", "Murram road washed away after the rains."],
  drainage: ["The roadside drain is blocked and floods the shops when it rains.", "Sewer is overflowing behind the health centre."],
  other: ["The public notice board at the chief's camp is broken."],
};
const places = ["near the Catholic church", "opposite the primary school", "by the market entrance", "at the bus stage", "next to the dispensary", "on Kenyatta Road"];

// Small deterministic "random" so every seeded database looks the same.
let seed = 42;
const rand = () => { // mulberry32
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(rand() * list.length)];

const citizens = ["Wanjiru Kamau", "Peter Mwangi", "Grace Njeri", "Samuel Kariuki", "Mercy Wambui"].map((name, i) =>
  services.auth.registerCitizen({ name, email: `citizen${i + 1}@example.com`, phone: `07120000${10 + i}`, password: "Password123" })
);

const categories = Object.keys(samples);
const stats = { pending: 0, in_progress: 0, resolved: 0 };

for (let i = 0; i < 42; i++) {
  const citizen = pick(citizens);
  const category = pick(categories);
  const subCounty = pick(Object.keys(SUBCOUNTY_WARDS));
  const ageDays = rand() * 29;
  const createdAt = new Date(Date.now() - ageDays * DAY).toISOString();
  const roll = rand();
  const status = ageDays < 3 ? "pending" : roll < 0.3 ? "pending" : roll < 0.55 ? "in_progress" : "resolved";
  const history = [{ type: "created", at: createdAt, by: citizen.name, status: "pending", note: "" }];
  let resolvedAt = null;

  if (status !== "pending") {
    const startedAt = new Date(Date.parse(createdAt) + (0.3 + rand() * 1.5) * DAY).toISOString();
    history.push({ type: "status", at: startedAt, by: "County Administrator", status: "in_progress", note: "A technician has been assigned." });
    if (status === "resolved") {
      resolvedAt = new Date(Math.min(Date.now(), Date.parse(startedAt) + (0.5 + rand() * 4) * DAY)).toISOString();
      history.push({ type: "status", at: resolvedAt, by: "County Administrator", status: "resolved", note: "Fixed. Thank you for reporting." });
    }
  }
  stats[status]++;
  repositories.requests.create({
    category, subCounty, ward: pick(SUBCOUNTY_WARDS[subCounty]), locationDetail: pick(places), description: pick(samples[category]),
    userId: citizen.id, status, priority: pick(["low", "normal", "normal", "normal", "high", "urgent"]),
    imageFile: null, imageType: null, createdAt, updatedAt: history[history.length - 1].at, resolvedAt, history,
  });
}

console.log(`Seeded ${citizens.length} citizens and 42 requests`, stats);
console.log("Demo citizen login: citizen1@example.com / Password123");
console.log(`Admin login: ${config.adminEmail} / ${config.adminPassword}`);
