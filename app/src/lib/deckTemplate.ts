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
// Demo card geometry (inches), matching slide 5 of the templates: first row offset, row pitch, bottom padding.
const FIRST_ROW = 0.65, ROW_STEP = 0.9, CARD_PAD = 0.14;
const TOKEN = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

const PALETTES: Record<DeckVariant, Record<string, string>> = {
  dark: { ai: "7FB6D9", data: "4FBFAB", ibo: "A99AE6", live: "5FD3A2", proto: "E0B860", idea: "9BB0BF" },
  light: { ai: "1C567C", data: "0B6157", ibo: "57468C", live: "0B6145", proto: "7C5408", idea: "5B6B77" },
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
    if (dropEmpty && Array.from(text.matchAll(TOKEN)).every(([, key]) => !fields[key])) { remove(para); continue; }
    let out = text.replace(TOKEN, (_, key: string) => fields[key] ?? "");
    out = out.replace(/\s*[·•|\-–—]\s*$/, "").trim(); // an empty trailing field must not leave a dangling separator
    runs[0].getElementsByTagNameNS(NS.a, "t")[0].textContent = out;
    runs.slice(1).forEach(remove);
  }
}

/** Lines a text needs at `size` pt in a box `width` pt wide; a word longer than a line wraps on its own. */
export function estimateLines(text: string, width: number, size: number, bold: boolean): number {
  const perLine = Math.max(1, Math.floor(width / (size * (bold ? 0.55 : 0.48)))); // average glyph widths for Arial bold / Calibri, measured on rendered slides
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    let used = 0;
    lines += 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (used && used + 1 + word.length > perLine) { lines += 1; used = 0; }
      used += (used ? 1 : 0) + word.length;
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
  const box = shape.getElementsByTagNameNS(NS.a, "ext")[0];
  if (!base || !box) return;
  const width = Number(box.getAttribute("cx")) / 12700, height = Number(box.getAttribute("cy")) / 12700; // EMU -> pt
  const text = Array.from(shape.getElementsByTagNameNS(NS.a, "p")).map((para) => para.textContent ?? "").join("\n");
  const bold = runs[0].getAttribute("b") === "1";
  let size = base / 100;
  while (size > (base / 100) * floor && estimateLines(text, width, size, bold) * size * 1.2 > height) size -= 2;
  if (size !== base / 100) setSize(shape, size);
  return { size, lines: estimateLines(text, width, size, bold) };
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

function hlinkClick(doc: Document, rId: string): Element {
  const el = doc.createElementNS(NS.a, "a:hlinkClick");
  el.setAttributeNS(NS.r, "r:id", rId);
  return el;
}

function linkShape(doc: Document, rels: Document, shape: Element | undefined, url: string): void {
  const cNvPr = shape?.getElementsByTagNameNS(NS.p, "cNvPr")[0];
  if (!cNvPr || !url) return;
  cNvPr.appendChild(hlinkClick(doc, addRel(rels, REL_LINK, toUrl(url), true)));
}

function linkFirstRun(doc: Document, rels: Document, shape: Element | undefined, url: string): void {
  const rPr = shape?.getElementsByTagNameNS(NS.a, "r")[0]?.getElementsByTagNameNS(NS.a, "rPr")[0];
  if (!rPr || !url) return;
  rPr.appendChild(hlinkClick(doc, addRel(rels, REL_LINK, toUrl(url), true)));
}

function xfrm(shape: Element): { x: number; y: number; w: number; h: number; off: Element; ext: Element } {
  const off = shape.getElementsByTagNameNS(NS.a, "off")[0];
  const ext = shape.getElementsByTagNameNS(NS.a, "ext")[0];
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

/**
 * The demo cards are laid out as columns. Cards without rows are removed; the remaining ones share the full width,
 * keeping the template's gap. Buttons stay anchored to the right edge of their card; titles, rows and labels widen.
 */
function spreadCards(named: Map<string, Element>): void {
  const kinds = Object.keys(ROW_KINDS).filter((kind) => named.get(`card_${kind}`));
  const present = kinds.filter((kind) => named.get(`card_${kind}`)!.parentNode);
  if (kinds.length < 2 || present.length === kinds.length || !present.length) return;
  const boxes = kinds.map((kind) => xfrm(named.get(`card_${kind}`)!));
  const left = boxes[0].x, right = boxes[boxes.length - 1].x + boxes[boxes.length - 1].w, gap = boxes[1].x - (boxes[0].x + boxes[0].w);
  const width = Math.round((right - left - gap * (present.length - 1)) / present.length);
  present.forEach((kind, index) => {
    const card = xfrm(named.get(`card_${kind}`)!);
    const dx = left + index * (width + gap) - card.x, dw = width - card.w;
    for (const [name, shape] of named) {
      if (!shape.parentNode || !(name === `card_${kind}` || name === `${kind}_label` || name.startsWith(`row_${kind}_`))) continue;
      const box = xfrm(shape);
      const anchoredRight = /_btn(_text)?$/.test(name), widens = !anchoredRight && !/_(icon|play)$/.test(name);
      box.off.setAttribute("x", String(box.x + dx + (anchoredRight ? dw : 0)));
      if (widens) box.ext.setAttribute("cx", String(box.w + dw));
    }
  });
}

// ---- Adaptive layout ---------------------------------------------------------------------------------------------
// The templates are drawn for a full solution. Real ones vary (a short name or a long one, one screenshot or six, one
// technology or eight), so these steps fit the slides to the content. Measurements are in inches.

type Box = { x?: number; y?: number; w?: number; h?: number };
const inches = (shape: Element) => { const b = xfrm(shape); return { x: b.x / EMU_IN, y: b.y / EMU_IN, w: b.w / EMU_IN, h: b.h / EMU_IN }; };
function place(shape: Element | undefined, box: Box): void {
  if (!shape?.parentNode) return;
  const b = xfrm(shape), emu = (v: number) => String(Math.round(v * EMU_IN));
  if (box.x !== undefined) b.off.setAttribute("x", emu(box.x));
  if (box.y !== undefined) b.off.setAttribute("y", emu(box.y));
  if (box.w !== undefined) b.ext.setAttribute("cx", emu(box.w));
  if (box.h !== undefined) b.ext.setAttribute("cy", emu(box.h));
}
const textOf = (shape: Element | undefined) => (shape?.textContent ?? "").trim();
/** Height of `lines` lines at `pt` points, in inches. */
const linesHeight = (lines: number, pt: number) => (lines * pt * 1.2) / 72;
/** Width of a short label in the templates' mono font, in inches (`spaced`: the badges' wider letter spacing). */
const monoWidth = (text: string, pt: number, spaced = false) => text.length * pt * (spaced ? 0.0112 : 0.0084);
/** A one-line label: never wraps, whatever the width estimate. */
function noWrap(shape: Element | undefined): void { shape?.getElementsByTagNameNS(NS.a, "bodyPr")[0]?.setAttribute("wrap", "none"); }
const coverTitle = (named: Map<string, Element>) => named.has("badge_area") ? named.get("Text 1") : undefined; // the cover's only title placeholder

/** Sizes set before the text is filled, so fitting starts from them. */
function presetSlide(named: Map<string, Element>): void {
  const title = coverTitle(named);
  if (title) { place(title, { y: 2.05, h: linesHeight(2, 44) + 0.02 }); setSize(title, 44); } // two lines at most; a long name shrinks
  if (named.has("tagline")) setSize(named.get("tagline")!, 18);
  for (const name of ["badge_area_text", "badge_maturity_text"]) if (named.has(name)) { setSize(named.get(name)!, 9); noWrap(named.get(name)); }
  for (let i = 1; i <= 8; i++) if (named.has(`tech_${i}`)) { setSize(named.get(`tech_${i}`)!, 11); noWrap(named.get(`tech_${i}`)); }
  noWrap(named.get("prisma_link"));
}

function layoutSlide(named: Map<string, Element>, fitted: Map<Element, { size: number; lines: number }>, images: Record<string, DeckImage>): void {
  // Cover: badges as wide as their words, the tagline right under the title whatever its length.
  if (named.has("badge_area")) {
    let x = 0.7;
    for (const kind of ["area", "maturity"]) {
      const text = named.get(`badge_${kind}_text`), w = monoWidth(textOf(text), 9, true) + 0.06;
      place(named.get(`badge_${kind}`), { x, y: 1.5, w: 0.34 + w + 0.16, h: 0.32 });
      place(named.get(`${kind}_dot`), { x: x + 0.16, y: 1.5 + 0.11, w: 0.1, h: 0.1 });
      place(text, { x: x + 0.34, y: 1.5, w, h: 0.32 });
      x += 0.34 + w + 0.16 + 0.15;
    }
    const title = coverTitle(named), fit = title && fitted.get(title), tagline = named.get("tagline");
    if (title && fit && tagline) {
      const h = linesHeight(fit.lines, fit.size);
      place(title, { h });
      const y = 2.05 + h + 0.28;
      place(tagline, { y, h: Math.max(0.4, 6.0 - y) });
      fitText(tagline, 0.5);
    }
  }

  // What it does: cards as tall as their text; the picture matches the column.
  const description = named.get("description"), value = named.get("business_value");
  if (description && value && named.has("card_description") && named.has("card_value")) {
    const d = fitted.get(description), v = fitted.get(value);
    const dh = d ? linesHeight(d.lines, d.size) : 0.4, vh = v ? linesHeight(v.lines, v.size) : 0.4;
    const top = 2.45, descCard = 0.57 + dh + 0.32, valueTop = top + descCard + 0.2, valueCard = 0.5 + vh + 0.3;
    if (valueTop + valueCard <= 6.7) {
      place(named.get("card_description"), { y: top, h: descCard });
      place(description, { y: top + 0.57, h: dh + 0.05 });
      place(named.get("card_value"), { y: valueTop, h: valueCard });
      place(named.get("value_label"), { y: valueTop + 0.18 });
      place(value, { y: valueTop + 0.5, h: vh + 0.05 });
      place(named.get("img_feature_image"), { y: top, h: Math.max(valueTop + valueCard - top, 3.2) });
    }
  }

  // Screenshots: a grid for the number there are, instead of fixed small slots.
  const shots = Array.from({ length: 6 }, (_, i) => `shot_${i + 1}`).filter((key) => named.has(`img_${key}`) && images[key]);
  if (shots.length) {
    const left = 0.7, width = 11.93, top = 2.45, height = 4.3, gx = 0.3, gy = 0.25;
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

  // Built on: chips as wide as their words, wrapping, in a card as tall as they need.
  if (named.has("card_tech")) {
    let x = 1.0, y = 5.0, bottom = y;
    for (let i = 1; i <= 8; i++) {
      const text = named.get(`tech_${i}`);
      if (!text?.parentNode) continue;
      const w = monoWidth(textOf(text), 11) + 0.04;
      if (x + w + 0.44 > 12.33 && x > 1.0) { x = 1.0; y += 0.55; }
      place(named.get(`tech_chip_${i}`), { x, y, w: w + 0.44, h: 0.4 });
      place(text, { x: x + 0.22, y, w, h: 0.4 });
      x += w + 0.44 + 0.15; bottom = y + 0.4;
    }
    place(named.get("card_tech"), { h: bottom + 0.35 - inches(named.get("card_tech")!).y });
  }

  // Next step: the PRISMA chip as wide as its words.
  if (named.has("prisma_link_chip")) {
    const text = named.get("prisma_link"), w = textOf(text).length * 13 * 0.0085 + 0.2;
    place(named.get("prisma_link_chip"), { w: w + 0.5 });
    place(text, { w });
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
      for (const n of ["badge_area", "area_dot"]) if (named.has(n)) recolour(named.get(n)!, area, { fills: true });
      if (named.has("badge_area_text")) recolour(named.get("badge_area_text")!, area, { text: true });
    }
    if (maturity) {
      for (const n of ["badge_maturity", "maturity_dot"]) if (named.has(n)) recolour(named.get(n)!, maturity, { fills: true });
      if (named.has("badge_maturity_text")) recolour(named.get("badge_maturity_text")!, maturity, { text: true });
    }

    for (const [kind, max] of Object.entries(ROW_KINDS)) { // demo rows
      for (let n = 1; n <= max; n++) {
        if (!named.has(`row_${kind}_${n}`)) continue;
        const title = fields[`${kind}_${n}_title`], url = fields[`${kind}_${n}_url`], action = fields[`${kind}_${n}_action`];
        if (!title) { for (const [name, shape] of named) { if (name.startsWith(`row_${kind}_${n}`)) remove(shape); } continue; }
        // The label text box sits exactly over the button and takes the click, so both carry the link.
        if (url) for (const part of ["btn", "btn_text"]) linkShape(doc, rels, named.get(`row_${kind}_${n}_${part}`), url);
        const label = named.get(`row_${kind}_${n}_btn_text`)?.getElementsByTagNameNS(NS.a, "t")[0];
        if (action && label) label.textContent = action;
        if (action === "Download") { // a longer word: the button grows leftwards, the title gives way
          const grow = Math.round(0.18 * EMU_IN);
          for (const part of ["btn", "btn_text"]) {
            const shape = named.get(`row_${kind}_${n}_${part}`);
            if (shape) { const b = xfrm(shape); b.off.setAttribute("x", String(b.x - grow)); b.ext.setAttribute("cx", String(b.w + grow)); }
          }
          const titleShape = named.get(`row_${kind}_${n}_title`);
          if (titleShape) { const b = xfrm(titleShape); b.ext.setAttribute("cx", String(b.w - grow)); }
        }
      }
    }
    if (named.has("demo_note")) { // size the cards to the rows in use; hide a card with none
      const bottoms: number[] = [];
      for (const [kind, max] of Object.entries(ROW_KINDS)) {
        const used = Array.from({ length: max }, (_, i) => fields[`${kind}_${i + 1}_title`]).filter(Boolean).length;
        const card = named.get(`card_${kind}`);
        if (!card) continue;
        if (!used) { remove(card); remove(named.get(`${kind}_label`)); continue; }
        const geometry = xfrm(card), height = Math.round((FIRST_ROW + used * ROW_STEP + CARD_PAD) * EMU_IN);
        geometry.ext.setAttribute("cy", String(height));
        bottoms.push(geometry.y + height);
      }
      if (bottoms.length) xfrm(named.get("demo_note")!).off.setAttribute("y", String(Math.max(...bottoms) + Math.round(0.14 * EMU_IN)));
      spreadCards(named);
    }

    // Text is filled after the cards are laid out, so a demo title shrinks only when its final box is too small.
    presetSlide(named);
    const fitted = new Map<Element, { size: number; lines: number }>();
    for (const shape of Array.from(tree.getElementsByTagNameNS(NS.p, "sp"))) {
      if (!/\{\{/.test(shape.textContent ?? "")) continue;
      fillParagraphs(shape, fields);
      const fit = fitText(shape, shape === named.get("tagline") || shapeName(shape) === "Text 1" ? 0.5 : 0.6);
      if (fit) fitted.set(shape, fit);
    }

    for (let i = 1; i <= 8; i++) { // unused technology chips
      const tech = named.get(`tech_${i}`);
      if (tech && !(tech.textContent ?? "").trim()) { remove(tech); remove(named.get(`tech_chip_${i}`)); }
    }

    // Layout before pictures: a picture takes its frame's final box.
    layoutSlide(named, fitted, images);

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



    for (const part of ["prisma_link_chip", "prisma_link"]) linkShape(doc, rels, named.get(part), fields.prisma_href || fields.prisma_url || "");
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
