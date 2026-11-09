import { lazy, Suspense, useEffect, useState } from "react";
import { Lightbox } from "../../src/components/Lightbox";
import type { Solution } from "../../src/types";
import { Icon } from "../../src/components/Icon";
import { LoadingState } from "../../src/components/LoadingState";
import { DetailView, GalleryFigure } from "../../src/views/DetailView";
import { navigate } from "../../src/lib/router";
import { publishedDetails, readRows, suggestionApi } from "./dataSource";
import { loadCapabilityOwner, type CapabilityOwner } from "./capabilityOwner";
import { useSolutionSuggestions } from "./useSolutionSuggestions";
import { mediaAsset, type PublishedDetail } from "./workflow";
import type { MediaItem } from "./media";
import { useMediaAction } from "./useMediaAction";
import { ProtectedImage } from "./ProtectedImage";
import { formatBytes } from "../../src/lib/attachmentFormats";
import { CopyLinkButton } from "./CopyLinkButton";
import { shareUrl, type AppLocation } from "./deepLink";
import { DownloadDeckButton } from "./DownloadDeckButton";
import { canExportDeck } from "../../src/lib/deckFields";
import { isCustomerSuccessLevel } from "../../src/lib/consultantLevel";
import { useAppUser } from "../../src/lib/powerContext";

const loadViewer = () => import("./DraftMediaEditor");
const MediaPreview = lazy(() => loadViewer().then(module => ({ default: module.MediaPreview })));

const button = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[14px]";

export function PublishedView({ solution, present, assetId, autoDownload = false, focused = false, favorite, appLocation }: { solution: Solution; present: boolean; assetId?: string; autoDownload?: boolean; focused?: boolean; favorite?: { saved: boolean; pending?: boolean; onToggle: () => void; saves?: number }; appLocation?: AppLocation }) {
  // The card's recent read renders at once; the fresh read below still decides access.
  const [detail, setDetail] = useState<PublishedDetail | null>(() => publishedDetails.peek(solution.id, present) ?? null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const user = useAppUser();
  const suggestions = useSolutionSuggestions(suggestionApi, solution.id, !present);
  // Internal only: never read in present mode. `undefined` hides the row (unknown); `null` shows "Not assigned".
  const capability = solution.capabilities?.[0];
  const [owner, setOwner] = useState<{ capability: string; value: CapabilityOwner | null | undefined }>();
  useEffect(() => {
    if (present || !capability) return;
    const controller = new AbortController();
    void loadCapabilityOwner(readRows, capability, controller.signal).then(value => { if (!controller.signal.aborted) setOwner({ capability, value }); }).catch(() => undefined);
    return () => controller.abort();
  }, [capability, present]);
  const capabilityOwner = !present && owner && owner.capability === capability ? owner.value : undefined;
  const mediaAction = useMediaAction(item => navigate(`/s/${solution.id}/demo/${item.id}`), { solutionId: solution.id, mode: present ? "present" : "published" });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => { controller.abort(); setError(true); }, 20_000);
    // Only a read started moments ago (a card's hover prefetch) is reused; anything older is read again.
    void publishedDetails.load(solution.id, present, 10_000).then(next => {
      controller.signal.throwIfAborted();
      // Unchanged content keeps its objects, so images already on screen do not reload.
      setDetail(current => current && JSON.stringify(current) === JSON.stringify(next) ? current : next);
    }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [solution.id, present, attempt]);
  // Fetch the viewer while the detail page is read, so opening an asset stays immediate.
  useEffect(() => { void loadViewer().catch(() => undefined); }, []);
  const asset = detail?.media.find(item => item.id === assetId);
  // "Open in new tab": the focused viewer for one demo, carrying present mode so that tab never shows internal fields.
  const demoTabUrl = (id: string) => appLocation && shareUrl(appLocation, `/s/${solution.id}/demo/${id}?focus=1${present ? "&present=1" : ""}`);
  if (error) return <section className="mx-auto max-w-[1100px] px-6 py-12" role="alert"><h1 className="text-[28px] font-semibold">Detail unavailable</h1><p className="my-4">The solution may have changed or your access may be insufficient.</p><button className={button} onClick={() => { setError(false); setDetail(null); setAttempt(current => current + 1); }}><Icon name="arrowRight" />Retry</button></section>;
  if (!detail) return <LoadingState variant="page" label="Loading solution..." />;
  if (assetId) return asset ? <Suspense fallback={<LoadingState variant="page" label="Loading viewer..." />}><MediaPreview item={asset} solutionId={solution.id} mode={present ? "present" : "published"} viewerTitle={solution.name} autoDownload={autoDownload} onClose={() => navigate(`/s/${solution.id}`)}
      focused={focused} newTabUrl={focused ? undefined : demoTabUrl(asset.id)} /></Suspense> : <section className="mx-auto max-w-[1340px] px-4 py-6"><p role="alert" className="mb-4">Asset unavailable.</p><button className={button} onClick={() => navigate(`/s/${solution.id}`)}><Icon name="chevronLeft" />Back to solution</button></section>;
  const hydrated: Solution = { ...solution, libraryNotes: present ? undefined : detail.libraryNotes, estimatedMinimumHours: present ? undefined : detail.estimatedMinimumHours, complexity: present ? undefined : detail.complexity, assets: detail.media.filter(item => item.kind === "attachment").map(mediaAsset), projects: present ? [] : detail.projects.map((projectName, index) => ({ id: String(index), projectName })) };
  const effort = detail;
  const thumbnail = detail.media.find(item => item.kind === "thumbnail" && item.complete);
  return <DetailView solution={hydrated} present={present} connected effort={effort} imageCount={detail.media.filter(item => item.kind === "image").length}
    favoritable={!!favorite} favorite={favorite}
    actions={!present && <>
      {appLocation && <CopyLinkButton appLocation={appLocation} route={`/s/${solution.id}`} />}
      {canExportDeck(solution) && <DownloadDeckButton solution={hydrated} media={detail.media} presenter={{ name: user.fullName, email: user.live ? user.userPrincipalName : undefined }}
        csm={effort.contributors.find(person => isCustomerSuccessLevel(person.level))}
        link={route => appLocation && shareUrl(appLocation, route)} />}
    </>}
    poster={thumbnail && <div className="h-full overflow-hidden"><ProtectedImage item={thumbnail} className="h-full w-full object-cover" /></div>}
    gallery={<PublishedGallery media={detail.media} />}
    panels={suggestions.panel}
    aside={suggestions.action}
    capabilityOwner={capabilityOwner}
    assetNewTabUrl={asset => demoTabUrl(asset.id)}
    reviewActions={mediaAction.downloading ? <LoadingState className="mt-4" label={mediaAction.message} /> : mediaAction.message && <p className="mt-4 text-[14px] text-(--ink-2)" role={mediaAction.failed ? "alert" : "status"}>{mediaAction.message}</p>}
    onAssetOpen={asset => void mediaAction.open(detail.media.find(item => item.id === asset.id))} />;
}

