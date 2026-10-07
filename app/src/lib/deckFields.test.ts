import { strict as assert } from "node:assert";
import { test } from "node:test";
import { SOLUTIONS } from "../data/solutions.ts";
import { buildDeckFields, canExportDeck, deckFileName, deckImageKeys, DeckNotExportableError, fit } from "./deckFields.ts";
import type { Solution } from "../types.ts";

const base = SOLUTIONS.find((solution) => canExportDeck(solution)) ?? SOLUTIONS[0];
const input = { presenter: { name: "Ana Pérez" }, prismaUrl: "https://prisma.nextant.com/#/s/1", now: new Date("2026-10-07T12:00:00Z") };

test("only published, Cleared solutions export", () => {
  const cleared: Solution = { ...base, clientSafeReviewed: true, publicationStatus: "Published", status: "Working prototype" };
  assert.equal(canExportDeck(cleared), true);
  assert.equal(canExportDeck({ ...cleared, clientSafeReviewed: false }), false);
  assert.equal(canExportDeck({ ...cleared, publicationStatus: "Draft" }), false);
  assert.throws(() => buildDeckFields({ ...input, solution: { ...cleared, clientSafeReviewed: false } }), DeckNotExportableError);
});

test("export never carries effort, builders, cost or client names", () => {
  const solution: Solution = { ...base, clientSafeReviewed: true, publicationStatus: "Published", status: "Working prototype", clientContext: "ACME Corp secret", estimatedCost: 987654, libraryNotes: "internal note" };
  const dump = JSON.stringify(buildDeckFields({ ...input, solution }));
  for (const contributor of solution.contributors) assert.ok(!dump.includes(contributor.builtBy.name), contributor.builtBy.name);
  assert.ok(!dump.includes("ACME Corp secret") && !dump.includes("987654") && !dump.includes("internal note"));
  assert.ok(!/hours|effort/i.test(Object.keys(buildDeckFields({ ...input, solution })).join(" ")));
});

test("fields respect template limits and fall back by slot", () => {
  const solution: Solution = { ...base, name: "N".repeat(80), summary: "word ".repeat(100), technologies: Array.from({ length: 12 }, (_, i) => `Tech ${i}`), clientSafeReviewed: true, publicationStatus: "Published", status: "Live in production" };
  const fields = buildDeckFields({ ...input, solution, videos: [{ title: "Walkthrough", url: "https://x" }, { title: " " }], interactives: [] });
  assert.ok(fields.solution_title.length <= 30 && fields.tagline.length <= 170 && fields.tagline.endsWith("…"));
  assert.equal(fields.maturity_label, "Live");
  assert.equal(fields.tech_8, "Tech 7");
  assert.equal(fields.tech_9, undefined);
  assert.equal(fields.video_1_title, "Walkthrough");
  assert.equal(fields.video_2_title, undefined);
  const withSupporting = buildDeckFields({ ...input, solution, supporting: [{ title: "One-pager", url: "https://s1" }, { title: "Deck" }, { title: "FAQ" }, { title: "Extra" }] });
  assert.equal(withSupporting.supporting_1_url, "https://s1");
  assert.equal(withSupporting.supporting_3_title, "FAQ");
  assert.equal(withSupporting.supporting_4_title, undefined);
  assert.equal(fields.presentation_date, "OCTOBER 2026");
  assert.equal(fields.prisma_url, "prisma.nextant.com/#/s/1");
});

test("image keys and file names", () => {
  const keys = deckImageKeys({ thumbnail: "t", images: Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, src: `s${i}` })) });
  assert.deepEqual(keys.map((k) => k.key), ["cover_image", "feature_image", "shot_1", "shot_2", "shot_3", "shot_4", "shot_5", "shot_6"]);
  assert.equal(deckFileName({ name: "POC Forge: v2" }, "light"), "PRISMA-POC-Forge-v2-Light.pptx");
  assert.equal(fit("short", 10), "short");
});
