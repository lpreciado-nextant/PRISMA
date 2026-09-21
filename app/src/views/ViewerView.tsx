import { useCallback, useEffect } from "react";
import type { DemoAsset, Solution } from "../types";
import { AREAS } from "../data/solutions";
import { Icon } from "../components/Icon";
import { demoSrcDoc } from "../lib/demoDoc";
import { navigate } from "../lib/router";

export function ViewerView({
  solution,
  asset,
  present,
}: {
  solution: Solution;
  asset: DemoAsset;
  present: boolean;
}) {
  const close = useCallback(() => navigate(`/s/${solution.id}`), [solution.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="animate-scale-in mx-auto flex h-[calc(100vh-5rem)] w-full max-w-[1340px] flex-col px-4 pt-4 pb-6 sm:px-6">
      <div className="glass glass-sheen mb-3 flex items-center gap-3 rounded-[16px] px-4 py-2.5">
        <button
          type="button"
          onClick={close}
          className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}
        >
          <Icon name="chevronLeft" size={15} />
          {solution.name}
        </button>
        <span className="hidden font-mono text-[10.5px] tracking-[0.12em] uppercase sm:block" style={{ color: "var(--ink-3)" }}>
          {asset.assetType}
        </span>
        {asset.externalUrl && (
          <a
            href={asset.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
            style={{ fontFamily: "var(--font-display)", borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}
          >
            Pop out
            <Icon name="external" size={13} />
          </a>
        )}
        <button
          type="button"
          onClick={close}
          aria-label="Close the viewer"
          className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg ${asset.externalUrl ? "" : "ml-auto"}`}
          style={{ color: "var(--ink-3)" }}
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {asset.embedHint && !present && (
        <p className="mb-3 px-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          {asset.embedHint}
        </p>
      )}

      <div className="glass glass-lite relative flex-1 overflow-hidden rounded-[20px]">
        <Stage solution={solution} asset={asset} />
      </div>
    </div>
  );
}

function Stage({ solution, asset }: { solution: Solution; asset: DemoAsset }) {
  const accent = AREAS[solution.specializationArea].cssVar;

  if (asset.assetType === "Self-contained HTML file") {
    return (
      <iframe
        title={`${solution.name} demo`}
        srcDoc={asset.htmlContent !== undefined ? restrictHtml(asset.htmlContent) : demoSrcDoc(solution, resolveColor(accent))}
        // No allow-same-origin: an uploaded asset must never reach the host app.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="h-full w-full border-0"
      />
    );
  }

  if (asset.assetType === "Hosted web app (URL)" && asset.allowsEmbedding && asset.externalUrl) {
    return (
      <iframe
        title={`${solution.name} live app`}
        src={asset.externalUrl}
        sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        referrerPolicy="no-referrer"
        className="h-full w-full border-0"
      />
    );
  }

  if (asset.assetType === "Video walkthrough only") {
    if (asset.fileData) return <video controls className="h-full w-full" src={asset.fileData} aria-label={asset.name} />;
    return <VideoStage name={solution.name} />;
  }

  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">Not runnable in-app</p>
        <h2 className="mt-3 text-[22px] font-semibold">This one needs the builder</h2>
        <p className="mx-auto mt-2 max-w-[42ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
          {asset.embedHint ?? "Request a live demo and the builder will walk the client through it."}
        </p>
      </div>
    </div>
  );
}

function restrictHtml(content: string): string {
  const document = new DOMParser().parseFromString(content, "text/html");
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  document.head.prepend(policy);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

function VideoStage({ name }: { name: string }) {
  return (
    <div className="relative grid h-full place-items-center" style={{ background: "color-mix(in srgb, var(--ground-2) 70%, transparent)" }}>
      <div className="text-center">
        <span
          className="mx-auto grid h-16 w-16 place-items-center rounded-full"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <Icon name="play" size={24} />
        </span>
        <p className="mt-4 text-[16px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          {name} — walkthrough
        </p>
        <p className="mt-1 font-mono text-[10.5px] tracking-[0.12em] uppercase" style={{ color: "var(--ink-3)" }}>
          Video streams from the Dataverse File column
        </p>
      </div>
      <div
        className="absolute inset-x-6 bottom-6 h-1 rounded-full"
        style={{ background: "color-mix(in srgb, var(--ink) 16%, transparent)" }}
      >
        <div className="h-full w-1/3 rounded-full" style={{ background: "var(--accent)" }} />
      </div>
    </div>
  );
}

/** The iframe document can't read our CSS variables, so resolve to a literal. */
function resolveColor(cssVar: string): string {
  const name = cssVar.match(/var\((--[\w-]+)\)/)?.[1];
  if (!name) return cssVar;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#7fb6d9";
}
