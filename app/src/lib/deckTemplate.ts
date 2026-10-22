import JSZip from "jszip";
import type { DeckVariant } from "./deckFields";

/**
 * Fills a PRISMA × Nextant presentation template (.potx) in the browser. A port of
 * tools/pptx-template/kit/fill_prisma_template.py — keep the two in step. Shapes are found by name
 * (`<p:cNvPr name>`), text by `{{token}}`; unused slots are removed rather than left empty.
 */

export interface DeckImage { bytes: Uint8Array; width: number; height: number; ext: "png" | "jpeg" }

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
};
const REL_IMAGE = `${NS.r}/image`;
const REL_LINK = `${NS.r}/hyperlink`;
const EMU_IN = 914400;
const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

const PALETTES: Record<DeckVariant, Record<string, string>> = {
  dark: { ai: "7FB6D9", data: "4FBFAB", ibo: "A99AE6", live: "5FD3A2", proto: "E0B860", idea: "9BB0BF" },
  light: { ai: "1C567C", data: "0B604C", ibo: "57468C", live: "0B6145", proto: "7C5408", idea: "5B6B77" },
};
const AREA_KEY: Record<string, string> = { "ai & automation": "ai", "data solutions": "data", "intelligent business operations": "ibo" };
const MATURITY_KEY: Record<string, string> = { live: "live", "working prototype": "proto", "idea / concept": "idea" };
const ROW_KINDS: Record<string, number> = { video: 3, interactive: 2, supporting: 3 };

type Fields = Record<string, string>;

function toUrl(value: string): string {
  if (/^(https?:|mailto:)/i.test(value)) return value;
  return value.includes("@") ? `mailto:${value}` : `https://${value}`;
}

function safeName(name: string): string { return name.replace(/[^\w.-]/g, "_"); }

function shapeName(el: Element): string {
  return el.getElementsByTagNameNS(NS.p, "cNvPr")[0]?.getAttribute("name") ?? "";
}

/** Top-level shapes of the slide tree, keyed by name (p:sp, p:pic, p:grpSp, p:cxnSp). */
function namedShapes(doc: Document): Map<string, Element> {
  const tree = doc.getElementsByTagNameNS(NS.p, "spTree")[0];
  const map = new Map<string, Element>();
  for (const child of Array.from(tree.children)) {
    if (!["sp", "pic", "grpSp", "cxnSp"].includes(child.localName)) continue;
    const name = shapeName(child);
    if (name) map.set(name, child);
  }
  return map;
}

function remove(el: Element | undefined): void { el?.parentNode?.removeChild(el); }

/** The shape's own position and size. Not the first `a:ext` in it: PowerPoint puts `a:extLst/a:ext` in `cNvPr` first. */
function shapeXfrm(shape: Element): Element | undefined {
  return shape.getElementsByTagNameNS(NS.a, "xfrm")[0];
}

function recolour(shape: Element, hex: string, where: { fills?: boolean; text?: boolean }): void {
  for (const clr of Array.from(shape.getElementsByTagNameNS(NS.a, "srgbClr"))) {
    const holder = clr.parentElement?.parentElement?.localName; // solidFill -> spPr | ln | rPr | defRPr
    if ((where.fills && (holder === "spPr" || holder === "ln")) || (where.text && (holder === "rPr" || holder === "defRPr"))) clr.setAttribute("val", hex);
  }
}

