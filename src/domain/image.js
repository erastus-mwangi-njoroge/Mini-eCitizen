/**
 * Image handling for the optional photo on a request.
 * We never trust the browser's claimed type: the type is read from the file's own first bytes ("magic numbers").
 */
const { badRequest } = require("./errors");

const SIGNATURES = [
  { type: "image/png", ext: "png", test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", ext: "jpg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", ext: "webp", test: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
];

/**
 * Turn a "data:image/...;base64,...." string into a verified { buffer, type, ext }.
 * @throws {AppError} 400 when it is not a PNG/JPEG/WebP or exceeds maxBytes
 */
function decodeImage(dataUrl, maxBytes) {
  const match = /^data:[\w/+.-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw badRequest("The photo could not be read.", { image: "Please choose a PNG, JPG or WebP photo." });
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length > maxBytes) {
    throw badRequest("The photo is too large.", { image: `Photos must be under ${Math.round(maxBytes / 1048576)} MB.` });
  }
  const kind = SIGNATURES.find((s) => s.test(buffer));
  if (!kind) throw badRequest("Unsupported photo type.", { image: "Please choose a PNG, JPG or WebP photo." });
  return { buffer, type: kind.type, ext: kind.ext };
}

module.exports = { decodeImage };
