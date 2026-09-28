import { useState } from "react";
import type { Solution } from "../types";
import { facetCounts, type FacetKey, type Filters } from "../lib/search";
import { Icon } from "./Icon";

const GROUPS: { key: FacetKey; label: string }[] = [
  { key: "capabilities", label: "Capability" },
  { key: "technologies", label: "Technology" },
  { key: "industries", label: "Industry" },
  { key: "roles", label: "Target client role" },
];

const COLLAPSED_LIMIT = 6;

export function FacetRail({
  all,
  filters,
  onChange,
}: {
  all: Solution[];
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const toggle = (key: FacetKey, value: string) => {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  const anyActive =
    filters.capabilities.length + filters.technologies.length + filters.industries.length + filters.roles.length > 0;

  return (
    <aside
      className="glass glass-sheen sticky hidden overflow-y-auto rounded-[20px] p-5 lg:block"
      style={{ top: "var(--sticky-top)", maxHeight: "calc(100vh - var(--sticky-top) - 2rem)" }}
    >
      <div className="mb-4 flex items-center gap-2">
        <Icon name="sliders" size={15} />
        <span className="eyebrow">Refine</span>
        {anyActive && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...filters, capabilities: [], technologies: [], industries: [], roles: [] })
            }
            className="ml-auto cursor-pointer text-[12px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {GROUPS.map(({ key, label }) => (
          <FacetGroup
            key={key}
            label={label}
            counts={facetCounts(all, filters, key)}
            selected={filters[key]}
            onToggle={(value) => toggle(key, value)}
          />
        ))}
      </div>
    </aside>
  );
}

function FacetGroup({
  label,
  counts,
  selected,
  onToggle,
}: {
  label: string;
  counts: Map<string, number>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (counts.size === 0) return null;

  const entries = [...counts.entries()];
  // A selected value always stays visible, even when it sits below the fold.
  const visible = expanded
    ? entries
    : entries.filter(([v], i) => i < COLLAPSED_LIMIT || selected.includes(v));
  const overflow = entries.length - visible.length;

  return (
    <div>
      <h3
        className="mb-2.5 text-[13px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
      >
        {label}
      </h3>
      <ul className="flex flex-col gap-0.5">
        {visible.map(([value, count]) => {
          const active = selected.includes(value);
          return (
            <li key={value}>
              <button
                type="button"
                onClick={() => onToggle(value)}
                aria-pressed={active}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13.5px] transition-colors duration-150"
                style={{
                  color: active ? "var(--ink)" : "var(--ink-2)",
                  background: active
                    ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                    : "transparent",
                }}
              >
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-150"
                  style={{
                    borderColor: active ? "var(--accent)" : "var(--glass-edge)",
                    background: active ? "var(--accent)" : "transparent",
                    color: "var(--on-accent)",
                  }}
                >
                  {active && <Icon name="check" size={10} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{value}</span>
                <span className="font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {(overflow > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 cursor-pointer px-2 text-[12.5px] font-semibold"
          style={{ color: "var(--accent)" }}
        >
          {expanded ? "Show fewer" : `Show ${overflow} more`}
        </button>
      )}
    </div>
  );
}