/** `details` adds each image's pixel size and weight (the contributor's preview, to check resolution); the published page leaves it off. */
export function PublishedGallery({ media, details = false }: { media: MediaItem[]; details?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = media.filter(item => item.kind === "image" && item.complete);
  return <>
    <div className="grid gap-3 sm:grid-cols-2">{images.map((item, index) => <PublishedImage key={item.id} item={item} details={details} onOpen={() => setOpen(index)} />)}</div>
    {open !== null && <Lightbox start={open} onClose={() => setOpen(null)} items={images.map(item => ({
      id: item.id, caption: item.caption, label: item.name,
      content: details ? <DetailedImage item={item} className="max-h-full max-w-full object-contain" /> : <ProtectedImage item={item} className="max-h-full max-w-full object-contain" />,
      thumb: <ProtectedImage item={item} className="h-full w-full object-cover" />,
    }))} />}
  </>;
}

/** An image with its pixel size and weight in a corner chip. */
function DetailedImage({ item, className, fill = false }: { item: MediaItem; className: string; fill?: boolean }) {
  const [size, setSize] = useState<{ key: string; width: number; height: number } | null>(null);
  const key = `${item.id}:${item.sessionId}`;
  const known = size?.key === key ? size : null;
  return <span className={fill ? "relative block h-full w-full" : "relative inline-flex max-h-full max-w-full"}>
    <ProtectedImage item={item} className={className} onLoad={(width, height) => setSize({ key, width, height })} />
    <span className="pointer-events-none absolute right-2 bottom-2 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] text-(--ink)" style={{ background: "color-mix(in srgb, var(--ground) 80%, transparent)" }}>{known ? `${known.width} × ${known.height} px · ` : ""}{formatBytes(item.size)}</span>
  </span>;
}

function PublishedImage({ item, onOpen, details }: { item: MediaItem; onOpen: () => void; details: boolean }) {
  return <GalleryFigure caption={item.caption}><button className="group relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden" onClick={onOpen} aria-label={`View ${item.caption || item.name} larger`}>{details ? <DetailedImage fill item={item} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <ProtectedImage item={item} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}</button></GalleryFigure>;
}
