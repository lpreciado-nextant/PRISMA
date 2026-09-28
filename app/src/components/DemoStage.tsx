import type { DemoAsset, Solution } from "../types";
import { Icon } from "./Icon";
import { VideoPlayer } from "./ViewerFrame";

/**
 * Renders a demo asset's own content in the sandboxed stage. Shared by the full-screen
 * viewer and the detail page's inline "Main demo" panel. `fallbackHtml` stands in for a
 * missing self-contained HTML payload (the PoC mock catalogue supplies one); the connected
 * app never needs it because every real asset carries its uploaded `htmlContent`.
 */
export function DemoStage({ solution, asset, fallbackHtml }: { solution: Solution; asset: DemoAsset; fallbackHtml?: string }) {
  if (asset.assetType === "Self-contained HTML file") {
    return (
      <iframe
        title={`${solution.name} demo`}
        srcDoc={asset.htmlContent !== undefined ? restrictHtml(asset.htmlContent) : fallbackHtml}
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
    if (asset.fileData) return <VideoPlayer key={asset.fileData} className="h-full w-full" src={asset.fileData} name={asset.name} />;
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
