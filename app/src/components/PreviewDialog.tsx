import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * A large read-only modal that scrolls inside itself, used to inspect a whole solution page before submitting.
 * The content is inert (nothing in it opens or navigates); the scroll area itself stays focusable for the keyboard.
 */
export function PreviewDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
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
  return <dialog ref={dialog} aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="fixed inset-0 m-auto flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[1380px] flex-col overflow-hidden rounded-[22px] border border-(--glass-edge) text-(--ink) shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    style={{ background: "color-mix(in srgb, var(--ground) 96%, transparent)" }}>
    <div className="flex shrink-0 items-center gap-3 border-b border-(--glass-edge) px-4 py-3 sm:px-6">
      <h2 id={`${id}-title`} className="min-w-0 flex-1 text-[17px] font-semibold break-words">{title}</h2>
      <span className="hidden font-mono text-[10.5px] tracking-[0.12em] text-(--ink-3) uppercase sm:inline">Read-only preview</span>
      <button ref={close} type="button" onClick={onClose} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-(--glass-edge) px-3 text-[13.5px] font-semibold text-(--ink-2)"><Icon name="close" size={16} />Close</button>
    </div>
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scroll area must be focusable so the keyboard can scroll it. */}
    <div tabIndex={0} role="region" aria-label="Solution preview" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"><div inert>{children}</div></div>
  </dialog>;
}