/** `dropEmpty`: a paragraph whose tokens all resolve to nothing is removed (speaker notes list optional demos line by line). */
function fillParagraphs(root: Element, fields: Fields, dropEmpty = false): void {
  for (const para of Array.from(root.getElementsByTagNameNS(NS.a, "p"))) {
    const runs = Array.from(para.getElementsByTagNameNS(NS.a, "r"));
    const text = runs.map((run) => run.getElementsByTagNameNS(NS.a, "t")[0]?.textContent ?? "").join("");
    if (!runs.length || !/\{\{/.test(text)) continue;
    // A text body needs one paragraph: the last one empties instead of going.
    if (dropEmpty && Array.from(text.matchAll(TOKEN)).every(([, key]) => !fields[key]) && para.parentElement?.getElementsByTagNameNS(NS.a, "p").length !== 1) { remove(para); continue; }
    let out = text.replace(TOKEN, (_, key: string) => fields[key] ?? "");
    out = out.replace(/\s*[·•|\-–—]\s*$/, "").trim(); // an empty trailing field must not leave a dangling separator
    runs[0].getElementsByTagNameNS(NS.a, "t")[0].textContent = out;
    runs.slice(1).forEach(remove);
  }
}

/** Lines a text needs at `size` pt in a box `width` pt wide; a word longer than a line wraps on its own. */
export function estimateLines(text: string, width: number, size: number, bold: boolean, display = false): number {
  // Average glyph widths in em, measured on exported slides with a margin: Aptos Display bold (titles), Aptos bold, Aptos.
  // Capitals are about a third wider than lower case, so an all-caps name ("PRISMA APP") is not undercounted.
  const perLine = Math.max(1, width / (size * (display ? 0.44 : bold ? 0.5 : 0.48)));
  const length = (word: string) => word.length + 0.35 * (word.match(/[A-Z]/g)?.length ?? 0);
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    let used = 0;
    lines += 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (used && used + 1 + length(word) > perLine) { lines += 1; used = 0; }
      used += (used ? 1 : 0) + length(word);
      while (used > perLine) { lines += 1; used -= perLine; }
    }
  }
  return lines;
}

/**
 * Fixed boxes do not push their neighbours: a long title would run into the tagline below it. Shrinks the filled
 * text until the estimate fits the box, down to 60% of the template size. PowerPoint's own autofit only runs on edit.
 */
function fitText(shape: Element, floor = 0.6): { size: number; lines: number } | undefined {
  const runs = Array.from(shape.getElementsByTagNameNS(NS.a, "rPr"));
  const base = Number(runs[0]?.getAttribute("sz"));
  const box = shapeXfrm(shape)?.getElementsByTagNameNS(NS.a, "ext")[0];
  if (!base || !box) return;
  const width = Number(box.getAttribute("cx")) / 12700, height = Number(box.getAttribute("cy")) / 12700; // EMU -> pt
  const text = Array.from(shape.getElementsByTagNameNS(NS.a, "p")).map((para) => para.textContent ?? "").join("\n");
  const bold = runs[0].getAttribute("b") === "1", display = isDisplay(runs[0]);
  let size = base / 100;
  while (size > (base / 100) * floor && estimateLines(text, width, size, bold, display) * size * 1.2 > height) size -= 2;
  if (size !== base / 100) setSize(shape, size);
  return { size, lines: estimateLines(text, width, size, bold, display) };
}

/** True for a run set in the display face (Aptos Display), which is narrower than the text face. */
function isDisplay(rPr: Element | undefined): boolean {
  return /display/i.test(rPr?.getElementsByTagNameNS(NS.a, "latin")[0]?.getAttribute("typeface") ?? "");
}

/** Lines the shape's text needs at `pt` points in its own box width. */
function linesAt(shape: Element, pt: number): number {
  const width = Number(shapeXfrm(shape)?.getElementsByTagNameNS(NS.a, "ext")[0]?.getAttribute("cx")) / 12700;
  const text = Array.from(shape.getElementsByTagNameNS(NS.a, "p")).map((para) => para.textContent ?? "").join("\n");
  const rPr = shape.getElementsByTagNameNS(NS.a, "rPr")[0];
  return estimateLines(text, width, pt, rPr?.getAttribute("b") === "1", isDisplay(rPr));
}

function setSize(shape: Element, pt: number): void {
  for (const tag of ["rPr", "endParaRPr"]) for (const el of Array.from(shape.getElementsByTagNameNS(NS.a, tag))) el.setAttribute("sz", String(Math.round(pt * 100)));
}

function relsDoc(zip: JSZip, path: string): Promise<Document> {
  return zip.file(path)!.async("string").then((xml) => new DOMParser().parseFromString(xml, "application/xml"));
}

function addRel(rels: Document, type: string, target: string, external = false): string {
  const root = rels.documentElement;
  const ids = Array.from(root.children).map((rel) => Number(/\d+/.exec(rel.getAttribute("Id") ?? "")?.[0] ?? 0));
  const id = `rId${Math.max(0, ...ids) + 1}`;
  const rel = rels.createElementNS(NS.rel, "Relationship");
  rel.setAttribute("Id", id); rel.setAttribute("Type", type); rel.setAttribute("Target", target);
  if (external) rel.setAttribute("TargetMode", "External");
  root.appendChild(rel);
  return id;
}

