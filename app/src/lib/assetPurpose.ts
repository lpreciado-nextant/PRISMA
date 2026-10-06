import type { AssetType, DemoAsset, Solution } from "../types.ts";

/** `nx_demoasset.nx_assetpurpose` (ADR-0011): what an asset is for, independent of its format. */
export const ASSET_PURPOSES = ["Demo video", "Interactive demo", "Supporting material"] as const;
export type AssetPurpose = typeof ASSET_PURPOSES[number];

/** The purposes a CSM filters the library by. */
export const DEMO_KINDS = ["Demo video", "Interactive demo"] as const satisfies readonly AssetPurpose[];
export type DemoKind = typeof DEMO_KINDS[number];

/** Same mapping as the plug-in's default: video is a demo video, HTML and links are interactive, documents are supporting. */
export function defaultPurpose(type: AssetType): AssetPurpose {
  return type === "Video walkthrough only" ? "Demo video" : type === "Client-ready one-pager / slide" ? "Supporting material" : "Interactive demo";
}

/** A demo video must be a video, an interactive demo HTML or a link; anything may be supporting material. */
export function purposeAllows(purpose: AssetPurpose, type: AssetType): boolean {
  return purpose === "Supporting material" || (purpose === "Demo video" ? type === "Video walkthrough only" : type !== "Video walkthrough only" && type !== "Client-ready one-pager / slide");
}

export const assetPurpose = (asset: Pick<DemoAsset, "assetType" | "purpose">): AssetPurpose => asset.purpose ?? defaultPurpose(asset.assetType);

/** The demo kinds a solution offers: the catalogue's counts when it has them, otherwise its loaded assets. */
export function solutionDemos(solution: Pick<Solution, "demoKinds" | "assets">): DemoKind[] {
  if (solution.demoKinds) return solution.demoKinds;
  const purposes = new Set(solution.assets.map(assetPurpose));
  return DEMO_KINDS.filter(kind => purposes.has(kind));
}
