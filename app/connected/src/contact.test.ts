import assert from "node:assert/strict";
import test from "node:test";
import { contactLinks, PRISMA_CONTACTS } from "./contact.ts";

test("contact links reach every contact, prefilled with where the person was", () => {
  const page = "https://apps.powerapps.com/play/e/env/app/id?route=%2Fs%2Fabc";
  const { teams, email } = contactLinks(PRISMA_CONTACTS, page);
  const chat = new URL(teams);
  assert.equal(chat.origin + chat.pathname, "https://teams.microsoft.com/l/chat/0/0");
  assert.equal(chat.searchParams.get("users"), "lpreciado@nextant.com,jcastelblanco@nextant.com");
  assert.match(chat.searchParams.get("message")!, new RegExp(`Page: ${page.replace(/[.?]/g, "\\$&")}`));
  assert(email.startsWith("mailto:lpreciado@nextant.com,jcastelblanco@nextant.com?subject="));
  const body = new URLSearchParams(email.split("?")[1]).get("body")!;
  assert.match(body, /What happened/);
  assert.match(body, /What did you expect/);
  assert(body.includes(`Page: ${page}`));
});

test("without a page the links still work and carry no empty page line", () => {
  const { teams, email } = contactLinks([{ name: "A", email: "a@example.com" }]);
  assert.equal(new URL(teams).searchParams.get("message"), "Hi! I have a question about PRISMA.");
  assert.doesNotMatch(decodeURIComponent(email), /Page:/);
});
