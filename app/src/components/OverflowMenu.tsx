import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";

type Item = { label: string; icon: IconName; onSelect: () => void };
type ToggleEvent = Event & { newState?: string };

/**
 * "•••" menu for secondary actions. The list is a top-layer popover, so a card's overflow clipping and hover lift
 * never cut it off; the browser supplies light dismiss, Escape and focus return to the trigger.
 */
export function OverflowMenu({ label, items }: { label: string; items: Item[] }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const element = menu.current;
    if (!element) return;
    const close = () => { if (element.matches(":popover-open")) element.hidePopover(); };
    const place = (event: Event) => {
      const button = trigger.current;
      if ((event as ToggleEvent).newState !== "open" || !button) return;
      const rect = button.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom > 56 * items.length + 24;
      Object.assign(element.style, {
        left: "auto",
        right: `${Math.max(8, window.innerWidth - rect.right)}px`,
        top: below ? `${rect.bottom + 6}px` : "auto",
        bottom: below ? "auto" : `${window.innerHeight - rect.top + 6}px`,
      });
    };
    const toggled = (event: Event) => {
      const isOpen = (event as ToggleEvent).newState === "open";
      setOpen(isOpen);
      if (isOpen) {
        element.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
      } else {
        window.removeEventListener("scroll", close, true);
        window.removeEventListener("resize", close);
      }
    };
    element.addEventListener("beforetoggle", place);
    element.addEventListener("toggle", toggled);
    return () => {
      element.removeEventListener("beforetoggle", place);
      element.removeEventListener("toggle", toggled);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [items.length]);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const current = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  };
  return <>
    <button ref={trigger} type="button" popoverTarget={id} aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} title="More actions"
      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-(--glass-edge) text-(--ink-2) hover:text-(--ink)">
      <Icon name="more" size={18} />
    </button>
    <div ref={menu} id={id} popover="auto" role="menu" tabIndex={-1} aria-label={label} onKeyDown={move}
      className="m-0 min-w-[190px] rounded-xl border border-(--glass-edge) p-1.5 text-(--ink) shadow-xl"
      style={{ position: "fixed", inset: "auto", background: "color-mix(in srgb, var(--ground) 97%, transparent)" }}>
      {items.map(item => <button key={item.label} type="button" role="menuitem" tabIndex={-1}
        onClick={() => { menu.current?.hidePopover(); item.onSelect(); }}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-(--ink)/8 focus-visible:bg-(--ink)/8">
        <Icon name={item.icon} size={15} />{item.label}
      </button>)}
    </div>
  </>;
}
