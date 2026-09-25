import type { DemoAsset, Solution } from "../types";
import { AREAS } from "../data/catalogueMetadata";
import { demoSrcDoc } from "../lib/demoDoc";
import { navigate } from "../lib/router";
import { ViewerFrame } from "../components/ViewerFrame";
import { DemoStage } from "../components/DemoStage";
import { resolveColor } from "../lib/color";

export function ViewerView({
  solution,
  asset,
  present,
  backPath,
}: {
  solution: Solution;
  asset: DemoAsset;
  present: boolean;
  backPath?: string;
}) {
  const accent = AREAS[solution.specializationArea].cssVar;
  const fallbackHtml = asset.assetType === "Self-contained HTML file" && asset.htmlContent === undefined ? demoSrcDoc(solution, resolveColor(accent)) : undefined;
  return <ViewerFrame name={solution.name} kind={asset.assetType} externalUrl={asset.externalUrl} hint={present ? undefined : asset.embedHint} onClose={() => navigate(backPath ?? `/s/${solution.id}`)}><DemoStage solution={solution} asset={asset} fallbackHtml={fallbackHtml} /></ViewerFrame>;
}
