import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Solution } from "../types";
import { AREA_ORDER, AREAS } from "../data/catalogueMetadata";
import { activeChips, activeFacetCount, areaCounts, EMPTY_FILTERS, filterSolutions, type Filters } from "../lib/search";
import { Chip } from "../components/Badges";
import { FacetPanel, FacetRail } from "../components/FacetRail";
import { Icon } from "../components/Icon";
import { SolutionCard } from "../components/SolutionCard";
import { SolutionRow } from "../components/SolutionRow";
import { SelectPicker } from "../components/SelectPicker";
import { SORT_LABELS, SORT_ORDERS, sortSolutions, type SortOrder } from "../lib/sort";
import { solutionAreas } from "../lib/areas";

type LibraryLayout = "grid" | "list";
const SORT_KEY = "prisma.library.sort";
const LAYOUT_KEY = "prisma.library.layout";

/** Sort and layout are per-viewer conveniences, kept for the session so they survive opening a solution. */
function remembered<Value extends string>(key: string, allowed: readonly Value[], fallback: Value): Value {
  try {
    const value = sessionStorage.getItem(key);
    return allowed.includes(value as Value) ? value as Value : fallback;
  } catch { return fallback; }
}
function remember(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch { void 0; }
}

const ALL_AREAS_NOTE =
  "Everything Nextant has built and can show, across all three Specialization Areas.";

