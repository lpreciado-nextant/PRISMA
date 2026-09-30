import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import { shareUrl, type AppLocation } from "./deepLink";

export function CopyLinkButton({ appLocation, route }: { appLocation: AppLocation; route: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const url = shareUrl(appLocation, route);
  useEffect(() => {
    if (state === "manual") field.current?.focus();
    if (state !== "copied") return;
    const timer = window.setTimeout(() => setState("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [state]);
  if (!url) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      // The player's frame can withhold clipboard access; the link is then offered for manual copying.
      setState("manual");
    }
  };
  return <>
    <button type="button" onClick={() => void copy()} className="ml-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "var(--glass-edge)" }}>
      <Icon name={state === "copied" ? "check" : "link"} />{state === "copied" ? "Link copied" : "Copy link"}
    </button>
    <span className="sr-only" role="status">{state === "copied" ? "Link copied to the clipboard." : ""}</span>
    {state === "manual" && <div className="mt-3 max-w-[640px]">
      <label htmlFor={fieldId} className="block text-[13px]" style={{ color: "var(--ink-2)" }}>Copy this link to share the solution</label>
      <input id={fieldId} ref={field} readOnly value={url} onFocus={event => event.currentTarget.select()}
        className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-[12.5px]" style={{ borderColor: "var(--glass-edge)" }} />
    </div>}
  </>;
}