/** Adds `link` to `holder` in schema order: before any `a:extLst`, replacing a link already there. */
function setLink(holder: Element, link: Element): void {
  for (const old of Array.from(holder.children).filter((child) => child.localName === "hlinkClick")) remove(old);
  holder.insertBefore(link, Array.from(holder.children).find((child) => ["hlinkMouseOver", "hlinkHover", "rtl", "extLst"].includes(child.localName)) ?? null);
}

function hlinkClick(doc: Document, rId: string): Element {
  const el = doc.createElementNS(NS.a, "a:hlinkClick");
  el.setAttributeNS(NS.r, "r:id", rId);
  return el;
}

function linkShape(doc: Document, rels: Document, shape: Element | undefined, url: string): void {
  const cNvPr = shape?.getElementsByTagNameNS(NS.p, "cNvPr")[0];
  if (!cNvPr || !url) return;
  setLink(cNvPr, hlinkClick(doc, addRel(rels, REL_LINK, toUrl(url), true)));
}

function linkFirstRun(doc: Document, rels: Document, shape: Element | undefined, url: string): void {
  const rPr = shape?.getElementsByTagNameNS(NS.a, "r")[0]?.getElementsByTagNameNS(NS.a, "rPr")[0];
  if (!rPr || !url) return;
  setLink(rPr, hlinkClick(doc, addRel(rels, REL_LINK, toUrl(url), true)));
}

function xfrm(shape: Element): { x: number; y: number; w: number; h: number; off: Element; ext: Element } {
  const box = shapeXfrm(shape)!;
  const off = box.getElementsByTagNameNS(NS.a, "off")[0];
  const ext = box.getElementsByTagNameNS(NS.a, "ext")[0];
  return { x: +off.getAttribute("x")!, y: +off.getAttribute("y")!, w: +ext.getAttribute("cx")!, h: +ext.getAttribute("cy")!, off, ext };
}

/** A picture that covers the frame's box (centred crop) with the glass frame's rounded corners. */
function pictureFor(doc: Document, frame: Element, rId: string, image: DeckImage, id: number): Element {
  const { x, y, w, h } = xfrm(frame);
  const box = w / h, img = image.width / image.height;
  let l = 0, t = 0;
  if (img > box) l = (1 - box / img) / 2; else t = (1 - img / box) / 2;
  const pct = (v: number) => Math.round(v * 100000);
  const xml = `<p:pic xmlns:p="${NS.p}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><p:nvPicPr><p:cNvPr id="${id}" name="${shapeName(frame).replace("img_", "picture_")}" descr=""/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/><a:srcRect l="${pct(l)}" r="${pct(l)}" t="${pct(t)}" b="${pct(t)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 6000"/></a:avLst></a:prstGeom></p:spPr></p:pic>`;
  return doc.importNode(new DOMParser().parseFromString(xml, "application/xml").documentElement, true);
}

// ---- Adaptive layout ---------------------------------------------------------------------------------------------
// The templates are drawn for one solution. Real ones vary (a short name or a long one, one screenshot or six, one
// technology or eight, a demo or seven), so these steps fit the slides to the content. Measurements are in inches.

type Box = { x?: number; y?: number; w?: number; h?: number };
function place(shape: Element | undefined, box: Box): void {
  if (!shape?.parentNode) return;
  const b = xfrm(shape), emu = (v: number) => String(Math.round(v * EMU_IN));
  if (box.x !== undefined) b.off.setAttribute("x", emu(box.x));
  if (box.y !== undefined) b.off.setAttribute("y", emu(box.y));
  if (box.w !== undefined) b.ext.setAttribute("cx", emu(box.w));
  if (box.h !== undefined) b.ext.setAttribute("cy", emu(box.h));
}
const inches = (shape: Element) => { const b = xfrm(shape); return { x: b.x / EMU_IN, y: b.y / EMU_IN, w: b.w / EMU_IN, h: b.h / EMU_IN }; };
const textOf = (shape: Element | undefined) => (shape?.textContent ?? "").trim();
/** Height of `lines` lines at `pt` points, in inches; `spacing` is the paragraph's line spacing (1.2 = single). */
const linesHeight = (lines: number, pt: number, spacing = 1.2) => (lines * pt * spacing) / 72;
/** Width of a short label in the templates' mono font, in inches (`spaced`: the badges' wider letter spacing). */
const monoWidth = (text: string, pt: number, spaced = false) => text.length * pt * (spaced ? 0.0112 : 0.0084);
/** Width of a one-line label in the text font, in inches, with estimateLines' glyph widths. */
const textWidth = (text: string, pt: number, bold: boolean) => (text.length * pt * (bold ? 0.5 : 0.48)) / 72;
/** A one-line label: never wraps, whatever the width estimate. */
function noWrap(shape: Element | undefined): void { shape?.getElementsByTagNameNS(NS.a, "bodyPr")[0]?.setAttribute("wrap", "none"); }

