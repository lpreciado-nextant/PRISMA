import { strict as assert } from "node:assert";
import { test } from "node:test";
import { favoritesSnapshot, toggleFavorite } from "./favorites.ts";

test("favorites save newest first, never duplicate, and un-save removes the row", () => {
  for (const id of ["a", "b", "a", "a", "c"]) toggleFavorite(id);
  assert.deepEqual(favoritesSnapshot(), ["c", "a", "b"]);
  toggleFavorite("b");
  assert.deepEqual(favoritesSnapshot(), ["c", "a"]);
});
