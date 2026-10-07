// Loaded only when a CSM asks for a presentation: JSZip and the templates stay out of the detail page's bundle.
import darkTemplate from "../../src/assets/deck/PRISMA_Template_Dark.potx?url";
import lightTemplate from "../../src/assets/deck/PRISMA_Template_Light.potx?url";
import type { Solution } from "../../src/types";
import { assetPurpose } from "../../src/lib/assetPurpose";
import { buildDeckFields, deckFileName, MAX_SHOTS, type DeckDemo, type DeckVariant } from "../../src/lib/deckFields";
import { fillDeckTemplate, type DeckImage } from "../../src/lib/deckTemplate";
import { downloadMedia } from "./dataSource";
import type { MediaItem } from "./media";
import { mediaAsset } from "./workflow";

export interface DeckRequest {
  solution: Solution;
  media: MediaItem[];
  presenter: { name: string; email?: string };
  csm?: { name: string; email?: string };
  /** Builds the PRISMA link for a route; demo links reopen the asset in PRISMA (Nextant sign-in required). */
  link: (route: string) => string | undefined;
  variant: DeckVariant;
  signal: AbortSignal;
}

/** What the row's button does: a video plays, HTML and links open, any other file downloads. */
function demoAction(item: MediaItem): "Play" | "Open" | "Download" {
  if (item.linkedAsset) return "Open"; // links are hosted apps, Power Apps, Power BI or desktop demos
  return item.mime.startsWith("video/") ? "Play" : item.mime === "text/html" ? "Open" : "Download";
}

/** A readable demo title: the caption, else the file name without its extension (decision log: demo titles). */
const demoTitle = (item: MediaItem) => item.caption?.trim() || item.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim();

async function deckImage(item: MediaItem, solutionId: string, signal: AbortSignal): Promise<DeckImage | undefined> {
  try {
    const blob = await downloadMedia(item, { solutionId, mode: "published", signal });
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    if (blob.type === "image/png" || blob.type === "image/jpeg") {
      bitmap.close();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height, ext: blob.type === "image/png" ? "png" : "jpeg" };
    }
    // PowerPoint does not read every web format (WebP, AVIF); those are redrawn as PNG.
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    return png ? { bytes: new Uint8Array(await png.arrayBuffer()), width, height, ext: "png" } : undefined;
  } catch {
    if (signal.aborted) throw signal.reason;
    return undefined; // a missing image leaves its glass frame empty rather than failing the deck
  }
}

export async function downloadSolutionDeck({ solution, media, presenter, csm, link, variant, signal }: DeckRequest): Promise<string> {
  const ready = media.filter(item => item.complete).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const demos = (purpose: "Demo video" | "Interactive demo" | "Supporting material"): DeckDemo[] => ready
    .filter(item => (item.kind === "attachment" || item.linkedAsset) && assetPurpose(mediaAsset(item, 0)) === purpose)
    .map(item => {
      const action = demoAction(item);
      return { title: demoTitle(item), action, url: link(`/s/${solution.id}/demo/${item.id}${action === "Download" ? "?download=1" : ""}`) };
    });
  const fields = buildDeckFields({
    solution, presenter, csm,
    prismaUrl: link(`/s/${solution.id}`) ?? "",
    videos: demos("Demo video"),
    interactives: demos("Interactive demo"),
    supporting: demos("Supporting material"),
  });

  const thumbnail = ready.find(item => item.kind === "thumbnail");
  const shots = ready.filter(item => item.kind === "image").slice(0, MAX_SHOTS);
  const slots: [string, MediaItem | undefined][] = [["cover_image", thumbnail ?? shots[0]], ["feature_image", shots[0] ?? thumbnail], ...shots.map((item, index): [string, MediaItem] => [`shot_${index + 1}`, item])];
  const unique = new Map<string, Promise<DeckImage | undefined>>();
  const images: Record<string, DeckImage> = {};
  await Promise.all(slots.map(async ([key, item]) => {
    if (!item) return;
    if (!unique.has(item.id)) unique.set(item.id, deckImage(item, solution.id, signal));
    const image = await unique.get(item.id);
    if (image) images[key] = image;
  }));

  const template = await fetch(variant === "dark" ? darkTemplate : lightTemplate, { signal }).then(response => {
    if (!response.ok) throw new Error("Presentation template unavailable.");
    return response.arrayBuffer();
  });
  const deck = await fillDeckTemplate(template, fields, images);
  signal.throwIfAborted();
  const name = deckFileName(solution, variant);
  const url = URL.createObjectURL(deck);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return name;
}
