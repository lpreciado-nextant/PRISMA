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
function fitText(shape: Element, floor = 0.6): void {
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
}

/** True for a run set in the display face (Aptos Display), which is narrower than the text face. */
function isDisplay(rPr: Element | undefined): boolean {
  return /display/i.test(rPr?.getElementsByTagNameNS(NS.a, "latin")[0]?.getAttribute("typeface") ?? "");
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
  const corner = frame.getElementsByTagNameNS(NS.a, "gd")[0]?.getAttribute("fmla") ?? "val 6000";
  const xml = `<p:pic xmlns:p="${NS.p}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><p:nvPicPr><p:cNvPr id="${id}" name="${shapeName(frame).replace("img_", "picture_")}" descr=""/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rId}"/><a:srcRect l="${pct(l)}" r="${pct(l)}" t="${pct(t)}" b="${pct(t)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="${corner}"/></a:avLst></a:prstGeom></p:spPr></p:pic>`;
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
/** Width of a one-line label in the text font, in inches, with estimateLines' glyph widths. */
const textWidth = (text: string, pt: number, bold: boolean) => (text.length * pt * (bold ? 0.5 : 0.48)) / 72;
const sizeOf = (shape: Element | undefined, fallback: number) => Number(shape?.getElementsByTagNameNS(NS.a, "rPr")[0]?.getAttribute("sz")) / 100 || fallback;
/** A one-line label: never wraps, whatever the width estimate. */
function noWrap(shape: Element | undefined): void { shape?.getElementsByTagNameNS(NS.a, "bodyPr")[0]?.setAttribute("wrap", "none"); }

/** Slide 4's pills, one value each: areas, industries, the client context and technologies. Empty ones go. */
const CHIPS = [...[1, 2, 3].map((n) => `area_${n}`), "capability_value", ...[1, 2, 3, 4].map((n) => `industry_${n}`), "client_value", ...Array.from({ length: 8 }, (_, i) => `tech_${i + 1}`)];
const CHIP_PAD = 0.44, CHIP_GAP = 0.11, CHIP_H = 0.42, CHIP_PITCH = 0.53;
const DEMO_PARTS = ["box", "title", "btn_text"];

/** Sizes set before the text is filled, so fitting starts from them and only shrinks what really overflows. */
function presetSlide(named: Map<string, Element>): void {
  for (const name of ["badge_area_text", "badge_maturity_text", ...CHIPS]) noWrap(named.get(name));
  // The tagline may run to four lines under the title, inside the cover card.
  place(named.get("tagline"), { h: 2.0 });
}

/**
 * Lays pills left to right from `left`, wrapping at `right`, each as wide as its words. Returns the last row's bottom.
 * A row past `bottom` makes every pill smaller and the rows closer instead of leaving the card.
 */
function flowChips(chips: Element[], left: number, right: number, top: number, bottom = Infinity): number {
  const rows = (pt: number, pitch: number) => {
    let x = left, y = top;
    const spots = chips.map((chip) => {
      const w = Math.min(textWidth(textOf(chip), pt, true) + CHIP_PAD * pt / 14, right - left);
      if (x + w > right && x > left) { x = left; y += pitch; }
      const spot = { x, y, w };
      x += w + CHIP_GAP;
      return spot;
    });
    return { spots, end: y };
  };
  let pt = 14, h = CHIP_H, pitch = CHIP_PITCH, layout = rows(pt, pitch);
  if (layout.end + h > bottom) { pt = 12; h = 0.36; pitch = 0.44; layout = rows(pt, pitch); }
  if (layout.end + h > bottom) { pt = 11; h = 0.32; pitch = 0.38; layout = rows(pt, pitch); }
  chips.forEach((chip, i) => {
    const { x, y, w } = layout.spots[i];
    if (pt !== 14) setSize(chip, pt);
    // A pill wider than the card (a long client context) keeps the card's width and a smaller face.
    if (w >= right - left) setSize(chip, Math.max(10, Math.floor(pt * (right - left) / (textWidth(textOf(chip), pt, true) + CHIP_PAD))));
    place(chip, { x, y, w, h });
  });
  return layout.end + h;
}

/**
 * Slide 5 has a card per kind of demo (videos, interactive demos, supporting material), each with up to three rows. A
 * kind without rows loses its card and the others share the width. With no demos at all, the note invites a walkthrough.
 */
function layoutDemos(named: Map<string, Element>, fields: Fields): void {
  const LEFT = 0.69, WIDTH = 11.94, GAP = 0.28, TOP = 2.08, FIRST_ROW = 3.03, ROW_PITCH = 0.84;
  const kinds = Object.entries(ROW_KINDS).map(([kind, max]) => {
    const rows = Array.from({ length: max }, (_, i) => i + 1).filter((n) => fields[`${kind}_${n}_title`]);
    for (let n = 1; n <= max; n++) if (!rows.includes(n)) for (const part of DEMO_PARTS) remove(named.get(`row_${kind}_${n}_${part}`));
    if (!rows.length) for (const part of ["card", "icon", "glyph", "label"]) remove(named.get(`${kind}_${part}`));
    return { kind, rows };
  }).filter((entry) => entry.rows.length);
  if (!kinds.length) {
    const note = named.get("demo_note")?.getElementsByTagNameNS(NS.a, "t")[0];
    if (note) note.textContent = "Ask your Nextant contact for a live walkthrough of this solution.";
    place(named.get("demo_note"), { y: TOP });
    return;
  }
  const width = (WIDTH - GAP * (kinds.length - 1)) / kinds.length;
  kinds.forEach(({ kind, rows }, index) => {
    const x = LEFT + index * (width + GAP);
    place(named.get(`${kind}_card`), { x, w: width });
    place(named.get(`${kind}_icon`), { x: x + 0.34 });
    const glyph = named.get(`${kind}_glyph`);
    if (glyph) place(glyph, { x: x + 0.34 + (inches(named.get(`${kind}_icon`) ?? glyph).w - inches(glyph).w) / 2 + (kind === "supporting" ? 0 : 0.02) });
    place(named.get(`${kind}_label`), { x: x + 0.92, w: width - 1.15 });
    rows.forEach((n, i) => {
      const part = (name: string) => named.get(`row_${kind}_${n}_${name}`);
      const y = FIRST_ROW + i * ROW_PITCH, right = x + width - 0.23;
      const button = textWidth(textOf(part("btn_text")), 12, true) + 0.6;
      place(part("box"), { x: x + 0.23, y, w: width - 0.46 });
      place(part("btn_text"), { x: right - 0.15 - button, y: y + 0.18, w: button });
      // Two lines at most: a longer title shrinks inside the row instead of spilling out of it.
      place(part("title"), { x: x + 0.39, y: y + 0.07, w: right - 0.15 - button - 0.12 - (x + 0.39), h: 0.58 });
    });
  });
}

function layoutSlide(named: Map<string, Element>, images: Record<string, DeckImage>, fields: Fields): void {
  // Cover: each badge as wide as its words, side by side above the picture.
  if (named.has("badge_area_text")) {
    let x = inches(named.get("badge_area_text")!).x;
    for (const kind of ["area", "maturity"]) {
      const text = named.get(`badge_${kind}_text`);
      if (!text) continue;
      const w = textWidth(textOf(text), sizeOf(text, 13), true) + 0.71;
      place(text, { x, w });
      place(named.get(`${kind}_dot`), { x: x + 0.16 });
      x += w + 0.13;
    }
    // The tagline follows the title, one line or two, at the design's distance.
    const title = named.get("Text 1"), tagline = named.get("tagline");
    if (title && tagline) {
      const { y, w } = inches(title), size = sizeOf(title, 44);
      const lines = estimateLines(textOf(title), w * 72, size, true, isDisplay(title.getElementsByTagNameNS(NS.a, "rPr")[0]));
      place(tagline, { y: y + (lines * size * 1.2) / 72 + 0.78 });
    }
  }

  // Screenshots: a grid for the number there are, instead of fixed small slots.
  const shots = Array.from({ length: 6 }, (_, i) => `shot_${i + 1}`).filter((key) => named.has(`img_${key}`) && images[key]);
  if (shots.length) {
    const left = 0.5, width = 12.33, top = 1.92, height = 4.42, gx = 0.17, gy = 0.22;
    const cells: { x: number; y: number; w: number; h: number }[] = [];
    const row = (count: number, w: number, h: number, y: number) => {
      const start = left + (width - (count * w + (count - 1) * gx)) / 2;
      for (let i = 0; i < count; i++) cells.push({ x: start + i * (w + gx), y, w, h });
    };
    if (shots.length === 1) row(1, Math.min(width, height * 1.78), height, top);
    else if (shots.length === 2) row(2, (width - gx) / 2, Math.min(height, (width - gx) / 2 / 1.6), top);
    else if (shots.length === 3) {
      const main = 7.6, side = { w: width - main - gx, h: (height - gy) / 2 };
      cells.push({ x: left, y: top, w: main, h: height }, { x: left + main + gx, y: top, ...side }, { x: left + main + gx, y: top + side.h + gy, ...side });
    } else if (shots.length === 4) { const h = (height - gy) / 2; row(2, h * 1.78, h, top); row(2, h * 1.78, h, top + h + gy); }
    else { const w = (width - 2 * gx) / 3, h = Math.min((height - gy) / 2, w / 1.9); row(3, w, h, top); row(shots.length - 3, w, h, top + h + gy); }
    shots.forEach((key, i) => place(named.get(`img_${key}`), cells[i]));
  }

  // Built on: four cards of pills. An empty industry or client context leaves no label; with neither, the
  // technologies card takes the whole right column.
  if (named.has("tech_eyebrow")) {
    const chips = (names: string[]) => names.map((name) => named.get(name)).filter((chip): chip is Element => !!chip?.parentNode);
    const LEFT = 1.03, RIGHT = 6.19, CONTEXT_LEFT = 7.14, CONTEXT_RIGHT = 12.31;
    flowChips(chips(["area_1", "area_2", "area_3"]), LEFT, RIGHT, 3.06);
    const industries = chips(["industry_1", "industry_2", "industry_3", "industry_4"]);
    if (!industries.length) remove(named.get("industry_label"));
    if (!fields.client_context) { remove(named.get("client_label")); remove(named.get("client_value")); }
    let y = 2.67, end = y; // the context card's first label
    if (industries.length) { place(named.get("industry_label"), { y }); end = flowChips(industries, CONTEXT_LEFT, CONTEXT_RIGHT, y + 0.39); y = end + 0.2; }
    if (fields.client_context) { place(named.get("client_label"), { y }); end = flowChips(chips(["client_value"]), CONTEXT_LEFT, CONTEXT_RIGHT, y + 0.39); }
    // A full context card grows; both top cards keep one height and the bottom row moves down.
    const TOP = 2.39, BOTTOM = 6.91, topEnd = Math.max(4.54, end + 0.22);
    let bottomTop = topEnd + 0.22;
    if (topEnd > 4.54) for (const name of ["overview_card", "context_card"]) place(named.get(name), { h: topEnd - TOP });
    place(named.get("capability_card"), { y: bottomTop, h: BOTTOM - bottomTop });
    place(named.get("capability_eyebrow"), { y: bottomTop + 0.28 });
    flowChips(chips(["capability_value"]), LEFT, RIGHT, bottomTop + 0.67);
    if (!industries.length && !fields.client_context) {
      for (const name of ["context_card", "context_eyebrow"]) remove(named.get(name));
      bottomTop = TOP;
    }
    place(named.get("tech_eyebrow"), { y: bottomTop + 0.28 });
    const techEnd = flowChips(chips(Array.from({ length: 8 }, (_, i) => `tech_${i + 1}`)), CONTEXT_LEFT, CONTEXT_RIGHT, bottomTop + 0.67, BOTTOM - 0.15);
    // Everything at once (three rows of pills under a full context card) runs the bottom row into the free margin.
    const bottom = Math.max(BOTTOM, techEnd + 0.18);
    place(named.get("tech_card"), { y: bottomTop, h: bottom - bottomTop });
    if (bottom > BOTTOM) place(named.get("capability_card"), { h: bottom - inches(named.get("capability_card")!).y });
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
      if (named.has("badge_area_text")) recolour(named.get("badge_area_text")!, area, { fills: true, text: true });
    }
    if (maturity) {
      if (named.has("maturity_dot")) recolour(named.get("maturity_dot")!, maturity, { fills: true });
      if (named.has("badge_maturity_text")) recolour(named.get("badge_maturity_text")!, maturity, { fills: true, text: true });
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
    for (const shape of Array.from(tree.getElementsByTagNameNS(NS.p, "sp"))) {
      if (!/\{\{/.test(shape.textContent ?? "")) continue;
      fillParagraphs(shape, fields);
      // Pills and badges never wrap: they take their words' width in the layout instead of shrinking.
      if (!CHIPS.includes(shapeName(shape))) fitText(shape, shape === named.get("tagline") || shapeName(shape) === "Text 1" ? 0.5 : 0.6);
    }
    for (const name of CHIPS) if (named.has(name) && !textOf(named.get(name))) remove(named.get(name)); // unused pills

    // Layout before pictures: a picture takes its frame's final box.
    layoutSlide(named, images, fields);

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
