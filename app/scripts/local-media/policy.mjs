export const BLOCK_SIZE = 4 * 1024 * 1024;
export const RANGE_SIZE = 1024 * 1024;
export const MAX_SIZE = 500 * 1024 * 1024;
export const SESSION_TTL = 2 * 60 * 60 * 1000;
export const ACTORS = new Set(["builder", "other-builder", "reader", "librarian"]);

export class MediaError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function requireValue(condition, status, message) {
  if (!condition) throw new MediaError(status, message);
}

export function assertActor(actor) {
  requireValue(ACTORS.has(actor), 401, "Choose a local test identity.");
}

export function assertVersion(draft, version) {
  requireValue(String(draft.version) === version, 409, "Version changed. Reopen before continuing.");
}

export function assertEditable(draft, actor, version) {
  assertActor(actor);
  requireValue(draft.owner === actor && draft.status === "draft", 403, "Only the owner can edit a draft.");
  assertVersion(draft, version);
}

export function assertRead(draft, actor, mode) {
  assertActor(actor);
  if (mode === "submission") {
    requireValue(draft.owner === actor || actor === "librarian", 403, "Submission access denied.");
  } else if (mode === "published" || mode === "present") {
    requireValue(draft.status === "published", 403, "Published media is unavailable.");
    requireValue(mode !== "present" || draft.safe === true, 403, "Media is not cleared for present mode.");
  } else throw new MediaError(400, "Invalid playback mode.");
}

export function fileType(name) {
  requireValue(typeof name === "string" && name.length <= 180 && name.trim() === name && !/[\\/]/.test(name)
    && [...name].every(character => character.charCodeAt(0) >= 32), 400, "Choose a file with a valid filename.");
  const types = {
    mp4: "video/mp4", html: "text/html", htm: "text/html", pdf: "application/pdf",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  const extension = name.split(".").at(-1).toLowerCase();
  requireValue(name.includes(".") && Object.hasOwn(types, extension), 400, "Choose MP4, HTML, PDF, PPT or PPTX.");
  return { mime: types[extension], maxSize: extension === "mp4" ? MAX_SIZE : 25 * 1024 * 1024, minSize: extension === "mp4" ? 12 : 1 };
}

export function validateFile({ name, size, sha256 }) {
  const type = fileType(name);
  requireValue(Number.isSafeInteger(size) && size >= type.minSize && size <= type.maxSize, 400, "File size exceeds its type limit (25 MiB documents/HTML, 500 MiB MP4).");
  requireValue(typeof sha256 === "string" && sha256.length === 64 && /^[a-f0-9]{64}$/.test(sha256), 400, "A lowercase SHA-256 digest is required.");
  return type;
}

export function validateHeader(mime, header) {
  const valid = mime === "video/mp4" ? header.subarray(4, 8).toString("ascii") === "ftyp"
    : mime === "application/pdf" ? header.subarray(0, 5).toString("ascii") === "%PDF-"
    : mime === "application/vnd.ms-powerpoint" ? header.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))
    : mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ? header.subarray(0, 4).equals(Buffer.from("504b0304", "hex"))
    : mime === "text/html";
  requireValue(valid, 400, "File header does not match its declared type. This is not format or malware certification.");
}

export function assertSession(session, now) {
  requireValue(session && !session.complete && session.expires > now, 409, "Upload is missing, complete or expired. Remove it before restarting.");
}

export function assertResume(session, file, now) {
  assertSession(session, now);
  validateFile(file);
  requireValue(["name", "size", "sha256"].every(key => session[key] === file[key]), 409, "Select the exact file originally uploaded.");
}

export function rangeLength(offset, count, size) {
  requireValue(Number.isSafeInteger(offset) && offset >= 0 && offset < size && Number.isSafeInteger(count) && count > 0 && count <= RANGE_SIZE, 416, "Invalid bounded range.");
  return Math.min(count, size - offset);
}