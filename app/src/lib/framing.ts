/** The card frame: catalogue cards, Top 10 tiles and submission previews show the thumbnail at 16:9. */
export const CARD_ASPECT = 16 / 9;
export const MAX_ZOOM = 4;
export const OUTPUT_WIDTH = 1920;
/** Below this many source pixels across the framed area, the card image looks soft. */
export const SHARP_WIDTH = 1280;
/** Detail screenshots wider than this are reduced on upload (aspect ratio kept), which also keeps them under the 5 MB limit. */
export const MAX_SCREENSHOT_WIDTH = 2560;

/** Zoom (1 = the image just covers the frame) and the frame centre as a fraction of the image. */
export type Framing = { zoom: number; cx: number; cy: number };

/** "Cover" scale at zoom 1: the image always fills the frame, so there are never empty bands. */
export function coverScale(imageWidth: number, imageHeight: number, frameWidth: number): number {
  return Math.max(frameWidth / imageWidth, frameWidth / CARD_ASPECT / imageHeight);
}

/** Keeps the frame inside the image: the centre can only move as far as the image extends. */
export function clampFraming(framing: Framing, imageWidth: number, imageHeight: number, frameWidth: number): Framing {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, framing.zoom));
  const scale = coverScale(imageWidth, imageHeight, frameWidth) * zoom;
  const halfX = frameWidth / 2 / (imageWidth * scale);
  const halfY = frameWidth / CARD_ASPECT / 2 / (imageHeight * scale);
  return { zoom, cx: Math.min(1 - halfX, Math.max(halfX, framing.cx)), cy: Math.min(1 - halfY, Math.max(halfY, framing.cy)) };
}

/** The size an uploaded screenshot is reduced to: never enlarged, never wider than `max`, same proportions. */
export function screenshotSize(width: number, height: number, max = MAX_SCREENSHOT_WIDTH): { width: number; height: number; reduced: boolean } {
  if (width <= max) return { width, height, reduced: false };
  return { width: max, height: Math.max(1, Math.round(height * max / width)), reduced: true };
}

/** The source rectangle (natural pixels) the frame shows, and the output size: never upscaled, at most OUTPUT_WIDTH wide. */
export function frameCrop(framing: Framing, imageWidth: number, imageHeight: number, frameWidth: number) {
  const { zoom, cx, cy } = clampFraming(framing, imageWidth, imageHeight, frameWidth);
  const width = frameWidth / (coverScale(imageWidth, imageHeight, frameWidth) * zoom);
  const height = width / CARD_ASPECT;
  const outputWidth = Math.max(1, Math.round(Math.min(OUTPUT_WIDTH, width)));
  return { x: cx * imageWidth - width / 2, y: cy * imageHeight - height / 2, width, height, outputWidth, outputHeight: Math.max(1, Math.round(outputWidth / CARD_ASPECT)) };
}
