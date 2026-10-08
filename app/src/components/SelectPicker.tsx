import { useId, useState } from "react";
import { Icon, type IconName } from "./Icon";

export function SelectPicker<Value extends string>({ label, value, options, onChange, getLabel = (option) => option, placeholder, compact = false, getButtonLabel, getHint, buttonClassName, buttonIcon }: {
  label: string;
  /** Shown greyed out, like an input placeholder, while no value is chosen. */
  placeholder?: string;
  value: Value;
  options: readonly Value[];
  onChange: (value: Value) => void;
  getLabel?: (value: Value) => string;
  /** Toolbar size: smaller, right-aligned menu. Forms keep the default. */
  compact?: boolean;
  /** Text on the closed button when it differs from the option label, e.g. "Sort by: Newest". */
  getButtonLabel?: (value: Value) => string;
  /** Secondary text beside an option, e.g. how many results it leaves. */
  getHint?: (value: Value) => string;
  /** Replaces the compact toolbar look, e.g. to match a neighbouring action button. */
  buttonClassName?: string;
  /** Icon before the button text, e.g. a plus for an "Add …" menu. */
  buttonIcon?: IconName;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const select = (option: Value) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div className={compact ? "relative shrink-0" : "relative min-w-0"}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        className={buttonClassName ?? (compact
          ? "toolbar-control flex h-9 cursor-pointer items-center gap-2 rounded-[10px] px-3 text-left text-[13px] font-semibold outline-none"
          : "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-(--glass-edge) bg-transparent px-3.5 py-2.5 text-left text-[15px] text-(--ink) outline-none transition-colors duration-200 focus:border-(--accent)")}
        onClick={() => {
          setActiveIndex(Math.max(0, options.indexOf(value)));
          setOpen(!open);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => !open
              ? Math.max(0, options.indexOf(value))
              : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
          } else if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            select(options[activeIndex]);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const match = options.findIndex((option) => getLabel(option).toLowerCase().startsWith(event.key.toLowerCase()));
            if (match >= 0) {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(match);
            }
          }
        }}
      >
        {buttonIcon && <Icon name={buttonIcon} size={16} className="shrink-0" />}
        {!value && placeholder ? <span className="min-w-0 break-words text-(--ink-3)">{placeholder}</span> : <span className="min-w-0 break-words">{(getButtonLabel ?? getLabel)(value)}</span>}
        <Icon name="chevronDown" size={compact ? 14 : undefined} className="shrink-0" />
      </button>
      {open && (
        <div className={`absolute top-full right-0 z-20 mt-1 rounded-lg border p-1 shadow-lg ${compact ? "min-w-[11rem]" : "left-0"}`} style={{ background: "var(--ground)", borderColor: "var(--glass-edge)", color: "var(--ink)" }}>
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto">
            {options.map((option, index) => (
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the combobox input owns keyboard selection (aria-activedescendant).
              <li
                key={option}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option === value}
                ref={(element) => { if (index === activeIndex) element?.scrollIntoView({ block: "nearest" }); }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-[14px] break-words hover:bg-(--glass-edge)"
                style={{ background: index === activeIndex ? "var(--glass-edge)" : undefined }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => { event.preventDefault(); select(option); }}
              >
                <span className="min-w-0 font-semibold">{getLabel(option)}</span>
                {getHint && <span className="ml-auto font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>{getHint(option)}</span>}
                <span className="w-4 shrink-0">{option === value && <Icon name="check" />}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}