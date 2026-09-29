import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export type LightboxItem = {
  id: string;
  caption?: string;
  /** Alternative text when there is no caption. */
  label: string;
  /** The image itself, sized to fit (object-contain). */
  content: ReactNode;
  /** Small version for the filmstrip; falls back to `content`. */
  thumb?: ReactNode;
};

/**
 * Full-screen screenshot viewer: one image at a time with previous/next arrows,
 * keyboard (← → Home End Esc), swipe, a counter, the caption and a filmstrip.
 * Clicking the backdrop closes it. Built on a modal <dialog> for focus handling.
 */
export function Lightbox({ items, start, onClose }: { items: LightboxItem[]; start: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLOListElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(() => Math.min(Math.max(start, 0), items.length - 1));
  const count = items.length;
  const item = items[index];

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    element?.showModal();
    close.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const active = strip.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: smooth ? "smooth" : "auto" });
  }, [index]);

  if (!item) return null;
  const go = (next: number) => setIndex((next + count) % count);

  return (
    <dialog
      ref={dialog}
      aria-label={`Screenshot ${index + 1} of ${count}`}
      aria-describedby={item.caption ? "lightbox-caption" : undefined}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        const keys: Record<string, () => void> = { ArrowLeft: () => go(index - 1), ArrowRight: () => go(index + 1), Home: () => setIndex(0), End: () => setIndex(count - 1) };
        if (count > 1 && keys[event.key]) { event.preventDefault(); keys[event.key](); }
      }}
      className="lightbox"
    >
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-6">
        <span className="font-mono text-[12px] tracking-[0.12em]" style={{ color: "var(--ink-2)" }} aria-live="polite">{index + 1} / {count}</span>
        <p id="lightbox-caption" className="min-w-0 flex-1 truncate text-center text-[15px]" style={{ color: "var(--ink)" }}>{item.caption}</p>
        <button ref={close} type="button" onClick={onClose} aria-label="Close screenshots" title="Close (Esc)" className="glass grid size-10 shrink-0 cursor-pointer place-items-center rounded-full"><Icon name="close" size={17} /></button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-20"
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        onPointerDown={(event) => { swipe.current = { x: event.clientX, y: event.clientY }; }}
        onPointerUp={(event) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from || count < 2) return;
          const dx = event.clientX - from.x;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(event.clientY - from.y)) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        <figure key={item.id} className="lightbox-stage animate-scale-in" aria-label={item.caption || item.label}>{item.content}</figure>
        {count > 1 && <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous screenshot" className="lightbox-arrow left-3 sm:left-6"><Icon name="chevronLeft" size={22} /></button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next screenshot" className="lightbox-arrow right-3 sm:right-6"><Icon name="chevronRight" size={22} /></button>
        </>}
      </div>

      {count > 1 && (
        <ol ref={strip} className="lightbox-strip" aria-label="All screenshots">
          {items.map((entry, position) => (
            <li key={entry.id} data-index={position}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Show screenshot ${position + 1}${entry.caption ? `: ${entry.caption}` : ""}`}
                aria-current={position === index ? "true" : undefined}
                className="lightbox-thumb"
              >
                {entry.thumb ?? entry.content}
              </button>
            </li>
          ))}
        </ol>
      )}
    </dialog>
  );
}