const COVER_TITLE_Y = 2.02;
const DEMO_PARTS = ["icon", "play", "title", "btn_text", "rule"];

/** Sizes set before the text is filled, so fitting starts from them and only shrinks what really overflows. */
function presetSlide(named: Map<string, Element>): void {
  if (named.has("badge_area_text")) { // the cover's only title is "Text 1": two lines at most; a long name shrinks
    const title = named.get("Text 1");
    place(title, { y: COVER_TITLE_Y, h: linesHeight(2, 48) + 0.02 });
    if (title) setSize(title, 48);
    for (const name of ["badge_area_text", "badge_maturity_text"]) noWrap(named.get(name));
  }
  // Text boxes taller than the design's, so fitting measures the text rather than the drawn box.
  place(named.get("description"), { h: 2.4 });
  place(named.get("business_value"), { h: 1.0 });
  for (const [name, h] of [["overview_value", 1.0], ["capability_value", 0.8], ["industry_value", 1.2], ["client_value", 1.2]] as const) place(named.get(name), { h });
  for (let i = 1; i <= 8; i++) { noWrap(named.get(`tech_${i}`)); place(named.get(`tech_${i}`), { w: 5.6 }); }
}

/**
 * Slide 5 lists demos in sections (demo videos, interactive demos, supporting material). Few rows share one column at
 * the design's spacing; when they do not fit, each section takes its own column. Unused rows and empty sections go.
 */
function layoutDemos(named: Map<string, Element>, fields: Fields): void {
  const TOP = 2.4, LAST_RULE = 6.0, LABEL = 0.62, SECTION_GAP = 0.3, LEFT = 0.7, WIDTH = 11.93, COLUMN_GAP = 0.45;
  const sections = Object.entries(ROW_KINDS).map(([kind, max]) => {
    const rows = Array.from({ length: max }, (_, i) => i + 1).filter((n) => fields[`${kind}_${n}_title`]);
    for (let n = 1; n <= max; n++) if (!rows.includes(n)) for (const part of DEMO_PARTS) remove(named.get(`row_${kind}_${n}_${part}`));
    if (!rows.length) remove(named.get(`${kind}_label`));
    return { kind, rows };
  }).filter((section) => section.rows.length);
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  if (!total) { // nothing to open: the note invites a live walkthrough instead
    const note = named.get("demo_note")?.getElementsByTagNameNS(NS.a, "t")[0];
    if (note) note.textContent = "Ask your Nextant contact for a live walkthrough of this solution.";
    place(named.get("demo_note"), { y: TOP });
    return;
  }
  const space = LAST_RULE - TOP;
  let pitch = Math.min(1.15, (space - sections.length * LABEL - (sections.length - 1) * SECTION_GAP) / total);
  const columns = pitch < 0.72 ? sections.length : 1;
  if (columns > 1) pitch = Math.min(1.15, (space - LABEL) / Math.max(...sections.map((section) => section.rows.length)));
  const width = (WIDTH - COLUMN_GAP * (columns - 1)) / columns, button = columns > 1 ? 1.15 : 1.75, gutter = columns > 1 ? 0.62 : 0.72;
  let y = TOP, bottom = TOP;
  sections.forEach(({ kind, rows }, index) => {
    const x = columns > 1 ? LEFT + index * (width + COLUMN_GAP) : LEFT;
    y = columns > 1 ? TOP : index ? y + SECTION_GAP : TOP;
    place(named.get(`${kind}_label`), { x, y, w: Math.min(width, 4) });
    y += LABEL;
    for (const n of rows) {
      const part = (name: string) => named.get(`row_${kind}_${n}_${name}`);
      place(part("icon"), { x: x + 0.02, y: y + 0.06 });
      place(part("play"), { x: x + 0.2, y: y + 0.21 });
      place(part("title"), { x: x + gutter, y, w: width - gutter - button - 0.05, h: 0.58 });
      if (part("title")) setSize(part("title")!, columns > 1 ? 15 : 18); // the design's 18 pt in one column; two equal lines in three
      place(part("btn_text"), { x: x + width - 0.22 - button, y, w: button, h: 0.58 });
      const rule = y + Math.min(0.72, pitch - 0.06);
      place(part("rule"), { x, y: rule, w: width });
      bottom = Math.max(bottom, rule);
      y += pitch;
    }
  });
  place(named.get("demo_note"), { y: bottom + 0.5 });
}

