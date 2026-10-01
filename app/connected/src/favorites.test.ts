import assert from "node:assert/strict";
import test from "node:test";
import { loadTopFavorites, TOP_FAVORITES, type FavoriteApi } from "./favorites.ts";

const signal = () => new AbortController().signal;
const id = (value: number) => `${String(value).padStart(8, "0")}-0000-0000-0000-000000000000`;
function api(result: unknown, success = true): FavoriteApi {
  const reply = async () => ({ success, data: { ResultJson: JSON.stringify(result) } });
  return { list: reply, set: reply, top: reply };
}

test("top favorites keep the server's rank order and lowercase the ids", async () => {
  const upper = "AAAAAAAA-0000-0000-0000-000000000000";
  assert.deepEqual(await loadTopFavorites(api({ solutionIds: [id(3), upper, id(1)] }), signal()), [{ id: id(3) }, { id: upper.toLowerCase() }, { id: id(1) }]);
  assert.deepEqual(await loadTopFavorites(api({ solutionIds: [] }), signal()), []);
});

test("top favorites carry how many people saved each solution", async () => {
  assert.deepEqual(await loadTopFavorites(api({ solutionIds: [id(2), id(1)], saves: [7, 3] }), signal()), [{ id: id(2), saves: 7 }, { id: id(1), saves: 3 }]);
  for (const saves of [[7], [7, 0], [7, 1.5], "7,3"]) {
    await assert.rejects(loadTopFavorites(api({ solutionIds: [id(2), id(1)], saves }), signal()), /top favorites/);
  }
});

test("top favorites reject malformed, duplicated or oversized rankings", async () => {
  for (const solutionIds of [undefined, ["not-a-guid"], [id(1), id(1)], Array.from({ length: TOP_FAVORITES + 1 }, (_, index) => id(index + 1))]) {
    await assert.rejects(loadTopFavorites(api({ solutionIds }), signal()), /top favorites/);
  }
  await assert.rejects(loadTopFavorites(api({ solutionIds: [] }, false), signal()), /did not confirm/);
});
