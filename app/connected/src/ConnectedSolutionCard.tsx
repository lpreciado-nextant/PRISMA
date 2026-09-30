import { useEffect, useRef, useState } from "react";
import { SolutionCard } from "../../src/components/SolutionCard";
import type { Solution } from "../../src/types";
import { workflowApi, readRows, publishedDetails } from "./dataSource";
import { loadSubmissionCardDetails, type PublishedDetail } from "./workflow";
import type { MediaItem } from "./media";
import { ProtectedImage } from "./ProtectedImage";
import { Poster } from "../../src/components/Poster";

type CardDetails = { media: MediaItem[]; names: string[]; technologies?: string[] };
// Present mode never exposes builder names on cards.
const publishedCard = (detail: PublishedDetail, present: boolean): CardDetails => ({ media: detail.media, names: present ? [] : detail.contributors.map(person => person.name) });
const publishedThumbnail = (detail: PublishedDetail | undefined) => detail?.media.find(item => item.kind === "thumbnail" && item.complete) ?? null;

export function ConnectedSolutionCard({ solution, present, index, owned = false, onOpen, favorite, thumbnail: known }: { solution: Solution; present: boolean; index: number; owned?: boolean; onOpen?: () => void; favorite?: { saved: boolean; pending?: boolean; onToggle: () => void }; thumbnail?: MediaItem | null }) {
  const container = useRef<HTMLDivElement>(null);
  const intent = useRef<number | undefined>(undefined);
  // The catalogue graph's thumbnail (or its confirmed absence) replaces the per-card detail read.
  const graphed = !owned && known !== undefined;
  const [details, setDetails] = useState<CardDetails | null>(() => {
    const cached = owned || graphed ? undefined : publishedDetails.peek(solution.id, present);
    return cached ? publishedCard(cached, present) : null;
  });
  const [error, setError] = useState(false);
  useEffect(() => {
    if (graphed) return;
    const controller = new AbortController();
    let started = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (started) return;
      started = true;
      timeout = setTimeout(() => { controller.abort(); setError(true); }, 20_000);
      try {
        if (owned) {
          const detail = await loadSubmissionCardDetails(workflowApi, readRows, solution.id, controller.signal);
          controller.signal.throwIfAborted();
          setDetails(detail);
        } else {
          const detail = await publishedDetails.load(solution.id, present);
          controller.signal.throwIfAborted();
          setDetails(publishedCard(detail, present));
        }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { clearTimeout(timeout); }
    };
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(); } }, { rootMargin: "100px" });
    if (container.current) observer.observe(container.current);
    return () => { controller.abort(); clearTimeout(timeout); observer.disconnect(); };
  }, [solution.id, present, owned, graphed]);
  const thumbnail = graphed ? known : details?.media.find(item => item.kind === "thumbnail" && item.complete);
  // Warm the detail page's read while the pointer rests on a card or focus reaches it.
  const prefetch = () => { void publishedDetails.load(solution.id, present).catch(() => undefined); };
  return <div ref={container} className="grid min-w-0" {...(owned ? {} : {
    onPointerEnter: () => { window.clearTimeout(intent.current); intent.current = window.setTimeout(prefetch, 150); },
    onPointerLeave: () => window.clearTimeout(intent.current),
    onFocus: prefetch,
  })}>
    <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet", technologies: details?.technologies ?? solution.technologies }} present={present} index={index} onOpen={onOpen} showPublicationStatus={owned} catalogueOnly={!owned} contributorNames={details?.names}
      favoritable={!owned && !present && !!favorite} favorite={favorite}
      poster={thumbnail && <div className="h-full overflow-hidden"><ProtectedImage key={thumbnail.id} item={thumbnail} className="h-full w-full object-cover" /></div>} />
    {error && <p role="status" className="mt-2 text-[12px] text-(--ink-2)">Card details unavailable.</p>}
  </div>;
}
/** Protected published thumbnail for a Top 10 tile; the generated poster stands in until it loads or when there is none. */
export function PublishedThumbnail({ solution, thumbnail: known }: { solution: Solution; thumbnail?: MediaItem | null }) {
  const container = useRef<HTMLSpanElement>(null);
  const graphed = known !== undefined;
  const [loaded, setLoaded] = useState<MediaItem | null>(() => graphed ? null : publishedThumbnail(publishedDetails.peek(solution.id, false)));
  useEffect(() => {
    if (graphed) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      timeout = setTimeout(() => controller.abort(), 20_000);
      void publishedDetails.load(solution.id, false).then(detail => {
        if (!controller.signal.aborted) setLoaded(publishedThumbnail(detail));
      }).catch(() => undefined).finally(() => clearTimeout(timeout));
    };
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, { rootMargin: "100px" });
    if (container.current) observer.observe(container.current);
    return () => { controller.abort(); clearTimeout(timeout); observer.disconnect(); };
  }, [solution.id, graphed]);
  const thumbnail = graphed ? known : loaded;
  return <span ref={container} className="block h-full w-full">
    {thumbnail ? <ProtectedImage key={thumbnail.id} item={thumbnail} className="h-full w-full object-cover" /> : <Poster id={solution.id} name={solution.name} area={solution.specializationArea} className="h-full w-full" />}
  </span>;
}