function layoutSlide(named: Map<string, Element>, fitted: Map<Element, { size: number; lines: number }>, images: Record<string, DeckImage>, fields: Fields): void {
  // Cover: each badge as wide as its words, the tagline right under the title, the accent rule under the tagline.
  if (named.has("badge_area_text")) {
    let x = 0.72;
    for (const kind of ["area", "maturity"]) {
      const text = named.get(`badge_${kind}_text`), size = Number(text?.getElementsByTagNameNS(NS.a, "rPr")[0]?.getAttribute("sz")) / 100 || 10.5;
      const w = monoWidth(textOf(text), size, true) + 0.06;
      place(named.get(`${kind}_dot`), { x });
      place(text, { x: x + 0.16, w });
      x += 0.16 + w + 0.3;
    }
    const title = named.get("Text 1"), fit = title && fitted.get(title), tagline = named.get("tagline");
    if (title && fit && tagline) {
      const h = linesHeight(fit.lines, fit.size);
      place(title, { h });
      const y = COVER_TITLE_Y + h + 0.28;
      place(tagline, { y, h: Math.max(0.4, 5.0 - y) });
      const line = fitText(tagline, 0.5);
      const end = y + (line ? linesHeight(line.lines, line.size, 1.34) : 0.4);
      place(named.get("cover_accent_rule"), { y: Math.min(5.25, Math.max(4.58, end + 0.45)) });
    }
  }

  // What it does: the business value right under the description; each accent bar as tall as its block.
  const description = named.get("description"), value = named.get("business_value");
  if (description && value && named.has("description_accent")) {
    let d = fitted.get(description), v = fitted.get(value);
    const top = inches(description).y, height = (a = d, b = v) => (a ? linesHeight(a.lines, a.size, 1.32) : 0.4) + 0.97 + (b ? linesHeight(b.lines, b.size, 1.32) : 0.4);
    // A long description would push the business value into the footer: both texts step down together.
    for (let size = Math.min(d?.size ?? 99, v?.size ?? 99) - 0.5; d && v && top + height() > 6.55 && size >= 11; size -= 0.5) {
      setSize(description, size); setSize(value, size);
      d = { size, lines: linesAt(description, size) }; v = { size, lines: linesAt(value, size) };
    }
    const dh = d ? linesHeight(d.lines, d.size, 1.32) : 0.4, vh = v ? linesHeight(v.lines, v.size, 1.32) : 0.4;
    const descriptionEnd = top + dh;
    place(description, { h: dh + 0.05 });
    place(named.get("description_accent"), { h: descriptionEnd + 0.2 - inches(named.get("description_accent")!).y });
    const label = descriptionEnd + 0.61;
    place(named.get("value_label"), { y: label });
    place(value, { y: label + 0.36, h: vh + 0.05 });
    place(named.get("value_accent"), { y: label - 0.03, h: vh + 0.36 + 0.22 });
  }

  // Screenshots: a grid for the number there are, instead of fixed small slots.
  const shots = Array.from({ length: 6 }, (_, i) => `shot_${i + 1}`).filter((key) => named.has(`img_${key}`) && images[key]);
  if (shots.length) {
    const left = 0.7, width = 11.93, top = 2.35, height = 4.27, gx = 0.3, gy = 0.29;
    const cells: { x: number; y: number; w: number; h: number }[] = [];
    const row = (count: number, w: number, h: number, y: number) => {
      const start = left + (width - (count * w + (count - 1) * gx)) / 2;
      for (let i = 0; i < count; i++) cells.push({ x: start + i * (w + gx), y, w, h });
    };
    if (shots.length === 1) row(1, Math.min(width, height * 1.78), height, top);
    else if (shots.length === 2) row(2, (width - gx) / 2, Math.min(height, (width - gx) / 2 / 1.6), top);
    else if (shots.length === 3) {
      const side = { w: width - 7.2 - gx, h: (height - gy) / 2 };
      cells.push({ x: left, y: top, w: 7.2, h: height }, { x: left + 7.2 + gx, y: top, ...side }, { x: left + 7.2 + gx, y: top + side.h + gy, ...side });
    } else if (shots.length === 4) { const h = (height - gy) / 2; row(2, h * 1.78, h, top); row(2, h * 1.78, h, top + h + gy); }
    else { const w = (width - 2 * gx) / 3, h = Math.min((height - gy) / 2, w / 1.9); row(3, w, h, top); row(shots.length - 3, w, h, top + h + gy); }
    shots.forEach((key, i) => place(named.get(`img_${key}`), cells[i]));
  }

  // Built on: an empty industry or client context leaves no label; technologies flow left to right and wrap.
  if (named.has("tech_eyebrow")) {
    for (const [field, parts] of [["industries", ["industry_label", "industry_value", "industry_dot"]], ["client_context", ["client_label", "client_value", "client_dot"]]] as const) {
      if (!fields[field]) parts.forEach((part) => remove(named.get(part)));
    }
    // No business context at all: the technologies move up into its place instead of leaving it empty.
    const noContext = !fields.industries && !fields.client_context;
    if (noContext) {
      remove(named.get("context_eyebrow")); remove(named.get("right_section_rule"));
      place(named.get("tech_eyebrow"), { y: inches(named.get("context_eyebrow") ?? named.get("tech_eyebrow")!).y });
    }
    const LEFT = 6.95, RIGHT = 12.63;
    let x = LEFT, y = noContext ? 2.62 : 5.37;
    for (let i = 1; i <= 8; i++) {
      const text = named.get(`tech_${i}`);
      if (!text?.parentNode) continue;
      const size = Number(text.getElementsByTagNameNS(NS.a, "rPr")[0]?.getAttribute("sz")) / 100 || 11.5;
      const w = textWidth(textOf(text), size, true) + 0.08;
      if (x + 0.17 + w > RIGHT && x > LEFT) { x = LEFT; y += 0.45; }
      place(named.get(`tech_dot_${i}`), { x, y: y + 0.06 });
      place(text, { x: x + 0.17, y, w, h: 0.25 });
      x += 0.17 + w + 0.3;
    }
  }
}

