import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildHash, parseHash } from "./router.ts";

test("PRISMA routes parse with their query", () => {
  assert.equal(parseHash("").path, "/");
  assert.equal(parseHash("#/").path, "/");
  assert.equal(parseHash("#/help").path, "/help");
  const route = parseHash("#/review/abc/edit?x=1");
  assert.equal(route.path, "/review/abc/edit");
  assert.equal(route.query.get("x"), "1");
  assert.equal(parseHash(buildHash("/", { q: "invoice" })).query.get("q"), "invoice");
});

test("a host fragment that is not a PRISMA route opens the library, not Page unavailable", () => {
  // Mobile players and sign-in redirects can leave their own fragment in the URL.
  for (const hash of ["#code=abc&state=xyz", "#state=1", "#id_token=token", "#!", "#home", "#?route=x"]) {
    const route = parseHash(hash);
    assert.equal(route.path, "/", hash);
    assert.equal([...route.query].length, 0, hash);
  }
  // Unknown PRISMA paths still reach the app's own "Page unavailable".
  assert.equal(parseHash("#/nowhere").path, "/nowhere");
});
