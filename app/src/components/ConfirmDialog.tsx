import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = "Cancel", onConfirm, onCancel, busy = false }: { title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void | Promise<void>; onCancel: () => void; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const acted = useRef(false);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    cancel.current?.focus();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  const finish = (action: () => void | Promise<void>) => {
    if (acted.current || busy) return;
    acted.current = true;
    void Promise.resolve().then(action).finally(() => { acted.current = false; });
  };
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    onCancel={event => { event.preventDefault(); finish(onCancel); }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(onCancel); }
      if (event.key === "Tab") {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!first) event.preventDefault();
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}
    className="glass glass-sheen fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-[20px] border border-(--glass-edge) p-6 text-(--ink) shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:p-7"
    style={{ background: "color-mix(in srgb, var(--ground) 94%, transparent)" }}>
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--accent)/15 text-(--accent)"><Icon name="shield" size={20} /></span><h2 id={`${id}-title`} className="min-w-0 flex-1 pt-1 text-[20px] font-semibold break-words">{title}</h2><button type="button" disabled={busy} title="Cancel" aria-label="Close confirmation" onClick={() => finish(onCancel)} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ink-2) disabled:opacity-40"><Icon name="close" size={18} /></button></div>
    <div id={`${id}-description`} className="mt-4 text-[15px] leading-relaxed break-words text-(--ink-2)">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-(--glass-edge) pt-5"><button ref={cancel} type="button" disabled={busy} onClick={() => finish(onCancel)} className="min-h-10 cursor-pointer rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold disabled:opacity-40">{cancelLabel}</button><button type="button" disabled={busy} onClick={() => finish(onConfirm)} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-(--accent) px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:opacity-40"><Icon name="check" size={16} />{confirmLabel}</button></div>
  </dialog>;
}