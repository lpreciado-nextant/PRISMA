import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "../../src/components/Icon";
import type { DeckVariant } from "../../src/lib/deckFields";
import type { DeckRequest } from "./solutionDeck";

const pill = "glass inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-transform duration-200 hover:scale-105 disabled:cursor-wait disabled:opacity-60";
const pillStyle = { fontFamily: "var(--font-display)", color: "var(--ink-2)" };
const VARIANT_KEY = "prisma.deck.variant";

/** The CSM's last choice, else the app theme. Browser storage is only a convenience and may be unavailable. */
function preferredVariant(): DeckVariant {
  try {
    const stored = localStorage.getItem(VARIANT_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch { /* storage blocked: fall back to the theme */ }
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Downloads the solution as a PRISMA × Nextant presentation. Render it only for exportable solutions (`canExportDeck`). */
export function DownloadDeckButton(request: Omit<DeckRequest, "variant" | "signal">) {
  const [choosing, setChoosing] = useState(false);
  const [state, setState] = useState<{ busy?: boolean; message?: string; failed?: boolean }>({});
  const lifetime = useRef<AbortController | null>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => { if (choosing) firstChoice.current?.focus(); }, [choosing]);

  const download = async (variant: DeckVariant) => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setChoosing(false);
    try { localStorage.setItem(VARIANT_KEY, variant); } catch { /* not remembered; nothing else changes */ }
    setState({ busy: true, message: "Preparing presentation..." });
    try {
      const { downloadSolutionDeck } = await import("./solutionDeck");
      const name = await downloadSolutionDeck({ ...request, variant, signal });
      if (!signal.aborted) setState({ message: `Download started: ${name}` });
    } catch {
      if (!signal.aborted) setState({ failed: true, message: "Presentation unavailable. Check your connection and try again." });
    }
  };

  const order: DeckVariant[] = preferredVariant() === "light" ? ["light", "dark"] : ["dark", "light"];
  const hintId = useId();
  return <>
    {choosing
      ? <span role="group" aria-label="Presentation theme" aria-describedby={hintId} className="inline-flex flex-wrap items-center gap-2">
          {order.map((variant, index) => <button key={variant} ref={index === 0 ? firstChoice : undefined} type="button" className={pill} style={pillStyle} onClick={() => void download(variant)}>
            <Icon name="download" size={15} />{variant === "dark" ? "Dark" : "Light"}
          </button>)}
          <button type="button" className={pill} style={pillStyle} onClick={() => setChoosing(false)}>Cancel</button>
          <span id={hintId} className="basis-full text-[12.5px]" style={{ color: "var(--ink-3)" }}>PowerPoint, 6 slides with speaker notes. Press F5 to present; demo links open PRISMA and need a Nextant sign-in.</span>
        </span>
      : <button type="button" className={pill} style={pillStyle} disabled={state.busy} aria-busy={state.busy} onClick={() => setChoosing(true)}>
          <Icon name="download" size={15} />{state.busy ? "Preparing..." : "Download presentation"}
        </button>}
    <span className={state.failed ? "basis-full text-[13px]" : "sr-only"} style={{ color: "var(--ink-2)" }} role={state.failed ? "alert" : "status"}>{state.message ?? ""}</span>
  </>;
}