export async function fillDeckTemplate(template: ArrayBuffer | Uint8Array, fields: Fields, images: Record<string, DeckImage>): Promise<Blob> {
  const zip = await JSZip.loadAsync(template);
  // .potx -> .pptx: PowerPoint opens a template content type as a new untitled copy instead of the file.
  const types = (await zip.file("[Content_Types].xml")!.async("string")).replace("presentationml.template.main+xml", "presentationml.presentation.main+xml");
  const theme = await zip.file("ppt/theme/theme1.xml")!.async("string");
  const variant: DeckVariant = theme.includes("PRISMA Dark") ? "dark" : "light";
  const pal = PALETTES[variant];
  const area = pal[AREA_KEY[(fields.area_name ?? "").toLowerCase()] ?? ""];
  const maturity = pal[MATURITY_KEY[(fields.maturity_label ?? "").toLowerCase()] ?? ""];
  let mediaCount = 0;
  const usedExt = new Set<string>();

  const slidePaths = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
  for (const path of slidePaths) {
    const relsPath = path.replace("slides/", "slides/_rels/") + ".rels";
    const doc = new DOMParser().parseFromString(await zip.file(path)!.async("string"), "application/xml");
    const rels = await relsDoc(zip, relsPath);
    const named = namedShapes(doc);
    const tree = doc.getElementsByTagNameNS(NS.p, "spTree")[0];
    let nextId = Math.max(0, ...Array.from(doc.getElementsByTagNameNS(NS.p, "cNvPr")).map((el) => +(el.getAttribute("id") ?? 0))) + 1;

    if (area) {
      if (named.has("area_dot")) recolour(named.get("area_dot")!, area, { fills: true });
      if (named.has("badge_area_text")) recolour(named.get("badge_area_text")!, area, { text: true });
    }
    if (maturity) {
      if (named.has("maturity_dot")) recolour(named.get("maturity_dot")!, maturity, { fills: true });
      if (named.has("badge_maturity_text")) recolour(named.get("badge_maturity_text")!, maturity, { text: true });
    }

    for (const [kind, max] of Object.entries(ROW_KINDS)) { // demo rows: the button says what it does; title and button link
      for (let n = 1; n <= max; n++) {
        if (!fields[`${kind}_${n}_title`] || !named.has(`row_${kind}_${n}_title`)) continue;
        const url = fields[`${kind}_${n}_url`], action = fields[`${kind}_${n}_action`];
        if (url) for (const part of ["title", "btn_text"]) linkShape(doc, rels, named.get(`row_${kind}_${n}_${part}`), url);
        const label = named.get(`row_${kind}_${n}_btn_text`)?.getElementsByTagNameNS(NS.a, "t")[0];
        if (action && label) label.textContent = `${action.toUpperCase()}  ${action === "Download" ? "↓" : "↗"}`;
      }
    }
    if (named.has("demo_note")) layoutDemos(named, fields);

    // Text is filled after the rows are laid out, so a demo title shrinks only when its final box is too small.
    presetSlide(named);
    const fitted = new Map<Element, { size: number; lines: number }>();
    for (const shape of Array.from(tree.getElementsByTagNameNS(NS.p, "sp"))) {
      if (!/\{\{/.test(shape.textContent ?? "")) continue;
      fillParagraphs(shape, fields);
      const fit = fitText(shape, shape === named.get("tagline") || shapeName(shape) === "Text 1" ? 0.5 : 0.6);
      if (fit) fitted.set(shape, fit);
    }

    for (let i = 1; i <= 8; i++) { // unused technologies
      const tech = named.get(`tech_${i}`);
      if (tech && !(tech.textContent ?? "").trim()) { remove(tech); remove(named.get(`tech_dot_${i}`)); }
    }

    // Layout before pictures: a picture takes its frame's final box.
    layoutSlide(named, fitted, images, fields);

    // images: the glass frame stays behind a picture; an unused screenshot slot disappears, other empty frames stay clean
    for (const [name, frame] of Array.from(named)) {
      if (!name.startsWith("img_") || name.endsWith("_label")) continue;
      const key = name.slice(4);
      const label = named.get(`${name}_label`);
      const image = images[key];
      if (image) {
        mediaCount += 1; usedExt.add(image.ext);
        const target = `media/deck-${mediaCount}-${safeName(key)}.${image.ext}`;
        zip.file(`ppt/${target}`, image.bytes);
        const rId = addRel(rels, REL_IMAGE, `../${target}`);
        tree.insertBefore(pictureFor(doc, frame, rId, image, nextId++), frame);
        remove(frame); remove(label);
      } else if (key.startsWith("shot_")) { remove(frame); remove(label); }
      else remove(label);
    }

    linkShape(doc, rels, named.get("library_link"), fields.library_href || fields.prisma_href || "");
    linkFirstRun(doc, rels, named.get("csm_email"), fields.csm_email ?? "");

    zip.file(path, new XMLSerializer().serializeToString(doc));
    zip.file(relsPath, new XMLSerializer().serializeToString(rels));

    const notes = Array.from(rels.documentElement.children).find((rel) => rel.getAttribute("Type")?.endsWith("/notesSlide"));
    if (notes) { // speaker notes carry tokens too
      const notesPath = `ppt/${notes.getAttribute("Target")!.replace("../", "")}`;
      const notesDoc = new DOMParser().parseFromString(await zip.file(notesPath)!.async("string"), "application/xml");
      fillParagraphs(notesDoc.documentElement, fields, true);
      zip.file(notesPath, new XMLSerializer().serializeToString(notesDoc));
    }
  }

  let patched = types;
  for (const ext of usedExt) if (!new RegExp(`Extension="${ext}"`).test(patched)) patched = patched.replace("</Types>", `<Default Extension="${ext}" ContentType="image/${ext}"/></Types>`);
  zip.file("[Content_Types].xml", patched);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
}
