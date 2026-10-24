import { useEffect, useId, useRef, useState } from "react";
import type { Solution } from "../types";
import { SolutionCard, type CardManagement } from "../components/SolutionCard";
import { SubmissionRow } from "../components/SubmissionRow";
import { Chip } from "../components/Badges";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OverflowMenu } from "../components/OverflowMenu";
import { SelectPicker } from "../components/SelectPicker";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { navigate } from "../lib/router";
import { submissionState } from "../lib/submissionState";
import { feedbackKeys, openFeedback, setFeedbackItems, suggestionFeedbackKey, useFeedbackSeen } from "../lib/feedbackSeen";

/**
 * Status filters, plus "Has suggestions": every solution that ever received one, which is no status. New ones already
 * lead the attention list, so here the filter keeps the history too, with the ones still open first.
 */
const FILTERS = ["All", "Draft", "Pending review", "Changes requested", "Published", "Has suggestions"] as const;
/** All my solutions' order: the last change first by default (`modifiedon`; until the API sends it, the date added). */
const SORTS = ["updated", "added", "name"] as const;
type Sort = typeof SORTS[number];
const SORT_LABELS: Record<Sort, string> = { updated: "Recently updated", added: "Recently added", name: "Name (A–Z)" };
const changedOn = (solution: Solution) => solution.updatedOn ?? solution.createdOn ?? solution.dateAdded ?? "";
const addedOn = (solution: Solution) => solution.createdOn ?? solution.dateAdded ?? "";
type Filter = typeof FILTERS[number];
/** Suggestions on a published solution: the count, the distinct authors (newest first) and their ids. */
export type SuggestionSummary = { count: number; authors: string[]; ids: string[] };
const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** Rows the attention list shows before "Show all". */
const ATTENTION_ROWS = 4;
/** Grid or list for All my solutions, remembered for the session like the library's. */
const LAYOUT_KEY = "prisma.submissions.layout";
function rememberedLayout(): "grid" | "list" {
  try { return sessionStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; }
}

/**
 * Two parts. "Needs your attention", only when something is open: one row per solution, returned drafts (Changes
 * requested, which block publication) first, then solutions with new suggestions; its title counts solutions, not
 * items. Below, every solution as cards with one row of status filters. `suggestions` (connected only) also puts a
 * compact count on each card's footer.
 */
