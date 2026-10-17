const fs = require("fs");
const path = require("path");

/** Stores request photos on disk, one file per request. Swap this class to use cloud storage instead. */
class ImageStorage {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
  }

  /** @returns {string} the stored file name */
  save(requestId, buffer, ext) {
    const name = `${requestId}.${ext}`;
    fs.writeFileSync(path.join(this.dir, name), buffer);
    return name;
  }

  read(name) {
    return fs.readFileSync(path.join(this.dir, path.basename(name)));
  }
}

module.exports = { ImageStorage };
