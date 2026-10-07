#!/usr/bin/env python3
"""
Fill a PRISMA × Nextant solution template (.potx / .pptx) with a solution's data.

    python3 fill_prisma_template.py PRISMA_Template_Dark.potx solution.json out.pptx

solution.json  = { "fields": { "solution_title": "...", ... },
                   "images": { "cover_image": "path.png", ... } }
See PRISMA_Field_Map.md for every field. Requires: pip install python-pptx
"""
import copy, io, json, re, sys, zipfile
from pptx import Presentation
from pptx.util import Emu
from pptx.oxml.ns import qn
from PIL import Image

TOKEN = re.compile(r"\{\{\s*([a-z0-9_]+)\s*\}\}")
PALETTES = {  # same values as the PRISMA app tokens
    "dark":  {"ai": "7FB6D9", "data": "4FBFAB", "ibo": "A99AE6", "live": "5FD3A2", "proto": "E0B860", "idea": "9BB0BF"},
    "light": {"ai": "1C567C", "data": "0B6157", "ibo": "57468C", "live": "0B6145", "proto": "7C5408", "idea": "5B6B77"},
}
AREA_KEY = {"ai & automation": "ai", "data solutions": "data", "intelligent business operations": "ibo"}
MATURITY_KEY = {"live": "live", "working prototype": "proto", "idea / concept": "idea"}
LINKS = {"prisma_link_chip": "prisma_href", "prisma_link": "prisma_href"}  # whole chip is clickable, text on top too
TEXT_LINKS = {"csm_email": "csm_email"}  # text run becomes a link
ROW_KINDS = {"video": 3, "interactive": 2, "supporting": 3}  # demo rows: video_N_title / video_N_url ...


def open_template(path):
    """python-pptx refuses .potx — flip the content type in memory."""
    zin = zipfile.ZipFile(path)
    theme = zin.read("ppt/theme/theme1.xml").decode("utf8", "ignore")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in zin.namelist():
            data = zin.read(name)
            if name == "[Content_Types].xml":
                data = data.replace(b"presentationml.template.main+xml", b"presentationml.presentation.main+xml")
            zout.writestr(name, data)
    buf.seek(0)
    return Presentation(buf), ("dark" if "PRISMA Dark" in theme else "light")


def set_color(shape_el, hexcolor, fills=True, lines=True, text=False):
    """Change colours in place so transparency children (alpha) are preserved."""
    for clr in shape_el.iter(qn("a:srgbClr")):
        parent = clr.getparent().getparent().tag  # solidFill -> (spPr|ln|rPr)
        tag = parent.split("}")[1]
        if (tag == "spPr" and fills) or (tag == "ln" and lines) or (tag in ("rPr", "defRPr") and text):
            clr.set("val", hexcolor)


def shapes_by_name(slide):
    return {s.name: s for s in slide.shapes}


def para_text(p):
    return "".join(r.text for r in p.runs)


def set_para_text(p, text):
    runs = p.runs
    if not runs:
        return
    runs[0].text = text
    for r in runs[1:]:
        r._r.getparent().remove(r._r)


def fill_text_frame(tf, fields, drop_empty=False):
    for p in list(tf.paragraphs):
        txt = para_text(p)
        if not TOKEN.search(txt):
            continue
        if drop_empty and not any(fields.get(k) for k in TOKEN.findall(txt)):  # notes list optional demos line by line
            p._p.getparent().remove(p._p)
            continue
        m = TOKEN.fullmatch(txt.strip())
        val = fields.get(m.group(1)) if m else None
        if m and isinstance(val, list):  # list field -> one paragraph per item (keeps bullets)
            items = [str(v) for v in val if str(v).strip()] or [""]
            for item in reversed(items[1:]):
                clone = copy.deepcopy(p._p)
                p._p.addnext(clone)
            paras = tf.paragraphs
            idx = [i for i, q in enumerate(paras) if q._p is p._p][0]
            for k, item in enumerate(items):
                set_para_text(paras[idx + k], item)
            continue
        set_para_text(p, TOKEN.sub(lambda mm: str(fields.get(mm.group(1), "") if not isinstance(fields.get(mm.group(1)), list) else "\n".join(fields[mm.group(1)])), txt))


def add_picture_cover(slide, frame, image_path):
    """Insert image cropped to cover the frame's bbox (rounded look comes from the frame behind it)."""
    x, y, w, h = frame.left, frame.top, frame.width, frame.height
    pic = slide.shapes.add_picture(image_path, x, y, w, h)
    iw, ih = Image.open(image_path).size
    box, img = w / h, iw / ih
    if img > box:
        c = (1 - box / img) / 2; pic.crop_left = pic.crop_right = c
    else:
        c = (1 - img / box) / 2; pic.crop_top = pic.crop_bottom = c
    # round the corners to match the glass frame
    geom = pic._element.spPr.find(qn("a:prstGeom"))
    geom.set("prst", "roundRect")
    av = geom.find(qn("a:avLst"))
    if av is None:
        av = geom.makeelement(qn("a:avLst"), {}); geom.append(av)
    gd = av.makeelement(qn("a:gd"), {"name": "adj", "fmla": "val 6000"}); av.append(gd)
    pic.name = frame.name.replace("img_", "picture_")
    return pic


