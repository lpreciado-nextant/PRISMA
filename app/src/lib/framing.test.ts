import assert from "node:assert/strict";
import test from "node:test";
import { CARD_ASPECT, clampFraming, frameCrop } from "./framing.ts";

const near = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("at zoom 1 a wide image is cropped to the full height, centred", () => {
  const crop = frameCrop({ zoom: 1, cx: 0.5, cy: 0.5 }, 4000, 1000, 640);
  near(crop.height, 1000);
  near(crop.width, 1000 * CARD_ASPECT);
  near(crop.x, (4000 - crop.width) / 2);
  near(crop.y, 0);
});

test("zooming in halves the crop and keeps its centre", () => {
  const crop = frameCrop({ zoom: 2, cx: 0.5, cy: 0.5 }, 1920, 1080, 640);
  near(crop.width, 960);
  near(crop.height, 540);
  near(crop.x + crop.width / 2, 960);
  near(crop.y + crop.height / 2, 540);
});

test("the frame can't leave the image, whatever the pan", () => {
  for (const framing of [{ zoom: 1, cx: -3, cy: 9 }, { zoom: 3, cx: 0, cy: 1 }, { zoom: 9, cx: 2, cy: -1 }]) {
    const crop = frameCrop(framing, 3000, 2000, 700);
    assert(crop.x >= -1e-6 && crop.y >= -1e-6, JSON.stringify(crop));
    assert(crop.x + crop.width <= 3000 + 1e-6 && crop.y + crop.height <= 2000 + 1e-6, JSON.stringify(crop));
  }
  assert.equal(clampFraming({ zoom: 99, cx: 0.5, cy: 0.5 }, 3000, 2000, 700).zoom, 4);
});

test("output keeps 16:9, is never upscaled and is capped at 1920 wide", () => {
  const small = frameCrop({ zoom: 1, cx: 0.5, cy: 0.5 }, 800, 450, 640);
  assert.equal(small.outputWidth, 800);
  assert.equal(small.outputHeight, 450);
  const large = frameCrop({ zoom: 1, cx: 0.5, cy: 0.5 }, 6000, 4000, 640);
  assert.equal(large.outputWidth, 1920);
  assert.equal(large.outputHeight, 1080);
});