export function MySubmissionsView({ entries, onDelete, connected = false, onOpen, onEdit, actions, renderCard, suggestions }: { entries: { solution: Solution }[]; onDelete?: (id: string) => Promise<void>; connected?: boolean; onOpen?: (solution: Solution) => void; onEdit?: (solution: Solution) => void; actions?: React.ReactNode; renderCard?: (solution: Solution, index: number, manage: CardManagement) => React.ReactNode; suggestions?: Readonly<Record<string, SuggestionSummary>> }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [attentionAll, setAttentionAll] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">(rememberedLayout);
  const [sort, setSort] = useState<Sort>("updated");
  const chooseLayout = (next: "grid" | "list") => { setLayout(next); try { sessionStorage.setItem(LAYOUT_KEY, next); } catch { void 0; } };
  useFeedbackSeen();
  // Open feedback items: a draft returned with Changes requested (until resubmitted) and each unaddressed suggestion.
  // Counts are items, so they fall as suggestions are addressed and returned drafts are resubmitted.
  const keys = (solution: Solution) => feedbackKeys(solution, suggestions?.[solution.id]?.ids ?? []);
  const openOn = (solution: Solution) => openFeedback(keys(solution));
  // Share this page's fresh data with the masthead's dot (no extra reads). Connected waits for the suggestions.
  const ready = !connected || suggestions !== undefined;
  const allKeys = ready ? JSON.stringify(entries.map(({ solution }) => keys(solution))) : "";
  useEffect(() => { if (allKeys) setFeedbackItems(JSON.parse(allKeys) as string[][]); }, [allKeys]);
  const attentionId = useId();
  const [feedbackTarget, setFeedbackTarget] = useState<Solution | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Solution | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const newSubmissionRef = useRef<HTMLButtonElement>(null);
  const confirmDelete = async () => {
    if (!deleteTarget || deleting || !onDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await onDelete(deleteTarget.id);
      setDeleteTarget(null);
      newSubmissionRef.current?.focus();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete the submission. Try again.");
    } finally {
      setDeleting(false);
    }
  };
  const edit = (solution: Solution) => onEdit ? onEdit(solution) : navigate(`/submit/${solution.id}`);
  // Connected Pending review and Published records are not edited in place: they are withdrawn from their submission page.
  const editable = (solution: Solution) => !connected || solution.publicationStatus === "Draft";
  const manage = (solution: Solution): CardManagement => {
    const name = solution.name || "Untitled solution";
    const suggestionCount = suggestions?.[solution.id]?.count ?? 0;
    return {
      // Returned and retired records both carry the librarian's words the owner needs to act on.
      onFeedback: ["Changes requested", "Retired"].includes(submissionState(solution)) && solution.reviewComments ? () => setFeedbackTarget(solution) : undefined,
      unread: openOn(solution).length,
      actionNeeded: submissionState(solution) === "Changes requested",
      // Edit sits on the image's top-right corner, readable over any thumbnail; the footer keeps the count and •••.
      corner: editable(solution) ? <button type="button" aria-label={`Edit ${name}`} onClick={() => edit(solution)} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold shadow-sm backdrop-blur-sm transition-colors hover:brightness-110" style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", background: "color-mix(in srgb, var(--ground) 88%, transparent)" }}><Icon name="edit" size={14} />Edit</button> : undefined,
      actions: <>
        {/* A librarian edited it (ADR-0013); the solution page shows when and their explanation. */}
        {solution.librarianEditedOn && <span title={`Edited by the librarian on ${solution.librarianEditedOn}`} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12px] font-semibold" style={{ color: "var(--accent)" }}><Icon name="edit" size={13} />Edited by librarian</span>}
        {/* Opens the solution, where its suggestions are listed below the details; no names on the card. */}
        {suggestionCount > 0 && <button type="button" onClick={() => open(solution)} title="View suggestions" aria-label={`View ${plural(suggestionCount, "suggestion")} for ${name}`}
          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold transition-colors hover:brightness-110" style={{ color: "var(--accent)", borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }}>
          <Icon name="message" size={15} />{suggestionCount}
        </button>}
        {onDelete && <OverflowMenu label={`More actions for ${name}`} items={[{ label: "Delete submission", icon: "trash", onSelect: () => { setDeleteError(""); setDeleteTarget(solution); } }]} />}
      </>,
    };
  };
  const openSuggestionsOn = (solution: Solution) => openFeedback((suggestions?.[solution.id]?.ids ?? []).map(suggestionFeedbackKey)).length;
  const matches = (solution: Solution, option: Filter) => option === "All" || (option === "Has suggestions" ? (suggestions?.[solution.id]?.count ?? 0) > 0 : submissionState(solution) === option);
  const count = (option: Filter) => entries.filter(({ solution }) => matches(solution, option)).length;
  const filtered = entries.filter(({ solution }) => matches(solution, filter));
  // The chosen order; under Has suggestions, the solutions with new ones still come first, most first.
  const ordered = [...filtered].sort(({ solution: left }, { solution: right }) => sort === "name"
    ? (left.name || "").localeCompare(right.name || "")
    : (sort === "updated" ? changedOn(right).localeCompare(changedOn(left)) : addedOn(right).localeCompare(addedOn(left))) || (left.name || "").localeCompare(right.name || ""));
  const visible = filter === "Has suggestions" ? ordered.sort((left, right) => openSuggestionsOn(right.solution) - openSuggestionsOn(left.solution)) : ordered;
  // One card everywhere: status, Edit, •••, and opening the solution (where its suggestions are read).
  const open = (solution: Solution) => onOpen ? onOpen(solution) : solution.publicationStatus === "Draft" ? navigate(`/submit/${solution.id}`) : navigate(`/s/${solution.id}`);
  const card = (solution: Solution, index: number) => renderCard ? renderCard(solution, index, manage(solution)) : <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet" }} present={false} index={index} showPublicationStatus manage={manage(solution)} onOpen={onOpen ? () => onOpen(solution) : solution.publicationStatus === "Draft" ? () => navigate(`/submit/${solution.id}`) : undefined} />;
  // Needs your attention: returned drafts first (the librarian is waiting on the owner), then new suggestions, most first.
  const returned = entries.map(({ solution }) => solution).filter(solution => submissionState(solution) === "Changes requested");
  const suggested = entries.map(({ solution }) => ({ solution, fresh: openSuggestionsOn(solution) }))
    .filter(entry => entry.fresh > 0 && submissionState(entry.solution) !== "Changes requested")
    .sort((left, right) => right.fresh - left.fresh);
  const attention = [...returned.map(solution => ({ solution, fresh: 0 })), ...suggested];
  const newSuggestions = suggested.reduce((total, entry) => total + entry.fresh, 0);
  const shownAttention = attentionAll ? attention : attention.slice(0, ATTENTION_ROWS);
  const breakdown = [
    ...(returned.length ? [<span key="returned" className="font-semibold" style={{ color: "var(--proto)" }}>{returned.length} changes requested</span>] : []),
    ...(newSuggestions ? [<span key="suggestions" className="font-semibold" style={{ color: "var(--accent)" }}>{plural(newSuggestions, "new suggestion")}</span>] : []),
  ];
  return <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="eyebrow">Contributor workspace</p>
        <h1 className="mt-2 text-[26px]">My submissions</h1>
        {!connected && <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>Saved in this browser only. No Dataverse records or notifications.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <button ref={newSubmissionRef} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }} onClick={() => navigate("/submit")}><Icon name="plus" />New submission</button>
      </div>
    </div>
    {attention.length > 0 && <section aria-labelledby={`${attentionId}-title`} className="attention-panel mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3.5 pb-2.5 sm:px-5">
        <h2 id={`${attentionId}-title`} className="flex items-center gap-2 text-[16px] font-semibold">Needs your attention
          <span className={`section-nav-count ${returned.length ? "section-nav-count--changes" : "section-nav-count--open"}`} aria-label={plural(attention.length, "solution")}>{attention.length}</span></h2>
        <p className="text-[13px]">{breakdown.flatMap((part, index) => index ? [<span key={`dot-${index}`} aria-hidden="true" style={{ color: "var(--ink-3)" }}> · </span>, part] : [part])}</p>
      </div>
      <ul className="attention-list">
        {shownAttention.map(({ solution, fresh }) => {
          const name = solution.name || "Untitled solution";
          const changes = !fresh;
          return <li key={solution.id} className={`attention-row ${changes ? "attention-row--changes" : ""}`}>
            <span aria-hidden="true" className="attention-icon"><Icon name={changes ? "alert" : "message"} size={16} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold" style={{ color: "var(--ink)" }}>{name}</span>
              <span className="block text-[12.5px]" style={{ color: "var(--ink-2)" }}>{changes ? "Changes requested by the librarian. Update it and resubmit to publish it." : `${plural(fresh, "new suggestion")} from colleagues. Read and address them on the solution page.`}</span>
            </span>
            {changes
              ? <button type="button" className="attention-action attention-action--changes" onClick={() => solution.reviewComments ? setFeedbackTarget(solution) : edit(solution)} aria-label={`Review changes for ${name}`}>Review changes</button>
              : <button type="button" className="attention-action" onClick={() => open(solution)} aria-label={`View suggestions for ${name}`}>View suggestions</button>}
          </li>;
        })}
      </ul>
      {attention.length > ATTENTION_ROWS && <button type="button" className="mx-4 mb-3 cursor-pointer text-[13px] font-semibold sm:mx-5" style={{ color: "var(--accent)" }} onClick={() => setAttentionAll(!attentionAll)}>{attentionAll ? "Show fewer" : `Show all ${attention.length}`}</button>}
    </section>}
    <section aria-labelledby={`${attentionId}-all`} className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${attentionId}-all`} className="section-title">All my solutions</h2>
        {entries.length > 0 && <div className="flex flex-wrap items-center gap-2">
        <SelectPicker compact label="Sort my solutions" value={sort} options={SORTS} getLabel={value => SORT_LABELS[value]} buttonPrefix="Sort by" buttonClassName="toolbar-select flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] outline-none" onChange={setSort} />
        <div className="view-toggle" role="group" aria-label="Layout">
          {(["grid", "list"] as const).map(option => <button key={option} type="button" aria-pressed={layout === option} aria-label={option === "grid" ? "Grid view" : "List view"} title={option === "grid" ? "Grid view" : "List view"} onClick={() => chooseLayout(option)}><Icon name={option} size={15} /></button>)}
        </div>
        </div>}
      </div>
    {!entries.length ? <div className="py-20 text-center">
      <h2 className="text-[20px]">No submissions yet</h2>
      <p className="mt-2" style={{ color: "var(--ink-2)" }}>No saved drafts or submitted solutions.</p>
    </div> : <>
      <div role="group" aria-label="Filter by status" className="mt-4 flex flex-wrap items-center gap-2">
        {FILTERS.filter(option => option !== "Has suggestions" || suggestions).map(option => {
          const total = count(option);
          return <Chip key={option} active={filter === option} pressed={filter === option} onClick={() => setFilter(option)}>
            {/* Changes requested carries an amber dot while any exist; Has suggestions a blue comment icon, so it never reads as a status. */}
            {option === "Changes requested" && total > 0 && filter !== option && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--proto)" }} />}
            {option === "Has suggestions" && <span aria-hidden="true" className="inline-flex" style={{ color: filter === option ? "currentColor" : "var(--accent)" }}><Icon name="message" size={13} /></span>}
            {option}
            <span className="font-mono text-[11px] opacity-75">{total}</span>
          </Chip>;
        })}
      </div>
      {!visible.length ? <div className="py-16 text-center">
        <h2 className="text-[20px]">No submissions in this status</h2>
        <button type="button" className="mt-3 cursor-pointer text-[14px] font-semibold" style={{ color: "var(--accent)" }} onClick={() => setFilter("All")}>Show all submissions</button>
      </div> : layout === "list" ? <div className="mt-6 flex flex-col gap-2.5">
        {visible.map(({ solution }, index) => <article key={solution.id} className="min-w-0"><SubmissionRow solution={solution} index={index} manage={manage(solution)} onOpen={() => open(solution)} /></article>)}
      </div> : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map(({ solution }, index) => <article key={solution.id} className="grid min-w-0">{card(solution, index)}</article>)}
      </div>}
    </>}
    </section>
    {feedbackTarget && <FeedbackPanel name={feedbackTarget.name || "Untitled solution"} feedback={feedbackTarget.reviewComments ?? ""} retired={feedbackTarget.publicationStatus === "Retired"} onClose={() => setFeedbackTarget(null)} onEdit={editable(feedbackTarget) ? () => { const target = feedbackTarget; setFeedbackTarget(null); edit(target); } : undefined} />}
    {deleteTarget && <ConfirmDialog title="Delete submission?" confirmLabel={deleting ? "Deleting..." : "Delete submission"} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
      <p className="break-words text-[14px]">Permanently delete "{deleteTarget.name}" and its attached media from {connected ? "Dataverse" : "this browser"}? This cannot be undone.{deleteTarget.publicationStatus === "Published" ? " It will also be removed from the library and published access revoked." : ""}</p>
      {deleteError && <p role="alert" className="mt-3 text-[14px]">{deleteError}</p>}
    </ConfirmDialog>}
  </div>;
}