def spread_cards(named):
    """Cards without rows are gone; the remaining ones share the full width (buttons stay on the right edge)."""
    kinds = [k for k in ROW_KINDS if f"card_{k}" in named]
    present = [k for k in kinds if named[f"card_{k}"]._element.getparent() is not None]
    if len(kinds) < 2 or len(present) == len(kinds) or not present:
        return
    cards = [named[f"card_{k}"] for k in kinds]
    left, right = cards[0].left, cards[-1].left + cards[-1].width
    gap = cards[1].left - (cards[0].left + cards[0].width)
    width = int((right - left - gap * (len(present) - 1)) / len(present))
    for i, k in enumerate(present):
        card = named[f"card_{k}"]
        dx, dw = left + i * (width + gap) - card.left, width - card.width
        for nm, shp in named.items():
            if shp._element.getparent() is None or not (nm in (f"card_{k}", f"{k}_label") or nm.startswith(f"row_{k}_")):
                continue
            right_anchored = nm.endswith("_btn") or nm.endswith("_btn_text")
            shp.left = Emu(shp.left + dx + (dw if right_anchored else 0))
            if not right_anchored and not nm.endswith(("_icon", "_play")):
                shp.width = Emu(shp.width + dw)


def main(template, data_json, out):
    prs, mode = open_template(template)
    data = json.load(open(data_json, encoding="utf8"))
    fields, images = data.get("fields", {}), data.get("images", {})
    pal = PALETTES[mode]
    area = pal.get(AREA_KEY.get(fields.get("area_name", "").lower(), ""), None)
    mat = pal.get(MATURITY_KEY.get(fields.get("maturity_label", "").lower(), ""), None)

    for slide in prs.slides:
        named = shapes_by_name(slide)
        # recolour badges by area / maturity
        if area:
            for n in ("badge_area", "area_dot"):
                if n in named: set_color(named[n]._element, area)
            if "badge_area_text" in named: set_color(named["badge_area_text"]._element, area, text=True, fills=False, lines=False)
        if mat:
            for n in ("badge_maturity", "maturity_dot"):
                if n in named: set_color(named[n]._element, mat)
            if "badge_maturity_text" in named: set_color(named["badge_maturity_text"]._element, mat, text=True, fills=False, lines=False)
        # images
        for key, frame in [(n[4:], s) for n, s in named.items() if n.startswith("img_") and not n.endswith("_label")]:
            label = named.get(f"img_{key}_label")
            if key in images and images[key]:
                add_picture_cover(slide, frame, images[key])
                frame._element.getparent().remove(frame._element)
                if label is not None: label._element.getparent().remove(label._element)
            elif key.startswith("shot_"):
                frame._element.getparent().remove(frame._element)  # unused screenshot slot disappears
                if label is not None: label._element.getparent().remove(label._element)
            elif label is not None:
                label._element.getparent().remove(label._element)  # keep a clean empty glass frame
        # text
        for shp in list(slide.shapes):
            if shp.has_text_frame:
                fill_text_frame(shp.text_frame, fields)
        # drop unused technology chips
        for i in range(1, 9):
            t, c = named.get(f"tech_{i}"), named.get(f"tech_chip_{i}")
            if t is not None and not t.text_frame.text.strip():
                t._element.getparent().remove(t._element)
                if c is not None: c._element.getparent().remove(c._element)
        # demo rows: drop unused rows, link the button of used ones
        for kind, mx in ROW_KINDS.items():
            for n in range(1, mx + 1):
                if f"row_{kind}_{n}" not in named:
                    continue
                title, url = fields.get(f"{kind}_{n}_title", ""), fields.get(f"{kind}_{n}_url", "")
                if not title:
                    for nm, shp in named.items():
                        if nm.startswith(f"row_{kind}_{n}"):
                            shp._element.getparent().remove(shp._element)
                elif url:  # the label text box sits over the button and takes the click, so both carry the link
                    for part in ("btn", "btn_text"):
                        if f"row_{kind}_{n}_{part}" in named:
                            named[f"row_{kind}_{n}_{part}"].click_action.hyperlink.address = url if url.startswith("http") else "https://" + url
        # size demo cards to the rows in use; hide a card with no rows
        if "demo_note" in named:
            bottoms = []
            for kind, mx in ROW_KINDS.items():
                used = sum(1 for n in range(1, mx + 1) if fields.get(f"{kind}_{n}_title"))
                card_shp = named.get(f"card_{kind}")
                if card_shp is None: continue
                if used == 0:
                    for nm, shp in list(named.items()):
                        if nm == f"card_{kind}" or nm == f"{kind}_label":
                            shp._element.getparent().remove(shp._element)
                else:
                    card_shp.height = Emu(int((0.65 + used * 0.9 + 0.14) * 914400))  # first row, row pitch, padding
                    bottoms.append(card_shp.top + card_shp.height)
            if bottoms:
                named["demo_note"].top = max(bottoms) + Emu(int(0.14 * 914400))
            spread_cards(named)
        # hyperlinks (chips are clickable shapes so text colour stays readable on the filled chip)
        def to_url(val):
            return val if val.startswith(("http", "mailto:")) else ("mailto:" + val if "@" in val else "https://" + val)
        for shape_name, field in LINKS.items():
            shp, val = named.get(shape_name), fields.get(field, "")
            if shp is not None and val:
                shp.click_action.hyperlink.address = to_url(val)
        for shape_name, field in TEXT_LINKS.items():
            shp, val = named.get(shape_name), fields.get(field, "")
            if shp is not None and shp.has_text_frame and val and shp.text_frame.paragraphs[0].runs:
                shp.text_frame.paragraphs[0].runs[0].hyperlink.address = to_url(val)
        # speaker notes
        if slide.has_notes_slide:
            fill_text_frame(slide.notes_slide.notes_text_frame, fields, drop_empty=True)

    prs.save(out)
    left = [m for s in prs.slides for sh in s.shapes if sh.has_text_frame for m in TOKEN.findall(sh.text_frame.text)]
    print(f"saved {out} ({mode} variant)" + (f" — unfilled tokens: {sorted(set(left))}" if left else ""))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
