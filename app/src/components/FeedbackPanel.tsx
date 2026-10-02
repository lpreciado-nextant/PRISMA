import { useEffect, useId, useRef } from "react";
import { Icon } from "./Icon";

/** Right-side panel with the librarian's full feedback, opened over My submissions without leaving it. */
export function FeedbackPanel({ name, feedback, onEdit, onClose }: { name: string; feedback: string; onEdit?: () => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    close.current?.focus();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-feedback`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="animate-drawer-in fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[440px] border-l border-(--glass-edge) p-0 text-(--ink) shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:rounded-l-[22px]"
    style={{ background: "color-mix(in srgb, var(--ground) 96%, transparent)" }}>
    <div className="flex h-full flex-col overflow-y-auto p-6 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ color: "var(--proto)", background: "color-mix(in srgb, var(--proto) 14%, transparent)" }}><Icon name="alert" size={19} /></span>
        <h2 id={`${id}-title`} className="min-w-0 flex-1 pt-1.5 text-[20px] font-semibold">Requested changes</h2>
        <button ref={close} type="button" aria-label="Close feedback" title="Close" onClick={onClose} className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ink-2) hover:text-(--ink)"><Icon name="close" size={18} /></button>
      </div>
      <p className="mt-5 text-[17px] leading-snug font-semibold break-words">{name}</p>
      <p className="mt-1 text-[13px] text-(--ink-3)">Librarian</p>
      <section className="mt-6 border-t border-(--glass-edge) pt-5">
        <h3 className="eyebrow">Librarian feedback</h3>
        <p id={`${id}-feedback`} className="mt-3 border-l-2 border-(--proto) pl-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-(--ink-2)">{feedback}</p>
      </section>
      {onEdit && <div className="mt-auto pt-8"><div className="flex justify-end border-t border-(--glass-edge) pt-5">
        <button type="button" onClick={onEdit} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-(--accent) px-4 py-2.5 text-[14px] font-semibold text-(--on-accent)"><Icon name="edit" size={16} />Edit solution</button>
      </div></div>}
    </div>
  </dialog>;
}
