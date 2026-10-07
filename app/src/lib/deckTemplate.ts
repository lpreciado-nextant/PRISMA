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
  light: { ai: "1C567C", data: "0B6157", ibo: "57468C", live: "0B6145", proto: "7C5408", idea: "5B6B77" },
};
const AREA_KEY: Record<string, string> = { "ai & automation": "ai", "data solutions": "data", "intelligent business operations": "ibo" };
const MATURITY_KEY: Record<string, string> = { live: "live", "working prototype": "proto", "idea / concept": "idea" };
const ROW_KINDS: Record<string, number> = { video: 3, interactive: 2 };

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

function fillParagraphs(root: Element, fields: Fields): void {
  for (const para of Array.from(root.getElementsByTagNameNS(NS.a, "p"))) {
    const runs = Array.from(para.getElementsByTagNameNS(NS.a, "r"));
    const text = runs.map((run) => run.getElementsByTagNameNS(NS.a, "t")[0]?.textContent ?? "").join("");
    if (!runs.length || !/\{\{/.test(text)) continue;
    let out = text.replace(TOKEN, (_, key: string) => fields[key] ?? "");
    out = out.replace(/\s*[·•|\-–—]\s*$/, "").trim(); // an empty trailing field must not leave a dangling separator
    runs[0].getElementsByTagNameNS(NS.a, "t")[0].textContent = out;
    runs.slice(1).forEach(remove);
  }
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

    for (const shape of Array.from(tree.getElementsByTagNameNS(NS.p, "sp"))) fillParagraphs(shape, fields);

    for (let i = 1; i <= 8; i++) { // unused technology chips
      const tech = named.get(`tech_${i}`);
      if (tech && !(tech.textContent ?? "").trim()) { remove(tech); remove(named.get(`tech_chip_${i}`)); }
    }

    for (const [kind, max] of Object.entries(ROW_KINDS)) { // demo rows
      for (let n = 1; n <= max; n++) {
        if (!named.has(`row_${kind}_${n}`)) continue;
        const title = fields[`${kind}_${n}_title`], url = fields[`${kind}_${n}_url`];
        if (!title) for (const [name, shape] of named) { if (name.startsWith(`row_${kind}_${n}`)) remove(shape); }
        else if (url) linkShape(doc, rels, named.get(`row_${kind}_${n}_btn`), url);
      }
    }
    if (named.has("demo_note")) { // size the cards to the rows in use; hide a card with none
      const bottoms: number[] = [];
      for (const [kind, max] of Object.entries(ROW_KINDS)) {
        const used = Array.from({ length: max }, (_, i) => fields[`${kind}_${i + 1}_title`]).filter(Boolean).length;
        const card = named.get(`card_${kind}`);
        if (!card) continue;
        if (!used) { remove(card); remove(named.get(`${kind}_label`)); continue; }
        const geometry = xfrm(card), height = Math.round((0.65 + used * 1.12 + 0.12) * EMU_IN);
        geometry.ext.setAttribute("cy", String(height));
        bottoms.push(geometry.y + height);
      }
      if (bottoms.length) xfrm(named.get("demo_note")!).off.setAttribute("y", String(Math.max(...bottoms) + Math.round(0.14 * EMU_IN)));
    }

    linkShape(doc, rels, named.get("prisma_link_chip"), fields.prisma_url ?? "");
    linkFirstRun(doc, rels, named.get("csm_email"), fields.csm_email ?? "");

    zip.file(path, new XMLSerializer().serializeToString(doc));
    zip.file(relsPath, new XMLSerializer().serializeToString(rels));

    const notes = Array.from(rels.documentElement.children).find((rel) => rel.getAttribute("Type")?.endsWith("/notesSlide"));
    if (notes) { // speaker notes carry tokens too
      const notesPath = `ppt/${notes.getAttribute("Target")!.replace("../", "")}`;
      const notesDoc = new DOMParser().parseFromString(await zip.file(notesPath)!.async("string"), "application/xml");
      fillParagraphs(notesDoc.documentElement, fields);
      zip.file(notesPath, new XMLSerializer().serializeToString(notesDoc));
    }
  }

  let patched = types;
  for (const ext of usedExt) if (!new RegExp(`Extension="${ext}"`).test(patched)) patched = patched.replace("</Types>", `<Default Extension="${ext}" ContentType="image/${ext}"/></Types>`);
  zip.file("[Content_Types].xml", patched);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
}
