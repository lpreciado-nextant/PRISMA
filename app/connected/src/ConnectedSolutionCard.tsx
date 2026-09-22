import { useEffect, useRef, useState } from "react";
import { SolutionCard } from "../../src/components/SolutionCard";
import type { Solution } from "../../src/types";
import { workflowApi, readRows } from "./dataSource";
import { loadSubmissionCardDetails, parsePublished } from "./workflow";
import type { MediaItem } from "./media";
import { ProtectedImage } from "./ProtectedImage";

export function ConnectedSolutionCard({ solution, present, index, owned = false, onOpen }: { solution: Solution; present: boolean; index: number; owned?: boolean; onOpen?: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<{ media: MediaItem[]; names: string[]; technologies?: string[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
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
          const detail = parsePublished(await workflowApi.published(solution.id, present), solution.id, present);
          controller.signal.throwIfAborted();
          setDetails({ media: detail.media, names: detail.contributors.map(person => person.name) });
        }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { clearTimeout(timeout); }
    };
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(); } }, { rootMargin: "100px" });
    if (container.current) observer.observe(container.current);
    return () => { controller.abort(); clearTimeout(timeout); observer.disconnect(); };
  }, [solution.id, present, owned]);
  const thumbnail = details?.media.find(item => item.kind === "thumbnail" && item.complete);
  return <div ref={container} className="grid min-w-0">
    <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet", technologies: details?.technologies ?? solution.technologies }} present={present} index={index} onOpen={onOpen} showPublicationStatus={owned} catalogueOnly={!owned} contributorNames={details?.names}
      poster={thumbnail && <div className="h-36 overflow-hidden"><ProtectedImage key={thumbnail.id} item={thumbnail} className="h-full w-full object-cover" /></div>} />
    {error && <p role="status" className="mt-2 text-[12px] text-(--ink-2)">Card details unavailable.</p>}
  </div>;
}