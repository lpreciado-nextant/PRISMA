import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Solution } from "../types";
import { AREA_ORDER, AREAS } from "../data/catalogueMetadata";
import { activeChips, activeFacetCount, ADDED_LABELS, ADDED_WINDOWS, addedCounts, areaCounts, EMPTY_FILTERS, filterSolutions, type Filters } from "../lib/search";
import { Chip } from "../components/Badges";
import { FacetDrawer, FacetRail } from "../components/FacetRail";
import { Icon } from "../components/Icon";
import { SolutionCard } from "../components/SolutionCard";
import { SolutionRow } from "../components/SolutionRow";
import { SelectPicker } from "../components/SelectPicker";
import { SORT_LABELS, SORT_ORDERS, sortSolutions, type SortOrder } from "../lib/sort";
import { presentingSelection, setPresentingSelection } from "../lib/presentSelection";

type LibraryLayout = "grid" | "list";
const SORT_KEY = "prisma.library.sort";
const LAYOUT_KEY = "prisma.library.layout";
const RAIL_KEY = "prisma.library.rail";
/** Borderless toolbar dropdown: a muted label, then the chosen value. */
const TOOLBAR_SELECT = "toolbar-select flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-left text-[13px] outline-none";

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

export function LibraryView({
  catalogue,
  filters,
  onFilters,
  present,
  catalogueOnly = false,
  renderCard,
  renderRow,
  featured,
  selected,
  selectionStart,
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
  /** The viewer's saved solutions (favorites). Present mode offers the client-safe ones as "Selected for you". */
  selected?: ReadonlySet<string> | readonly string[];
  /** Start with "Show my saved solutions" on (tests); by default, the choice made earlier in this session. */
  selectionStart?: boolean;
}) {
  const [sort, setSort] = useState<SortOrder>(() => remembered(SORT_KEY, SORT_ORDERS, "newest"));
  const [layout, setLayout] = useState<LibraryLayout>(() => remembered(LAYOUT_KEY, ["grid", "list"] as const, "grid"));
  const [refineOpen, setRefineOpen] = useState(false);
  // Desktop only: the Refine rail can be hidden so the cards take the full width.
  const [railShown, setRailShown] = useState(() => remembered(RAIL_KEY, ["shown", "hidden"] as const, "shown") === "shown");
  // Present mode keeps its own, unremembered choice and starts closed (minimal chrome); Filters opens the same rail.
  const [presentRail, setPresentRail] = useState(false);
  const shown = present ? presentRail : railShown;
  const rail = shown;
  const refineToggle = useRef<HTMLButtonElement>(null);
  // The control that toggled the rail disappears with it, so focus moves to the one that takes its place.
  const railCollapse = useRef<HTMLButtonElement>(null);
  const railExpand = useRef<HTMLButtonElement>(null);
  const setRail = (next: boolean) => {
    if (present) setPresentRail(next);
    else {
      setRailShown(next);
      remember(RAIL_KEY, next ? "shown" : "hidden");
    }
    requestAnimationFrame(() => (next ? railCollapse : railExpand).current?.focus());
  };
  // "Show my saved solutions": a present-mode switch that shows only the viewer's saved solutions among the client-safe
  // catalogue present mode already passes in, so it only ever narrows what may be shown. Off by default.
  const [selectedOnly, setSelectedOnly] = useState(() => selectionStart ?? presentingSelection());
  const picks = useMemo(() => {
    if (!present || !selected) return [];
    const ids = new Set(selected);
    return catalogue.filter((solution) => ids.has(solution.id));
  }, [present, selected, catalogue]);
  const showingPicks = present && selectedOnly && picks.length > 0;
  const pool = showingPicks ? picks : catalogue;
  const toggleSaved = () => { setSelectedOnly(!showingPicks); setPresentingSelection(!showingPicks); };
  const refineCount = activeFacetCount(filters);
  // Present mode has no heading or toolbar around it, so the button says what it filters by.
  const filterLabel = present ? "Filter by capability, technology & more" : "Filters";
  // Sorting and layout apply to the Solution Library grid only; the Top 3 keeps its own ranking.
  const results = useMemo(() => sortSolutions(filterSolutions(pool, filters), sort), [pool, filters, sort]);
  const counts = useMemo(() => areaCounts(pool, filters), [pool, filters]);
  const added = useMemo(() => addedCounts(pool, filters), [pool, filters]);
  const chips = activeChips(filters);
  // Everything "Clear all" resets, back to the clean library: search, area, the Refine selections and the added window.
  const query = filters.q.trim();
  const activeCount = chips.length + (filters.added === "any" ? 0 : 1) + (query ? 1 : 0) + (filters.area === "all" ? 0 : 1);
  // Searching or filtering goes straight to results: the shelf must not push the grid down.
  const showFeatured = !!featured && !present && !filters.q.trim() && filters.area === "all" && filters.added === "any" && chips.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 pb-24 sm:px-6">
      {!present && (
        <section className="animate-rise grid gap-x-14 gap-y-2 pt-8 pb-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-[0.12em] text-[clamp(3rem,7.5vw,5.75rem)]">
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
          {/* The right column runs the wordmark's full height. Inside it, one block (description and
              stats, sharing a left edge) is centred both ways in the free space; its text stays left-aligned. */}
          <div className="mt-4 min-w-0 lg:mt-0 lg:flex lg:items-center lg:justify-center lg:self-stretch lg:px-10 lg:py-2">
            <div className="min-w-0 text-[clamp(17px,1.6vw,20px)] lg:w-full lg:max-w-[46ch]">
              {/* Three levels: a headline in dark blue-grey, a neutral supporting line, then the live stats. */}
              <p className="text-[clamp(21px,1.9vw,24px)] leading-snug font-semibold" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.01em", color: "color-mix(in srgb, var(--ink) 72%, var(--accent))" }}>
                Explore what Nextant has built.
              </p>
              <p className="mt-2 max-w-[52ch] text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                Discover solutions across AI, Data, and Operations — ready to support your next client conversation.
              </p>

            </div>
          </div>
        </section>
      )}

      <section className="pt-5">
        <SearchField
          value={filters.q}
          onChange={(q) => onFilters({ ...filters, q })}
          resultCount={results.length}
        />

        {/* Editorial area filter: text options with their colour dots; only the chosen one gets a light tint. It must not
            look like the section tabs above (no icons, no underline). */}
        {/* The area filter, with present mode's saved-solutions switch at the right end of the same line. */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div role="group" aria-label="Filter by specialization area" className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
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
        {present && picks.length > 0 && (
          <button type="button" role="switch" aria-checked={showingPicks} onClick={toggleSaved} className="saved-switch">
            <Icon name="heart" size={14} />Show my saved solutions<span className="font-mono text-[11.5px] opacity-80">{picks.length}</span>
            <span aria-hidden="true" className="saved-switch-track"><span className="saved-switch-thumb" /></span>
          </button>
        )}
        </div>

        {/* Only a chosen area carries a note; "All" needs no explanation. */}
        {filters.area !== "all" && (
          // Tied to the chosen area: a thin bar and faint wash in its colour, its name, then what it covers.
          <p className="animate-rise mt-3 w-fit max-w-full rounded-r-[10px] border-l-[3px] py-2 pr-4 pl-3.5 text-[13.5px] leading-relaxed"
            style={{ borderColor: AREAS[filters.area].cssVar, background: `color-mix(in srgb, ${AREAS[filters.area].cssVar} 7%, transparent)`, color: "var(--ink-2)" }}>
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{AREAS[filters.area].name}</span>
            <span aria-hidden="true"> · </span>
            {AREAS[filters.area].note}
          </p>
        )}

      </section>

      {showFeatured && <div className="mt-10">{featured}</div>}

      <div className={`mt-8 grid gap-6 ${rail ? "lg:grid-cols-[250px_minmax(0,1fr)]" : ""}`}>
        {/* Present mode starts with the rail closed (minimal chrome, design §3.4); its facets come from the client-safe catalogue only. Collapsing keeps every selection. */}
        {rail && <FacetRail all={pool} filters={filters} onChange={onFilters} onCollapse={() => setRail(false)} collapseRef={railCollapse} />}

        <div className="min-w-0">
          {(
            // Desktop with the rail open: the rail is the filter control, so the toolbar drops Filters and joins the
            // heading's row. Otherwise (rail collapsed, or below lg): heading row, then Filters left and the rest right.
            // Present mode keeps only Filters: no heading, sort, added window or layout toggle.
            <div className={`mb-5 ${shown ? (present ? "lg:hidden" : "lg:flex lg:items-center lg:justify-between lg:gap-4") : ""}`}>
              {/* Same heading style as the Top 3 title. */}
              {!present && <h2 className="section-title flex items-center gap-2.5">Nextant · Solution Library
                {/* How many solutions the library holds; the hero no longer repeats it. */}
                {catalogue.length > 0 && <span className="rounded-full px-2 py-0.5 font-mono text-[12px] font-medium" style={{ color: "var(--ink-2)", background: "color-mix(in srgb, var(--ink) 7%, transparent)" }} aria-label={`${catalogue.length} ${catalogue.length === 1 ? "solution" : "solutions"}`}>{catalogue.length}</span>}
              </h2>}
              {/* The right group wraps within itself on narrow screens, so Filters keeps its place. */}
              <div className={`flex items-center justify-between gap-3 ${present ? "" : "mt-4"} ${shown ? "lg:mt-0" : ""}`}>
                <div className={`flex shrink-0 items-center ${shown ? "lg:hidden" : ""}`}>
                  <button
                    ref={refineToggle}
                    type="button"
                    onClick={() => setRefineOpen(true)}
                    aria-haspopup="dialog"
                    aria-label={refineCount ? `${filterLabel}, ${refineCount} active` : filterLabel}
                    className="toolbar-filter flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] lg:hidden"
                  >
                    <Icon name="sliders" size={14} />
                    {filterLabel}
                    {refineCount > 0 && <RefineCount count={refineCount} />}
                  </button>
                  {/* Desktop, rail collapsed: reopens it. A soft fill sets it apart from Sort by and Added. */}
                  {!shown && (
                    <button
                      ref={railExpand}
                      type="button"
                      onClick={() => setRail(true)}
                      aria-label={present ? (refineCount ? `${filterLabel}, ${refineCount} active` : filterLabel) : refineCount ? `Show filters, ${refineCount} active` : "Show filters"}
                      title={present ? filterLabel : "Show filters"}
                      className="toolbar-filter hidden h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] lg:flex"
                    >
                      <Icon name="sliders" size={14} />
                      {filterLabel}
                      {refineCount > 0 && <RefineCount count={refineCount} />}
                    </button>
                  )}
                </div>
                {!present && <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-1 gap-y-2">
                  <SelectPicker
                    compact
                    label="Sort solutions"
                    value={sort}
                    options={SORT_ORDERS}
                    getLabel={(order) => SORT_LABELS[order]}
                    buttonClassName={TOOLBAR_SELECT}
                    buttonPrefix="Sort by"
                    getButtonLabel={(order) => (order === "newest" ? "Newest" : "Oldest")}
                    onChange={(order) => { setSort(order); remember(SORT_KEY, order); }}
                  />
                  <SelectPicker
                    compact
                    label="Added within"
                    value={filters.added}
                    options={ADDED_WINDOWS}
                    getLabel={(window) => ADDED_LABELS[window]}
                    buttonClassName={TOOLBAR_SELECT}
                    buttonPrefix="Added"
                    getHint={(window) => String(added.get(window) ?? 0)}
                    onChange={(window) => onFilters({ ...filters, added: window })}
                  />
                  <div className="view-toggle ml-2" role="group" aria-label="Layout">
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
                </div>}
              </div>
            </div>
          )}
          {refineOpen && (
            <FacetDrawer all={pool} filters={filters} onChange={onFilters} resultCount={results.length} onClose={() => setRefineOpen(false)} />
          )}
          {/* Active filters sit right above the cards: each removable, with the total and a single reset. */}
          {activeCount > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2" role="region" aria-label="Active filters">
              <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                {activeCount} {activeCount === 1 ? "filter" : "filters"}
              </span>
              <span aria-hidden="true" style={{ color: "var(--ink-3)" }}>·</span>
              <span className="text-[13px]" style={{ color: "var(--ink-2)" }} role="status">
                {results.length} {results.length === 1 ? "result" : "results"}
              </span>
              {query && (
                <Chip active onClick={() => onFilters({ ...filters, q: "" })} title="Clear the search">
                  “{query}”
                  <Icon name="close" size={12} />
                </Chip>
              )}
              {filters.area !== "all" && (
                <Chip active onClick={() => onFilters({ ...filters, area: "all" })} title="Show all areas">
                  {AREAS[filters.area].name}
                  <Icon name="close" size={12} />
                </Chip>
              )}
              {chips.map(({ key, value }) => (
                <Chip key={`${key}-${value}`} active onClick={() => onFilters({ ...filters, [key]: filters[key].filter((v) => v !== value) })} title={`Remove ${value}`}>
                  {value}
                  <Icon name="close" size={12} />
                </Chip>
              ))}
              {filters.added !== "any" && (
                <Chip active onClick={() => onFilters({ ...filters, added: "any" })} title="Remove the added-within filter">
                  Added: {ADDED_LABELS[filters.added]}
                  <Icon name="close" size={12} />
                </Chip>
              )}
              <button type="button" onClick={() => onFilters({ ...EMPTY_FILTERS })} className="ml-1 cursor-pointer text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
                Clear all
              </button>
            </div>
          )}
          {results.length > 0 ? (
            layout === "list" && !present ? (
              <div className="flex flex-col gap-2.5">
                {results.map((s, i) => (
                  renderRow ? <div key={s.id} className="min-w-0">{renderRow(s, i)}</div> : <SolutionRow key={s.id} solution={s} present={present} index={i} favoritable={!catalogueOnly} />
                ))}
              </div>
            ) : (
              <div className={`grid gap-5 sm:grid-cols-2 ${present || rail ? "xl:grid-cols-3" : "lg:grid-cols-3 xl:grid-cols-4"}`}>
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

function RefineCount({ count }: { count: number }) {
  return (
    <span className="grid h-4 min-w-4 place-items-center rounded-full px-1 font-mono text-[10px] leading-none" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
      {count}
    </span>
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
    // A neutral surface with a hairline border; focus raises the border to the accent (`.search-field`).
    <div className="search-field flex h-[50px] items-center gap-3 rounded-[12px] px-4">
      <Icon name="search" size={18} className="shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search solutions, business challenges, capabilities, and more..."
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
  /** The area's own colour (`--sa-*`): its dot, and the tint when chosen. "All areas" has none and tints blue-grey. */
  color?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="area-filter inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] px-2.5 text-[13.5px] whitespace-nowrap"
      style={color ? { "--area": color } as React.CSSProperties : undefined}>
      {color && <span aria-hidden="true" className="size-[7px] shrink-0 rounded-full" style={{ background: color }} />}
      {label}
      {/* An empty area stays listed, its count quieter still. */}
      <span className="font-mono text-[11px]" style={{ color: "var(--ink-3)", opacity: count === 0 ? 0.6 : 1 }}>{count}</span>
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
  const windowed = !mostRestrictive && filters.added !== "any";

  return (
    <div className="glass glass-sheen animate-scale-in grid place-items-center rounded-[22px] px-6 py-20 text-center">
      <p className="eyebrow">No matches</p>
      <h3 className="mt-3 text-[22px] font-semibold">Nothing matched that</h3>
      <p className="mt-2 max-w-[44ch] text-[15px]" style={{ color: "var(--ink-2)" }}>
        {mostRestrictive
          ? `The narrowest filter right now is “${mostRestrictive.value}”. Dropping it usually brings the shelf back.`
          : windowed
            ? `Nothing was added in the ${ADDED_LABELS[filters.added].toLowerCase()}. Widening the time range usually brings the shelf back.`
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
              : windowed ? { ...filters, added: "any" } : EMPTY_FILTERS,
          )
        }
        className="mt-6 cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          background: "var(--accent)",
          color: "var(--on-accent)",
        }}
      >
        {mostRestrictive ? `Remove “${mostRestrictive.value}”` : windowed ? "Show any time" : "Reset the view"}
      </button>
    </div>
  );
}