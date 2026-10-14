import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, type Ref } from "react";
import type { Solution } from "../types";
import { activeFacetCount, clearFacets, facetCounts, type FacetKey, type Filters } from "../lib/search";
import { Icon } from "./Icon";

/** Options come from the catalogue's own metadata; `searchable` groups get a search box once their list grows long. */
const GROUPS: { key: FacetKey; label: string; searchable?: boolean }[] = [
  { key: "demos", label: "Demo" },
  { key: "capabilities", label: "Capability", searchable: true },
  { key: "technologies", label: "Technology", searchable: true },
  { key: "industries", label: "Industry" },
  { key: "roles", label: "Target client role" },
];

/** Options shown before "Show more". A selected option always shows, wherever it ranks. */
const COLLAPSED_LIMIT = 5;
/** A searchable group shows its search box above this many options. */
const SEARCH_THRESHOLD = 8;

type FacetProps = {
  all: Solution[];
  filters: Filters;
  onChange: (next: Filters) => void;
};

/**
 * Desktop rail: a fixed-width, sticky column. Only the rail scrolls (groups never get their own scroll box). Its header
 * carries the collapse control; collapsing keeps every selection.
 */
export function FacetRail({ onCollapse, collapseRef, ...props }: FacetProps & { onCollapse: () => void; collapseRef?: Ref<HTMLButtonElement> }) {
  const count = activeFacetCount(props.filters);
  return (
    <aside
      aria-label="Refine solutions"
      className="glass glass-gloss sticky hidden w-[250px] overflow-y-auto rounded-[20px] p-5 lg:block"
      style={{ top: "var(--sticky-top)", maxHeight: "calc(100vh - var(--sticky-top) - 2rem)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="sliders" size={15} />
        <h2 className="eyebrow">Refine</h2>
        {count > 0 && <ActiveCount count={count} />}
        <button
          ref={collapseRef}
          type="button"
          onClick={onCollapse}
          aria-label="Hide filters"
          title="Hide filters"
          className="facet-icon-button ml-auto"
        >
          <Icon name="panelClose" size={16} />
        </button>
      </div>
      <FacetBody {...props} />
    </aside>
  );
}

/** Below `lg` the rail becomes a left drawer: a modal dialog that returns focus to its opener when it closes. */
export function FacetDrawer({ resultCount, onClose, ...props }: FacetProps & { resultCount: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const id = useId();
  const count = activeFacetCount(props.filters);
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
  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="animate-drawer-in-left fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-full max-w-[360px] border-r border-(--glass-edge) p-0 text-(--ink) shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:rounded-r-[22px] lg:hidden"
      style={{ background: "color-mix(in srgb, var(--ground) 97%, transparent)" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-(--glass-edge) px-5 py-4">
          <Icon name="sliders" size={15} />
          <h2 id={`${id}-title`} className="text-[16px] font-semibold">Filters</h2>
          {count > 0 && <ActiveCount count={count} />}
          <button ref={close} type="button" onClick={onClose} aria-label="Close filters" title="Close" className="facet-icon-button ml-auto">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <FacetBody {...props} />
        </div>
        <div className="flex items-center gap-3 border-t border-(--glass-edge) px-5 py-4">
          {count > 0 && (
            <button type="button" onClick={() => props.onChange(clearFacets(props.filters))} className="cursor-pointer text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
              Clear all
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto inline-flex min-h-10 cursor-pointer items-center rounded-full px-5 text-[14px] font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            Show {resultCount} {resultCount === 1 ? "result" : "results"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ActiveCount({ count }: { count: number }) {
  return (
    <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[10.5px]" style={{ background: "var(--accent)", color: "var(--on-accent)" }} aria-label={`${count} active`}>
      {count}
    </span>
  );
}

function FacetBody({ all, filters, onChange }: FacetProps) {
  const toggle = (key: FacetKey, value: string) => {
    const current = filters[key];
    onChange({ ...filters, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };
  // Counts follow the current search and the other filters (each group ignores its own selection).
  const counts = useMemo(() => GROUPS.map(({ key }) => facetCounts(all, filters, key)), [all, filters]);
  return (
    <div className="flex flex-col divide-y divide-(--glass-edge)">
      {GROUPS.map(({ key, label, searchable }, index) => (
        <FacetGroup
          key={key}
          label={label}
          searchable={!!searchable}
          counts={counts[index]}
          selected={filters[key]}
          onToggle={(value) => toggle(key, value)}
        />
      ))}
    </div>
  );
}

export function FacetGroup({
  label,
  counts,
  selected,
  searchable,
  onToggle,
}: {
  label: string;
  counts: Map<string, number>;
  selected: string[];
  searchable: boolean;
  onToggle: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  // A selected option stays listed even when the current search leaves it no results.
  const entries = useMemo(() => {
    const list = [...counts.entries()];
    for (const value of selected) if (!counts.has(value)) list.push([value, 0]);
    return list;
  }, [counts, selected]);
  const term = deferredQuery.trim().toLowerCase();
  const matching = useMemo(() => term ? entries.filter(([value]) => value.toLowerCase().includes(term)) : entries, [entries, term]);
  if (entries.length === 0) return null;

  const showSearch = searchable && entries.length > SEARCH_THRESHOLD;
  const visible = expanded ? matching : matching.filter(([value], index) => index < COLLAPSED_LIMIT || selected.includes(value));
  const hiddenCount = matching.length - visible.length;
  const chosen = selected.length;

  return (
    <section className="py-3 first:pt-0 last:pb-0" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-left text-[13px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
        >
          {/* How many options the group offers right now (it follows the search and other filters). */}
          <span className="min-w-0 flex-1">{label} <span className="ml-1 font-mono text-[11px] font-normal" style={{ color: "var(--ink-3)" }} aria-label={`${entries.length} options`}>{entries.length}</span></span>
          {chosen > 0 && <span className="font-mono text-[11px]" style={{ color: "var(--accent)" }}>{chosen} selected</span>}
          <span className={`inline-grid transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: "var(--ink-3)" }}><Icon name="chevronDown" size={14} /></span>
        </button>
      </h3>
      {open && (
        <div id={`${id}-body`} className="mt-1.5">
          {showSearch && (
            <label className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-(--glass-edge) px-2.5" style={{ background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}>
              <Icon name="search" size={13} />
              <input
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setExpanded(false); }}
                aria-label={`Search ${label.toLowerCase()} options`}
                placeholder={`Search ${label.toLowerCase()}`}
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--ink)" }}
              />
            </label>
          )}
          {visible.length === 0 ? (
            <p className="px-2 py-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>No {label.toLowerCase()} matches “{query.trim()}”.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {visible.map(([value, count]) => {
                const active = selected.includes(value);
                return (
                  <li key={value}>
                    <button
                      type="button"
                      onClick={() => onToggle(value)}
                      aria-pressed={active}
                      className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] leading-snug transition-colors duration-150 hover:bg-(--glass-edge)"
                      style={{
                        color: active ? "var(--ink)" : count === 0 ? "var(--ink-3)" : "var(--ink-2)",
                        background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : undefined,
                      }}
                    >
                      <span
                        className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-150"
                        style={{ borderColor: active ? "var(--accent)" : "var(--glass-edge)", background: active ? "var(--accent)" : "transparent", color: "var(--on-accent)" }}
                      >
                        {active && <Icon name="check" size={10} />}
                      </span>
                      {/* Long labels wrap instead of being cut off. */}
                      <span className="min-w-0 flex-1 break-words">{value}</span>
                      <span className="mt-[2px] font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {(hiddenCount > 0 || expanded) && (
            <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-1.5 cursor-pointer px-2 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
              {expanded ? "Show less" : `Show ${hiddenCount} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
