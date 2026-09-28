import { useId, useState } from "react";
import { Icon } from "./Icon";

export function SelectPicker<Value extends string>({ label, value, options, onChange, getLabel = (option) => option, placeholder }: {
  label: string;
  /** Shown greyed out, like an input placeholder, while no value is chosen. */
  placeholder?: string;
  value: Value;
  options: readonly Value[];
  onChange: (value: Value) => void;
  getLabel?: (value: Value) => string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const select = (option: Value) => {
    onChange(option);
    setOpen(false);
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-(--glass-edge) bg-transparent px-3.5 py-2.5 text-left text-[15px] text-(--ink) outline-none transition-colors duration-200 focus:border-(--accent)"
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
        {!value && placeholder ? <span className="min-w-0 break-words text-(--ink-3)">{placeholder}</span> : <span className="min-w-0 break-words">{getLabel(value)}</span>}
        <Icon name="chevronDown" className="shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border p-1 shadow-lg" style={{ background: "var(--ground)", borderColor: "var(--glass-edge)", color: "var(--ink)" }}>
          <ul id={`${id}-list`} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto">
            {options.map((option, index) => (
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
                <span className="w-4 shrink-0">{option === value && <Icon name="check" />}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}