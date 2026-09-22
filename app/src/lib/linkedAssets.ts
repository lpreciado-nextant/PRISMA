import type { AssetType } from "../types.ts";

export const LINK_ASSET_TYPES = ["Hosted web app (URL)", "Power Apps", "Power BI", "Desktop app or script"] as const satisfies readonly AssetType[];
export type LinkAssetType = typeof LINK_ASSET_TYPES[number];
export type LinkedAssetInput = { name: string; assetType: LinkAssetType; externalUrl: string; allowsEmbedding: boolean; embedHint: string };

export function validateLinkedAsset(input: LinkedAssetInput): LinkedAssetInput {
  const name = input.name.trim();
  const embedHint = input.embedHint.trim();
  if (!LINK_ASSET_TYPES.includes(input.assetType) || !name || name.length > 100 || [...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || embedHint.length > 200) throw new Error("Enter an asset name up to 100 characters and a note up to 200 characters.");
  if (input.assetType === "Desktop app or script") {
    if (input.externalUrl.trim() || input.allowsEmbedding) throw new Error("Desktop assets do not accept a web URL or embedding.");
    if (!embedHint) throw new Error("Describe how to arrange a demonstration with the builder.");
    return { name, assetType: input.assetType, externalUrl: "", allowsEmbedding: false, embedHint };
  }
  const externalUrl = input.externalUrl.trim();
  let url: URL;
  try { url = new URL(externalUrl); } catch { throw new Error("Enter a valid HTTPS URL."); }
  if (externalUrl.length > 2000 || [...externalUrl].some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || character === "\\" || /\s/.test(character)) || url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new Error("Use an HTTPS URL without credentials or spaces.");
  if (input.assetType !== "Hosted web app (URL)" && input.allowsEmbedding) throw new Error("Power Apps and Power BI must open in a new tab.");
  return { name, assetType: input.assetType, externalUrl, allowsEmbedding: input.allowsEmbedding, embedHint };
}