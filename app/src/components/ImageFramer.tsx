import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Icon } from "./Icon";
import { CARD_ASPECT, MAX_ZOOM, clampFraming, coverScale, frameCrop, type Framing } from "../lib/framing";

/**
 * Lets a contributor pan and zoom a card thumbnail inside the 16:9 card frame, then
 * returns the framed crop as a JPEG. The crop is what gets uploaded, so no framing
 * metadata is stored anywhere; reframing means choosing the image again.
 */
export function ImageFramer({ source, name, onConfirm, onCancel }: {
  /** The chosen file, or a data/object URL (the PoC keeps images as data URLs). */
  source: Blob | string;
  name: string;
  onConfirm: (file: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const id = useId();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const [framing, setFraming] = useState<Framing>({ zoom: 1, cx: 0.5, cy: 0.5 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    // Read the file as a data: URL, never blob:. The code-app CSP allows blob: for media
    // only, so a blob: image is blocked in the hosted app (and fails as "can't be read").
    let active = true;
    const element = new Image();
    element.onload = () => { if (active) { setImage(element); confirm.current?.focus(); } };
    element.onerror = () => { if (active) setFailed(true); };
    if (typeof source === "string") element.src = source;
    else {
      const reader = new FileReader();
      reader.onload = () => { if (active && typeof reader.result === "string") element.src = reader.result; };
      reader.onerror = () => { if (active) setFailed(true); };
      reader.readAsDataURL(source);
    }
    return () => { active = false; element.onload = null; element.onerror = null; };
  }, [source]);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const height = width / CARD_ASPECT;
  const cover = image && width ? coverScale(image.naturalWidth, image.naturalHeight, width) : 1;
  const clamp = (next: Framing): Framing => image && width ? clampFraming(next, image.naturalWidth, image.naturalHeight, width) : next;
  const update = (next: Framing) => setFraming(clamp(next));
  const current = clamp(framing);
  const displayed = image ? { w: image.naturalWidth * cover * current.zoom, h: image.naturalHeight * cover * current.zoom } : { w: 0, h: 0 };

  /** Zooms while keeping the image point under (px, py) — the pointer, or the frame centre — fixed. */
  const zoomAt = (zoom: number, px = width / 2, py = height / 2) => {
    if (!image) return;
    const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
    const pointX = current.cx + (px - width / 2) / displayed.w;
    const pointY = current.cy + (py - height / 2) / displayed.h;
    const w = image.naturalWidth * cover * next;
    const h = image.naturalHeight * cover * next;
    update({ zoom: next, cx: pointX - (px - width / 2) / w, cy: pointY - (py - height / 2) / h });
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, cx: current.cx, cy: current.cy };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || !displayed.w) return;
    update({ zoom: current.zoom, cx: start.cx - (event.clientX - start.x) / displayed.w, cy: start.cy - (event.clientY - start.y) / displayed.h });
  };
  // Wheel zoom needs a non-passive listener so the dialog doesn't scroll at the same time.
  const wheel = useRef<(event: WheelEvent) => void>(() => undefined);
  useEffect(() => {
    wheel.current = (event: WheelEvent) => {
      event.preventDefault();
      const box = frame.current!.getBoundingClientRect();
      zoomAt(current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX - box.left, event.clientY - box.top);
    };
  });
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const listener = (event: WheelEvent) => wheel.current(event);
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!displayed.w) return;
    const step = (event.shiftKey ? 40 : 10);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      update({ zoom: current.zoom, cx: current.cx + dx / displayed.w, cy: current.cy + dy / displayed.h });
    } else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomAt(current.zoom * 1.15); }
    else if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomAt(current.zoom / 1.15); }
  };

  const applyFraming = async () => {
    if (!image || !width || busy) return;
    setBusy(true);
    try {
      const crop = frameCrop(current, image.naturalWidth, image.naturalHeight, width);
      const canvas = document.createElement("canvas");
      canvas.width = crop.outputWidth;
      canvas.height = crop.outputHeight;
      const context = canvas.getContext("2d")!;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.outputWidth, crop.outputHeight);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error("Framing failed.")), "image/jpeg", 0.92));
      await onConfirm(new File([blob], `${name.replace(/\.[^.]+$/, "") || "thumbnail"}-card.jpg`, { type: "image/jpeg" }));
    } finally { setBusy(false); }
  };

  const zoomPercent = Math.round(current.zoom * 100);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      className="glass glass-sheen fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[760px] overflow-y-auto rounded-[22px] border border-(--glass-edge) p-5 text-(--ink) shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-sm sm:p-7"
      style={{ background: "color-mix(in srgb, var(--ground) 94%, transparent)" }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Card thumbnail</p>
          <h2 id={`${id}-title`} className="mt-1 text-[21px] font-semibold">Frame your image</h2>
          <p className="mt-1 text-[14px]" style={{ color: "var(--ink-2)" }}>Drag to choose what shows on the card. Zoom in to focus on a detail.</p>
        </div>
        <button type="button" disabled={busy} aria-label="Cancel framing" title="Cancel" onClick={onCancel} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ink-2) disabled:opacity-40"><Icon name="close" size={18} /></button>
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a custom 2-D control: arrow keys move, plus/minus zoom, as its label announces. */}
      <div
        ref={frame}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable so the keyboard can frame the image.
        tabIndex={0}
        role="group"
        aria-label={`Framing area, zoom ${zoomPercent}%. Drag or use the arrow keys to move the image; plus and minus to zoom.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={onKeyDown}
        className="framer-frame mt-5"
      >
        {image && width > 0 && (
          <img
            src={image.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ width: displayed.w, height: displayed.h, left: width / 2 - current.cx * displayed.w, top: height / 2 - current.cy * displayed.h }}
          />
        )}
        {!image && <p className="absolute inset-0 grid place-items-center text-[14px]" role="status" style={{ color: "var(--ink-2)" }}>{failed ? "This image can't be read. Choose another file." : "Loading image..."}</p>}
        <span className="framer-grid" aria-hidden="true" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={!image || current.zoom <= 1} aria-label="Zoom out" onClick={() => zoomAt(current.zoom / 1.2)} className="glass grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-[18px] leading-none disabled:opacity-40">−</button>
        <label className="flex min-w-0 flex-1 items-center gap-3">
          <span className="sr-only">Zoom</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={current.zoom} disabled={!image} onChange={(event) => zoomAt(Number(event.target.value))} className="framer-zoom min-w-0 flex-1" />
        </label>
        <button type="button" disabled={!image || current.zoom >= MAX_ZOOM} aria-label="Zoom in" onClick={() => zoomAt(current.zoom * 1.2)} className="glass grid size-9 shrink-0 cursor-pointer place-items-center rounded-full disabled:opacity-40"><Icon name="plus" size={15} /></button>
        <span className="w-12 shrink-0 text-right font-mono text-[12px]" style={{ color: "var(--ink-3)" }}>{zoomPercent}%</span>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-(--glass-edge) pt-5">
        <button type="button" disabled={!image || busy} onClick={() => setFraming({ zoom: 1, cx: 0.5, cy: 0.5 })} className="mr-auto min-h-10 cursor-pointer rounded-lg px-3 py-2.5 text-[14px] font-semibold disabled:opacity-40" style={{ color: "var(--ink-2)" }}>Reset</button>
        <button type="button" disabled={busy} onClick={onCancel} className="min-h-10 cursor-pointer rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold disabled:opacity-40">Cancel</button>
        <button ref={confirm} type="button" disabled={!image || busy} onClick={() => void applyFraming()} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-(--accent) px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:opacity-40">
          <Icon name="check" size={16} />{busy ? "Framing..." : "Use this framing"}
        </button>
      </div>
    </dialog>
  );
}
