import { useEffect, useState } from "react";
import type { Solution } from "../../src/types";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { DetailView, GalleryFigure } from "../../src/views/DetailView";
import { navigate } from "../../src/lib/router";
import { workflowApi } from "./dataSource";
import { mediaAsset, parsePublished, type PublishedDetail } from "./workflow";
import { MediaPreview } from "./DraftMediaEditor";
import type { MediaItem } from "./media";
import { useMediaAction } from "./useMediaAction";
import { ProtectedImage } from "./ProtectedImage";
import { contributorCredit } from "./draftGraph";
import { MATURITY_OPTIONS } from "./drafts";

const button = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px]";

export function PublishedView({ solution, present, assetId, favorite }: { solution: Solution; present: boolean; assetId?: string; favorite?: { saved: boolean; pending?: boolean; onToggle: () => void } }) {
  const [detail, setDetail] = useState<PublishedDetail | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mediaAction = useMediaAction(item => navigate(`/s/${solution.id}/demo/${item.id}`));
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { controller.abort(); setError(true); }, 20_000);
    void workflowApi.published(solution.id, present).then(result => {
      controller.signal.throwIfAborted();
      setDetail(parsePublished(result, solution.id, present));
    }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [solution.id, present, attempt]);
  const asset = detail?.media.find(item => item.id === assetId);
  if (error) return <section className="mx-auto max-w-[1100px] px-6 py-12" role="alert"><h1 className="text-[28px] font-semibold">Detail unavailable</h1><p className="my-4">The solution may have changed or your access may be insufficient.</p><button className={button} onClick={() => { setError(false); setDetail(null); setAttempt(current => current + 1); }}><Icon name="arrowRight" />Retry</button></section>;
  if (!detail) return <LoadingState variant="page" label="Loading solution..." />;
  if (assetId) return asset ? <MediaPreview item={asset} solutionId={solution.id} mode={present ? "present" : "published"} viewerTitle={solution.name} onClose={() => navigate(`/s/${solution.id}`)} /> : <section className="mx-auto max-w-[1340px] px-4 py-6"><p role="alert" className="mb-4">Asset unavailable.</p><button className={button} onClick={() => navigate(`/s/${solution.id}`)}><Icon name="chevronLeft" />Back to solution</button></section>;
  const hydrated: Solution = { ...solution, libraryNotes: present ? undefined : detail.libraryNotes, assets: detail.media.filter(item => item.kind === "attachment").map(mediaAsset), projects: present ? [] : detail.projects.map((projectName, index) => ({ id: String(index), projectName })) };
  const maturity = MATURITY_OPTIONS.find(option => option.label === solution.status)!.value;
  const effort = { ...detail, contributors: detail.contributors.map(person => person.effort ? contributorCredit(person.effort, maturity, person.name, person.hours, person.email) : person) };
  const thumbnail = detail.media.find(item => item.kind === "thumbnail" && item.complete);
  return <DetailView solution={hydrated} present={present} connected effort={effort} imageCount={detail.media.filter(item => item.kind === "image").length}
    favoritable={!!favorite} favorite={favorite}
    poster={thumbnail && <div className="h-40 overflow-hidden sm:h-52"><ProtectedImage item={thumbnail} className="h-full w-full object-cover" /></div>}
    gallery={<PublishedGallery media={detail.media} onOpen={item => navigate(`/s/${solution.id}/demo/${item.id}`)} />}
    reviewActions={mediaAction.downloading ? <LoadingState className="mt-4" label={mediaAction.message} /> : mediaAction.message && <p className="mt-4 text-[14px] text-(--ink-2)" role={mediaAction.failed ? "alert" : "status"}>{mediaAction.message}</p>}
    onAssetOpen={asset => void mediaAction.open(detail.media.find(item => item.id === asset.id))} />;
}

export function PublishedGallery({ media, onOpen }: { media: MediaItem[]; onOpen: (item: MediaItem) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{media.filter(item => item.kind === "image" && item.complete).map(item => <PublishedImage key={item.id} item={item} onOpen={() => onOpen(item)} />)}</div>;
}

function PublishedImage({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  return <GalleryFigure caption={item.caption}><button className="relative block aspect-[16/10] w-full cursor-pointer overflow-hidden" onClick={onOpen} aria-label={`Open ${item.name}`}><ProtectedImage item={item} className="h-full w-full object-cover" /></button></GalleryFigure>;
}