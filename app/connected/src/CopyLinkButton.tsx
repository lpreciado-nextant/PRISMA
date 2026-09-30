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
    <button type="button" onClick={() => void copy()} className="glass inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-transform duration-200 hover:scale-105" style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}>
      <Icon name={state === "copied" ? "check" : "link"} size={15} />{state === "copied" ? "Link copied" : "Copy link"}
    </button>
    <span className="sr-only" role="status">{state === "copied" ? "Link copied to the clipboard." : ""}</span>
    {state === "manual" && <div className="mt-1 basis-full max-w-[640px]">
      <label htmlFor={fieldId} className="block text-[13px]" style={{ color: "var(--ink-2)" }}>Copy this link to share the solution</label>
      <input id={fieldId} ref={field} readOnly value={url} onFocus={event => event.currentTarget.select()}
        className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-[12.5px]" style={{ borderColor: "var(--glass-edge)" }} />
    </div>}
  </>;
}
