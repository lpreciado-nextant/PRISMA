import assert from "node:assert/strict";
import test from "node:test";
import { routeHash, shareUrl } from "./deepLink.ts";

const solution = "3e16f641-b8b6-f111-aaac-6045bd049fba";
const asset = "1c2c5786-b8b6-f111-aaac-6045bd049fba";
const ids = { appId: "cffbecd7-c927-474e-b6ed-6c7957ec74cb", environmentId: "ce09ad9b-57d1-e5df-9400-8ce973c86213", tenantId: "d232b207-f86f-4fba-8891-ccbf30b12898" };

test("deep links map known routes to normalized hashes", () => {
  assert.equal(routeHash(`/s/${solution}`), `#/s/${solution}`);
  assert.equal(routeHash(`#/s/${solution.toUpperCase()}/demo/${asset}`), `#/s/${solution}/demo/${asset}`);
  assert.equal(routeHash(`/s/${solution}/demo/${asset}?download=1`), `#/s/${solution}/demo/${asset}?download=1`);
  assert.equal(routeHash(`/s/${solution}?download=1`), `#/s/${solution}`, "only a demo route carries the download request");
  assert.equal(routeHash(`/submission/${solution}`), `#/submission/${solution}`);
  assert.equal(routeHash(`/review/${solution}`), `#/review/${solution}`);
  for (const page of ["/review", "/my-submissions", "/favorites", "/submit"]) assert.equal(routeHash(page), `#${page}`);
  assert.equal(routeHash(`/submit?draft=${solution.toUpperCase()}`), `#/submit?draft=${solution}`);
  assert.equal(routeHash("/?q=power+bi&area=data&tech=Fabric~Power%20BI&junk=1"), "#/?q=power+bi&area=data&tech=Fabric%7EPower+BI");
  assert.equal(routeHash("/?area=unknown"), "#/");
  assert.equal(routeHash(""), "#/");
});

test("deep links reject unknown, malformed or oversized routes", () => {
  for (const route of [undefined, "s/" + solution, "/s/not-a-guid", `/s/${solution}/demo/x`, `/review/${solution}/demo/${asset}`, `/submission/${solution}/extra`,
    "/admin", "//evil.example", "javascript:alert(1)", `/submit?draft=x`, `/?q=${"a".repeat(2000)}`]) {
    assert.equal(routeHash(route), undefined, String(route));
  }
});

test("share links use the host's player URL and replace any earlier route or version pin", () => {
  const appUrl = `https://apps.powerapps.com/play/e/${ids.environmentId}/app/${ids.appId}?tenantId=${ids.tenantId}&hint=abc&sourcetime=1790801715255&route=%2Ffavorites#/old`;
  const url = new URL(shareUrl({ ...ids, appUrl }, `#/s/${solution}`)!);
  assert.equal(url.origin + url.pathname, `https://apps.powerapps.com/play/e/${ids.environmentId}/app/${ids.appId}`);
  assert.equal(url.searchParams.get("route"), `/s/${solution}`);
  assert.equal(url.searchParams.get("tenantId"), ids.tenantId);
  assert.equal(url.searchParams.get("hint"), "abc");
  assert.equal(url.searchParams.has("sourcetime"), false);
  assert.equal(url.hash, "");
  assert.equal(new URL(shareUrl({ ...ids, appUrl }, "#/")!).searchParams.has("route"), false);
});

test("share links fall back to the published player address and never use a non-player app URL", () => {
  const expected = `https://apps.powerapps.com/play/e/${ids.environmentId}/app/${ids.appId}?tenantId=${ids.tenantId}&route=%2Fs%2F${solution}`;
  assert.equal(shareUrl(ids, `/s/${solution}`), expected);
  for (const appUrl of ["https://example.powerplatformusercontent.com/index.html", "http://apps.powerapps.com/play/e/x/app/y", "not a url"]) {
    assert.equal(shareUrl({ ...ids, appUrl }, `/s/${solution}`), expected);
  }
  assert.equal(shareUrl({ ...ids, appId: "local" }, `/s/${solution}`), undefined);
  assert.equal(shareUrl({ environmentId: ids.environmentId }, `/s/${solution}`), undefined);
  assert.equal(shareUrl(ids, "/admin"), undefined);
});
