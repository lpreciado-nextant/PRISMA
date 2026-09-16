import { useMemo } from "react";
import type { Solution } from "../types";
import { AREA_ORDER, AREAS } from "../data/solutions";
import { activeChips, areaCounts, filterSolutions, type Filters } from "../lib/search";
import { Chip } from "../components/Badges";
import { FacetRail } from "../components/FacetRail";
import { Icon } from "../components/Icon";
import { SolutionCard } from "../components/SolutionCard";

const ALL_AREAS_NOTE =
  "Everything Nextant has built and can show, across all three Specialization Areas.";

export function LibraryView({
  catalogue,
  filters,
  onFilters,
  present,
}: {
  catalogue: Solution[];
  filters: Filters;
  onFilters: (next: Filters) => void;
  present: boolean;
}) {
  const results = useMemo(() => filterSolutions(catalogue, filters), [catalogue, filters]);
  const counts = useMemo(() => areaCounts(catalogue, filters), [catalogue, filters]);
  const chips = activeChips(filters);

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 pb-24 sm:px-6">
      {!present && (
        <section className="animate-rise pt-14 pb-2">
          <div className="flex items-center gap-3">
            <span className="eyebrow">Nextant · Solution Library</span>
          </div>
          <div className="mt-2 flex items-center gap-[0.12em] text-[clamp(4rem,11vw,8.5rem)]">
            <img
              src="./prisma-mark-v2.svg"
              alt=""
              aria-hidden="true"
              className="h-[0.86em] w-auto shrink-0 translate-y-[0.05em] select-none"
            />
            <h1 className="prisma-wordmark pr-[0.06em] text-[1em]" aria-label="PRISMA">
              PRISMA
            </h1>
          </div>
          <p
            className="mt-4 max-w-[54ch] text-[clamp(17px,1.6vw,20px)]"
            style={{ color: "var(--ink-2)" }}
          >
            Everything we've built, ready to show. Search the library, open the demo, and be on a
            client's screen in under two minutes.
          </p>
        </section>
      )}

      <section className="pt-8">
        <SearchField
          value={filters.q}
          onChange={(q) => onFilters({ ...filters, q })}
          resultCount={results.length}
        />

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <AreaTab
            label="All areas"
            count={counts.get("all") ?? 0}
            active={filters.area === "all"}
            onClick={() => onFilters({ ...filters, area: "all" })}
          />
          {AREA_ORDER.map((id) => (
            <AreaTab
              key={id}
              label={AREAS[id].name}
              color={AREAS[id].cssVar}
              count={counts.get(id) ?? 0}
              active={filters.area === id}
              onClick={() => onFilters({ ...filters, area: id })}
            />
          ))}
        </div>

        <p className="mt-4 max-w-[72ch] text-[14.5px]" style={{ color: "var(--ink-2)" }}>
          {filters.area === "all" ? ALL_AREAS_NOTE : AREAS[filters.area].note}
        </p>

        {chips.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow">Filters</span>
            {chips.map(({ key, value }) => (
              <Chip
                key={`${key}-${value}`}
                active
                onClick={() =>
                  onFilters({ ...filters, [key]: filters[key].filter((v) => v !== value) })
                }
              >
                {value}
                <Icon name="close" size={12} />
              </Chip>
            ))}
          </div>
        )}
      </section>

      <div className={`mt-8 grid gap-6 ${present ? "" : "lg:grid-cols-[250px_minmax(0,1fr)]"}`}>
        {/* Present mode drops the filter rail — minimal chrome per design §3.4. */}
        {!present && <FacetRail all={catalogue} filters={filters} onChange={onFilters} />}

        <div>
          {results.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((s, i) => (
                <SolutionCard key={s.id} solution={s} present={present} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState filters={filters} onFilters={onFilters} />
          )}
        </div>
      </div>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  resultCount,
}: {
  value: string;
  onChange: (v: string) => void;
  resultCount: number;
}) {
  return (
    <div className="glass glass-sheen flex h-14 items-center gap-3 rounded-[16px] px-4">
      <Icon name="search" size={18} className="shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by problem, capability, technology or client…"
        aria-label="Search the solution library"
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none"
        style={{ color: "var(--ink)" }}
      />
      <span className="hidden font-mono text-[11px] tracking-[0.1em] whitespace-nowrap uppercase sm:block" style={{ color: "var(--ink-3)" }}>
        {resultCount} {resultCount === 1 ? "result" : "results"}
      </span>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg"
          style={{ color: "var(--ink-3)" }}
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
}

function AreaTab({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="glass inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-all duration-300"
      style={{
        fontFamily: "var(--font-display)",
        color: active ? "var(--on-accent)" : "var(--ink-2)",
        background: active ? "var(--accent)" : undefined,
        borderColor: active ? "var(--accent)" : undefined,
      }}
    >
      {color && !active && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
      {label}
      <span className="font-mono text-[11px] opacity-70">{count}</span>
    </button>
  );
}

function EmptyState({
  filters,
  onFilters,
}: {
  filters: Filters;
  onFilters: (next: Filters) => void;
}) {
  const chips = activeChips(filters);
  const mostRestrictive = chips.at(-1);

  return (
    <div className="glass glass-sheen animate-scale-in grid place-items-center rounded-[22px] px-6 py-20 text-center">
      <p className="eyebrow">No matches</p>
      <h3 className="mt-3 text-[22px] font-semibold">Nothing matched that</h3>
      <p className="mt-2 max-w-[44ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
        {mostRestrictive
          ? `The narrowest filter right now is “${mostRestrictive.value}”. Dropping it usually brings the shelf back.`
          : "Try a broader search term, or switch back to all areas."}
      </p>
      <button
        type="button"
        onClick={() =>
          onFilters(
            mostRestrictive
              ? {
                  ...filters,
                  [mostRestrictive.key]: filters[mostRestrictive.key].filter(
                    (v) => v !== mostRestrictive.value,
                  ),
                }
              : { q: "", area: "all", capabilities: [], technologies: [], industries: [] },
          )
        }
        className="mt-6 cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          background: "var(--accent)",
          color: "var(--on-accent)",
        }}
      >
        {mostRestrictive ? `Remove “${mostRestrictive.value}”` : "Reset the view"}
      </button>
    </div>
  );
}
