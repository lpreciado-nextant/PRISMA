import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import type { DeckVariant } from "../../src/lib/deckFields";
import type { DeckRequest } from "./solutionDeck";

const pill = "glass inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-transform duration-200 hover:scale-105 disabled:cursor-wait disabled:opacity-60";
const pillStyle = { fontFamily: "var(--font-display)", color: "var(--ink-2)" };
/** The last theme someone downloaded, offered first next time. A per-viewer convenience: absent or blocked storage is fine. */
const PREFERENCE_KEY = "prisma.deck.variant";
const VARIANTS: Record<DeckVariant, { title: string; hint: string; ground: string; ink: string }> = {
  dark: { title: "Dark", hint: "Best on screens and video calls", ground: "#0f1b24", ink: "#e9eff4" },
  light: { title: "Light", hint: "Best for projectors and print", ground: "#f6f8fa", ink: "#1c567c" },
};

function rememberedVariant(): DeckVariant | undefined {
  try {
    const value = localStorage.getItem(PREFERENCE_KEY);
    return value === "dark" || value === "light" ? value : undefined;
  } catch { return undefined; }
}

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; name: string } | { kind: "failed"; variant: DeckVariant };

/**
 * Downloads the solution as a PRISMA × Nextant presentation. Render it only for exportable solutions (`canExportDeck`).
 * A menu offers both themes with what each suits, the suggested one first (last choice, else the app's theme); the
 * button then shows progress, a visible confirmation, or the error with a retry.
 */
export function DownloadDeckButton(request: Omit<DeckRequest, "variant" | "signal">) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const lifetime = useRef<AbortController | null>(null);
  const wrapper = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  // The menu takes focus on open and closes on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    items.current[0]?.focus();
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  // The confirmation fades back to the normal label after a few seconds.
  useEffect(() => {
    if (status.kind !== "done") return;
    const timer = window.setTimeout(() => setStatus({ kind: "idle" }), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const download = async (variant: DeckVariant) => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setOpen(false);
    try { localStorage.setItem(PREFERENCE_KEY, variant); } catch { void 0; }
    setStatus({ kind: "busy" });
    try {
      const { downloadSolutionDeck } = await import("./solutionDeck");
      const name = await downloadSolutionDeck({ ...request, variant, signal });
      if (!signal.aborted) setStatus({ kind: "done", name });
    } catch {
      if (!signal.aborted) setStatus({ kind: "failed", variant });
    }
  };

  const theme: DeckVariant = typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const suggested = rememberedVariant() ?? theme;
  const order: DeckVariant[] = suggested === "light" ? ["light", "dark"] : ["dark", "light"];
  const busy = status.kind === "busy";
  const onMenuKey = (event: React.KeyboardEvent) => {
    const index = items.current.findIndex(item => item === document.activeElement);
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      items.current[(index + (event.key === "ArrowDown" ? 1 : -1) + order.length) % order.length]?.focus();
    } else if (event.key === "Tab") setOpen(false);
  };

  return <>
    <span ref={wrapper} className="relative inline-flex">
      <button ref={trigger} type="button" className={pill} style={status.kind === "done" ? { ...pillStyle, color: "var(--live)" } : pillStyle}
        disabled={busy} aria-busy={busy} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined}
        title={status.kind === "done" ? status.name : undefined} onClick={() => setOpen(!open)}>
        {busy ? <Icon name="refresh" size={15} className="animate-spin" /> : <Icon name={status.kind === "done" ? "check" : "download"} size={15} />}
        {busy ? "Preparing presentation..." : status.kind === "done" ? "Downloaded" : "Download presentation"}
        {!busy && status.kind !== "done" && <Icon name="chevronDown" size={13} />}
      </button>
      {open && <div className="absolute top-full left-0 z-30 mt-2 w-[18rem] rounded-xl border p-1.5 shadow-lg"
        style={{ background: "var(--ground)", borderColor: "var(--glass-edge)", color: "var(--ink)" }}>
        <div id={`${id}-menu`} role="menu" aria-label="Presentation theme" tabIndex={-1} onKeyDown={onMenuKey}>
        {order.map((variant, index) => {
          const option = VARIANTS[variant];
          return <button key={variant} ref={element => { items.current[index] = element; }} type="button" role="menuitem"
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-(--glass-edge) focus-visible:bg-(--glass-edge) focus-visible:outline-none"
            onClick={() => void download(variant)}>
            {/* A tiny slide in the theme's colours. */}
            <span aria-hidden="true" className="grid h-9 w-14 shrink-0 content-center gap-1 rounded-md border px-2" style={{ background: option.ground, borderColor: "var(--glass-edge)" }}>
              <span className="h-1 w-7 rounded-full" style={{ background: option.ink }} />
              <span className="h-1 w-10 rounded-full opacity-50" style={{ background: option.ink }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[14px] font-semibold">{option.title}
                {index === 0 && <span className="rounded-full px-1.5 py-px text-[10.5px] font-semibold" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}>Suggested</span>}
              </span>
              <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>{option.hint}</span>
            </span>
          </button>;
        })}
        </div>
        <p className="mt-1 flex items-start gap-1.5 border-t border-(--glass-edge) px-2.5 pt-2 pb-1 text-[12px]" style={{ color: "var(--ink-3)" }}>
          <Icon name="shield" size={12} className="mt-0.5 shrink-0" />Client-safe: no internal hours or contributor names.
        </p>
      </div>}
    </span>
    {status.kind === "done" && <span className="max-w-[16rem] truncate text-[12.5px]" style={{ color: "var(--ink-3)" }} title={status.name}>{status.name}</span>}
    <span className={status.kind === "failed" ? "flex basis-full flex-wrap items-center gap-2 text-[13px]" : "sr-only"} style={{ color: "var(--ink-2)" }} role={status.kind === "failed" ? "alert" : "status"}>
      {status.kind === "busy" ? "Preparing presentation..." : status.kind === "done" ? `Download started: ${status.name}` : status.kind === "failed" ? "Presentation unavailable. Check your connection and try again." : ""}
      {status.kind === "failed" && <button type="button" className="cursor-pointer font-semibold" style={{ color: "var(--accent)" }} onClick={() => void download(status.variant)}>Try again</button>}
    </span>
  </>;
}
