import { strict as assert } from "node:assert";
import { test } from "node:test";
import { estimateLines } from "./deckTemplate.ts";

// A 6.4 in (460.8 pt) box, Aptos bold.
test("estimateLines wraps words and splits words longer than a line", () => {
  assert.equal(estimateLines("POC Forge", 460.8, 50, true), 1);
  assert.equal(estimateLines("Agent Factory", 460.8, 50, true), 1);
  assert.equal(estimateLines("Agent Factory Hub Pro", 460.8, 50, true), 2);
  // Capitals count wider: the same letters in upper case need another line.
  assert.equal(estimateLines("Agent factory hub", 460.8, 50, true), 1);
  assert.equal(estimateLines("AGENT FACTORY HUB", 460.8, 50, true), 2);
  assert.equal(estimateLines("Intelligent Document Processing", 460.8, 50, true), 3);
  assert.equal(estimateLines("Intelligent Document Processing", 460.8, 36, true), 2);
  assert.equal(estimateLines("A".repeat(40), 460.8, 50, true), 3);
  assert.equal(estimateLines("one\ntwo", 460.8, 50, true), 2);
});

test("a filled deck links every demo row, labels its button and leaves no tokens", async () => {
  const { DOMParser, XMLSerializer } = await import("@xmldom/xmldom");
  Object.assign(globalThis, { DOMParser, XMLSerializer });
  const { readFileSync } = await import("node:fs");
  const JSZip = (await import("jszip")).default;
  const { fillDeckTemplate } = await import("./deckTemplate.ts");
  const fields = {
    area_name: "AI & Automation", maturity_label: "Live", solution_title: "Test", tagline: "Tagline", presenter_name: "Ana",
    description: "Does things.", business_value: "Value.", tech_1: "Azure", cta_headline: "Next", prisma_href: "https://prisma/s/1", library_href: "https://prisma/", csm_initials: "A",
    csm_name: "Ana", csm_email: "ana@nextant.com", video_1_title: "Walkthrough", video_1_url: "https://prisma/v1", video_1_action: "Play",
    interactive_1_title: "Live demo", interactive_1_url: "https://prisma/i1", interactive_1_action: "Open",
    supporting_1_title: "One-pager", supporting_1_url: "https://prisma/s1?download=1", supporting_1_action: "Download",
  };
  for (const variant of ["Dark", "Light"]) {
    const template = readFileSync(new URL(`../assets/deck/PRISMA_Template_${variant}.potx`, import.meta.url));
    const deck = await JSZip.loadAsync(await (await fillDeckTemplate(template, fields, {})).arrayBuffer());
    const slide = await deck.file("ppt/slides/slide5.xml")!.async("string");
    const rels = await deck.file("ppt/slides/_rels/slide5.xml.rels")!.async("string");
    for (const [kind, url, label] of [["video", "https://prisma/v1", "PLAY  ↗"], ["interactive", "https://prisma/i1", "OPEN  ↗"], ["supporting", "https://prisma/s1?download=1", "DOWNLOAD  ↓"]]) {
      for (const part of ["title", "btn_text"]) {
        const shape = new RegExp(`<p:sp>(?:(?!</p:sp>).)*name="row_${kind}_1_${part}"(?:(?!</p:sp>).)*</p:sp>`, "s").exec(slide)?.[0] ?? "";
        const rId = /hlinkClick[^>]*r:id="(rId\d+)"/.exec(shape)?.[1];
        assert.ok(rId, `${variant}: row_${kind}_1_${part} has a link`);
        assert.ok(rels.includes(`Id="${rId}"`) && rels.includes(url.replace("&", "&amp;")), `${variant}: ${kind} links ${url}`);
        if (part === "btn_text") assert.ok(shape.includes(`>${label}<`), `${variant}: ${kind} button reads ${label}`);
      }
    }
    for (let n = 1; n <= 6; n++) assert.ok(!/\{\{/.test(await deck.file(`ppt/slides/slide${n}.xml`)!.async("string")), `${variant}: slide ${n} has no tokens left`);
    // Rows without a title go; "Explore the Library" opens the library.
    assert.ok(!slide.includes('name="row_video_2_title"') && !slide.includes('name="row_interactive_2_title"'), `${variant}: unused rows removed`);
    const last = await deck.file("ppt/slides/slide6.xml")!.async("string"), lastRels = await deck.file("ppt/slides/_rels/slide6.xml.rels")!.async("string");
    assert.ok(/name="library_link"><a:hlinkClick/.test(last), `${variant}: library link`);
    assert.ok(lastRels.includes('Target="https://prisma/"'), `${variant}: library link target`);
    assert.ok(last.includes(">A<"), `${variant}: contact initials`);
  }
});
