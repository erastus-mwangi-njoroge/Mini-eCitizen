// Entry point: `node server.js`
try {
  process.loadEnvFile(); // optional .env file (Node 20.12+); real environment variables still win
} catch {
  /* no .env file, or an older Node: defaults are used */
}
const http = require("http");
const { loadConfig } = require("./src/config");
const { buildApp } = require("./src/container");

const config = loadConfig();
const { handler } = buildApp(config);

http.createServer(handler).listen(config.port, () => {
  console.log(`Murang'a Service Requests running at http://localhost:${config.port}`);
  if (!config.production) console.log(`Admin sign-in: ${config.adminEmail} / ${config.adminPassword}`);
});
