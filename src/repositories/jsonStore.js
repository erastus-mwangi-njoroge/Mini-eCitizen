const fs = require("fs");
const path = require("path");

/**
 * A tiny file-backed database: the whole dataset is held in memory and written back atomically
 * (write a temp file, then rename) after every change. Perfect for a demo-sized app; to scale up,
 * replace the repositories with ones backed by a real database and nothing else needs to change.
 */
class JsonStore {
  constructor(file, defaults) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      this.data = { ...defaults, ...JSON.parse(fs.readFileSync(file, "utf8")) };
    } catch {
      this.data = structuredClone(defaults);
    }
  }

  save() {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { JsonStore };
