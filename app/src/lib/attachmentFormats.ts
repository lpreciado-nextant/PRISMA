import type { AssetPurpose } from "./assetPurpose.ts";

/**
 * What the Media step accepts in each section and how it reaches viewers. It mirrors the upload contract
 * (`mediaContract.ts`): MP4 and WebM video up to 500 MB, HTML, PDF, PPT and PPTX up to 25 MB. Word and Excel are not accepted.
 */
export type FormatInfo = { label: string; how: string };

const VIDEO: FormatInfo = { label: "Video", how: "Plays in PRISMA's video viewer." };
const FORMATS: Record<string, FormatInfo> = {
  mp4: { label: "MP4 video", how: VIDEO.how }, webm: { label: "WebM video", how: VIDEO.how },
  html: { label: "HTML", how: "Opens inside PRISMA, in a secure sandbox." }, htm: { label: "HTML", how: "Opens inside PRISMA, in a secure sandbox." },
  pdf: { label: "PDF", how: "Downloaded, not previewed in PRISMA." },
  ppt: { label: "PowerPoint", how: "Downloaded, not previewed in PRISMA." }, pptx: { label: "PowerPoint", how: "Downloaded, not previewed in PRISMA." },
};
const MIME_EXTENSION: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "text/html": "html", "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx" };

export const SECTION_EXTENSIONS: Record<AssetPurpose, string[]> = {
  "Demo video": ["mp4", "webm"], "Interactive demo": ["html", "htm"], "Supporting material": ["pdf", "ppt", "pptx", "mp4", "webm"],
};
const SECTION_NAME: Record<AssetPurpose, string> = { "Demo video": "Demo videos", "Interactive demo": "Interactive demo", "Supporting material": "Supporting material" };
const SECTION_FORMATS: Record<AssetPurpose, string> = { "Demo video": "MP4 or WebM", "Interactive demo": "HTML (.html)", "Supporting material": "PDF, PowerPoint (.ppt, .pptx) or video (MP4, WebM)" };

export const extensionOf = (name: string) => name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : "";
export const formatOfMime = (mime: string): FormatInfo | undefined => FORMATS[MIME_EXTENSION[mime] ?? ""];

export function formatBytes(value: number): string {
  return value < 1024 ? `${value} B` : value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export type FileCheck = { ok: true; extension: string; info: FormatInfo; size: string } | { ok: false; message: string };

/** Checks a chosen file against the section it was added to, with a message that says what to do instead. */
export function checkAttachment(file: { name: string; size: number }, purpose: AssetPurpose): FileCheck {
  const extension = extensionOf(file.name);
  const shown = extension ? `.${extension}` : "This file";
  const accepted = `${SECTION_NAME[purpose]} accepts ${SECTION_FORMATS[purpose]}.`;
  if (["doc", "docx", "docm", "dot", "dotx"].includes(extension)) return { ok: false, message: `Word files can't be uploaded. Save it as a PDF, or share a link to it (SharePoint, OneDrive). ${accepted}` };
  if (["xls", "xlsx", "xlsm", "xlsb", "csv"].includes(extension)) return { ok: false, message: `Excel files can't be uploaded. Save the relevant sheet as a PDF, or share a link to it (SharePoint, OneDrive). ${accepted}` };
  if (["tsx", "jsx", "ts", "js", "zip", "fig", "make", "json", "css"].includes(extension)) return { ok: false, message: `${shown} projects can't be uploaded as they are. Export or build them into one self-contained HTML file for Interactive demo, or host them and add a link.` };
  if (!FORMATS[extension]) return { ok: false, message: `${shown} isn't supported. ${accepted}` };
  if (!SECTION_EXTENSIONS[purpose].includes(extension)) {
    const where = ["html", "htm"].includes(extension) ? "Interactive demo" : ["mp4", "webm"].includes(extension) ? "Demo videos (or Supporting material if it is not a demo)" : "Supporting material";
    return { ok: false, message: `${FORMATS[extension].label} files belong in ${where}. ${accepted}` };
  }
  const video = extension === "mp4" || extension === "webm";
  if (file.size <= 0) return { ok: false, message: "This file is empty." };
  if (file.size > (video ? 500 : 25) * 1024 * 1024) return { ok: false, message: `This file is ${formatBytes(file.size)}; the limit is ${video ? "500" : "25"} MB for ${video ? "videos" : "this format"}.` };
  return { ok: true, extension, info: FORMATS[extension], size: formatBytes(file.size) };
}
