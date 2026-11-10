import { useEffect, useRef, useState } from "react";
import { LoadingState } from "../../src/components/LoadingState";

/**
 * A PDF drawn page by page on canvases from the bytes already downloaded. The code-app host's CSP allows `blob:` for media only, so a
 * PDF in a frame is blocked there; this needs only the same-origin worker. Nothing in the file runs: pdf.js reads it as data, with
 * `eval` and scripting off.
 */
export function PdfPages({ blob, name, className = "" }: { blob: Blob; name: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const target = host.current;
    if (!target) return;
    let cancelled = false;
    let destroy: (() => Promise<void>) | undefined;
    target.replaceChildren();
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        destroy = () => task.destroy();
        const pdf = await task.promise;
        if (cancelled) return;
        for (let number = 1; number <= pdf.numPages && !cancelled; number++) {
          const page = await pdf.getPage(number);
          const fit = Math.max(320, target.clientWidth - 16) / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: fit * Math.min(window.devicePixelRatio || 1, 2) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mx-auto mb-3 block h-auto max-w-full bg-white shadow-md";
          canvas.style.width = `${canvas.width / Math.min(window.devicePixelRatio || 1, 2)}px`;
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${name}, page ${number} of ${pdf.numPages}`);
          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
          target.append(canvas);
          if (number === 1) setState("ready");
        }
      } catch { if (!cancelled) setState("error"); }
    })();
    return () => { cancelled = true; void destroy?.().catch(() => undefined); };
  }, [blob, name]);
  return <div className={`relative ${className}`}>
    {state === "loading" && <LoadingState variant="media" className="h-full w-full" label="Loading preview..." />}
    {state === "error" && <p role="alert" className="p-6 text-center">This PDF can't be previewed. Use Download to open it.</p>}
    {/* The scrollable page stack takes focus so the keyboard can scroll it. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
    <div ref={host} role="region" aria-label={`${name} preview`} tabIndex={0} className={`h-full overflow-auto p-2 ${state === "ready" ? "" : "hidden"}`} />
  </div>;
}