export function LibraryView({
  catalogue,
  filters,
  onFilters,
  present,
  catalogueOnly = false,
  renderCard,
  renderRow,
  featured,
}: {
  catalogue: Solution[];
  filters: Filters;
  onFilters: (next: Filters) => void;
  present: boolean;
  catalogueOnly?: boolean;
  renderCard?: (solution: Solution, index: number) => ReactNode;
  /** List-view row, when the caller renders its own cards (the connected app's protected thumbnails). */
  renderRow?: (solution: Solution, index: number) => ReactNode;
  /** A shelf above the grid (the Top 10). Shown only on the unfiltered library, never in present mode. */
  featured?: ReactNode;
}) {
  const [sort, setSort] = useState<SortOrder>(() => remembered(SORT_KEY, SORT_ORDERS, "newest"));
  const [layout, setLayout] = useState<LibraryLayout>(() => remembered(LAYOUT_KEY, ["grid", "list"] as const, "grid"));
  const [refineOpen, setRefineOpen] = useState(false);
  const refineToggle = useRef<HTMLButtonElement>(null);
  const refineCount = activeFacetCount(filters);
  // Sorting and layout apply to the Solution Library grid only; the Top 3 keeps its own ranking.
  const results = useMemo(() => sortSolutions(filterSolutions(catalogue, filters), sort), [catalogue, filters, sort]);
  const counts = useMemo(() => areaCounts(catalogue, filters), [catalogue, filters]);
  const chips = activeChips(filters);
  // Live proof under the hero line, from the catalogue this person can see.
  const stats = useMemo(() => {
    const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
    return [
      plural(catalogue.length, "solution", "solutions"),
      plural(new Set(catalogue.flatMap((solution) => solutionAreas(solution))).size, "specialization area", "specialization areas"),
      plural(new Set(catalogue.flatMap((solution) => solution.technologies)).size, "technology", "technologies"),
    ];
  }, [catalogue]);
  // Searching or filtering goes straight to results: the shelf must not push the grid down.
  const showFeatured = !!featured && !present && !filters.q.trim() && filters.area === "all" && chips.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 pb-24 sm:px-6">
      {!present && (
        <section className="animate-rise grid gap-x-12 gap-y-2 pt-12 pb-2 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
          {/* Eyebrow on its own row, so the description aligns with the wordmark itself. */}
          <span className="eyebrow lg:col-span-2">Nextant · Solution Library</span>
          <div className="min-w-0">
            <div className="flex items-center gap-[0.12em] text-[clamp(3.6rem,9vw,7.25rem)]">
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
          </div>
          <div className="mt-4 min-w-0 lg:mt-[0.35rem] lg:border-l lg:border-(--glass-edge) lg:pl-10">
            <p className="max-w-[46ch] text-[clamp(17px,1.6vw,20px)] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              Nextant's solutions across AI, Data and Operations, with demos ready for your next
              client conversation.
            </p>
            {catalogue.length > 0 && (
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: "var(--ink-3)" }}>
                {stats.map((stat, index) => (
                  <span key={stat} className="inline-flex items-center gap-3">
                    {index > 0 && <span aria-hidden="true">·</span>}
                    {stat}
                  </span>
                ))}
              </p>
            )}
          </div>
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

      {showFeatured && <div className="mt-10">{featured}</div>}

      <div className={`mt-8 grid gap-6 ${present ? "" : "lg:grid-cols-[250px_minmax(0,1fr)]"}`}>
        {/* Present mode drops the filter rail — minimal chrome per design §3.4. */}
        {!present && <FacetRail all={catalogue} filters={filters} onChange={onFilters} />}

        <div className="min-w-0">
          {!present && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              {/* Same type and lavender as the Top 3 title. */}
              <h2 className="text-[clamp(1.3rem,2vw,1.65rem)] leading-none font-extrabold" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.04em", color: "var(--sa-ibo)" }}>Solution Library</h2>
              <div className="flex items-center gap-2">
                <button
                  ref={refineToggle}
                  type="button"
                  onClick={() => setRefineOpen(!refineOpen)}
                  aria-expanded={refineOpen}
                  aria-controls={refineOpen ? "refine-panel" : undefined}
                  aria-label={refineCount ? `Refine, ${refineCount} active` : "Refine"}
                  className="toolbar-control flex h-9 cursor-pointer items-center gap-2 rounded-[10px] px-3 text-[13px] font-semibold lg:hidden"
                >
                  <Icon name="sliders" size={14} />
                  Refine
                  {refineCount > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[10.5px]" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                      {refineCount}
                    </span>
                  )}
                </button>
                <SelectPicker
                  compact
                  label="Sort solutions"
                  value={sort}
                  options={SORT_ORDERS}
                  getLabel={(order) => SORT_LABELS[order]}
                  getButtonLabel={(order) => `Sort by: ${order === "newest" ? "Newest" : "Oldest"}`}
                  onChange={(order) => { setSort(order); remember(SORT_KEY, order); }}
                />
                <div className="view-toggle" role="group" aria-label="Layout">
                  {(["grid", "list"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={layout === option}
                      aria-label={option === "grid" ? "Grid view" : "List view"}
                      title={option === "grid" ? "Grid view" : "List view"}
                      onClick={() => { setLayout(option); remember(LAYOUT_KEY, option); }}
                    >
                      <Icon name={option} size={15} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!present && refineOpen && (
            <FacetPanel id="refine-panel" all={catalogue} filters={filters} onChange={onFilters} onClose={() => { setRefineOpen(false); refineToggle.current?.focus(); }} />
          )}
          {results.length > 0 ? (
            layout === "list" && !present ? (
              <div className="flex flex-col gap-2.5">
                {results.map((s, i) => (
                  renderRow ? <div key={s.id} className="min-w-0">{renderRow(s, i)}</div> : <SolutionRow key={s.id} solution={s} present={present} index={i} favoritable={!catalogueOnly} />
                ))}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((s, i) => (
                  renderCard ? <div key={s.id} className="grid min-w-0">{renderCard(s, i)}</div> : <SolutionCard key={s.id} solution={s} present={present} index={i} catalogueOnly={catalogueOnly} favoritable={!renderCard && !catalogueOnly} />
                ))}
              </div>
            )
          ) : catalogueOnly && catalogue.length === 0 ? (
            <div className="px-6 py-16 text-center" role="status">
              <h2 className="text-[22px] font-semibold">{present ? "No solutions cleared for presentation" : "No published solutions"}</h2>
              <p className="mt-2 text-[15px]" style={{ color: "var(--ink-2)" }}>The catalogue is empty.</p>
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
    <div className="glass glass-gloss flex h-14 items-center gap-3 rounded-[16px] px-4">
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
              : EMPTY_FILTERS,
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
