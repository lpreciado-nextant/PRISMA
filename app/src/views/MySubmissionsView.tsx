import { useEffect, useId, useRef, useState } from "react";
import type { Solution } from "../types";
import { SolutionCard, type CardManagement } from "../components/SolutionCard";
import { Chip } from "../components/Badges";
import { Icon } from "../components/Icon";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { OverflowMenu } from "../components/OverflowMenu";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { navigate } from "../lib/router";
import { submissionState } from "../lib/submissionState";
import { feedbackKeys, isAddressed, openFeedback, reviewFeedbackKey, setFeedbackItems, suggestionFeedbackKey, useFeedbackSeen } from "../lib/feedbackSeen";

const FILTERS = ["All", "Draft", "Pending review", "Changes requested", "Published"] as const;
type Filter = typeof FILTERS[number];
const matches = (solution: Solution, filter: Filter) => filter === "All" || submissionState(solution) === filter;
/** Suggestions on a published solution: the count, the distinct authors (newest first) and their ids. */
export type SuggestionSummary = { count: number; authors: string[]; ids: string[] };
const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

type Tab = "solutions" | "suggestions";

/**
 * Two levels: primary tabs (My solutions, and Suggestions when the caller supplies `suggestionsTab`), then, under My
 * solutions only, the publication status chips. Suggestions are not a status. `suggestions` (connected only) puts a
 * compact count on each card's footer. Librarian comments need no filter: Changes requested has them.
 */
export function MySubmissionsView({ entries, onDelete, connected = false, onOpen, onEdit, actions, renderCard, suggestions, suggestionsTab }: { entries: { solution: Solution }[]; onDelete?: (id: string) => Promise<void>; connected?: boolean; onOpen?: (solution: Solution) => void; onEdit?: (solution: Solution) => void; actions?: React.ReactNode; renderCard?: (solution: Solution, index: number, manage: CardManagement) => React.ReactNode; suggestions?: Readonly<Record<string, SuggestionSummary>>; suggestionsTab?: { count: number } }) {
  const [filter, setFilter] = useState<Filter>("All");
  const [tab, setTab] = useState<Tab>("solutions");
  // Under Suggestions: only the solutions with suggestions still to address, or all that have any.
  const [suggestionView, setSuggestionView] = useState<"new" | "all">("new");
  useFeedbackSeen();
  // Open feedback items: a draft returned with Changes requested (until resubmitted) and each unaddressed suggestion.
  // Counts are items, so they fall as suggestions are addressed and returned drafts are resubmitted.
  const keys = (solution: Solution) => feedbackKeys(solution, suggestions?.[solution.id]?.ids ?? []);
  const openOn = (solution: Solution) => openFeedback(keys(solution));
  // Share this page's fresh data with the masthead's dot (no extra reads). Connected waits for the suggestions.
  const ready = !connected || suggestions !== undefined;
  const allKeys = ready ? entries.flatMap(({ solution }) => keys(solution)).join("|") : "";
  useEffect(() => { if (allKeys) setFeedbackItems(allKeys.split("|")); }, [allKeys]);
  const tabsId = useId();
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
  const count = (option: Filter) => entries.filter(({ solution }) => matches(solution, option)).length;
  const visible = entries.filter(({ solution }) => matches(solution, filter));
  // "N new" on each tab: unconfirmed librarian comments under My solutions, unconfirmed suggestions under Suggestions.
  const newOnSolutions = entries.filter(({ solution }) => { const key = reviewFeedbackKey(solution); return !!key && !isAddressed(key); }).length;
  const newOnSuggestions = entries.reduce((total, { solution }) => total + openFeedback((suggestions?.[solution.id]?.ids ?? []).map(suggestionFeedbackKey)).length, 0);
  // One card everywhere: status, Edit, •••, and opening the solution (where its suggestions are read).
  const open = (solution: Solution) => onOpen ? onOpen(solution) : solution.publicationStatus === "Draft" ? navigate(`/submit/${solution.id}`) : navigate(`/s/${solution.id}`);
  const card = (solution: Solution, index: number) => renderCard ? renderCard(solution, index, manage(solution)) : <SolutionCard solution={{ ...solution, name: solution.name || "Untitled solution", summary: solution.summary || "No summary yet" }} present={false} index={index} showPublicationStatus manage={manage(solution)} onOpen={onOpen ? () => onOpen(solution) : solution.publicationStatus === "Draft" ? () => navigate(`/submit/${solution.id}`) : undefined} />;
  const suggested = entries.filter(({ solution }) => (suggestions?.[solution.id]?.count ?? 0) > 0);
  const openSuggestionsOn = (solution: Solution) => openFeedback((suggestions?.[solution.id]?.ids ?? []).map(suggestionFeedbackKey)).length;
  const withNew = suggested.filter(({ solution }) => openSuggestionsOn(solution) > 0);
  const listed = suggestionView === "new" ? withNew : suggested;
  const showing: Tab = suggestionsTab ? tab : "solutions";
  const tabs: { value: Tab; label: string; count: number; fresh: number }[] = [{ value: "solutions", label: "My solutions", count: entries.length, fresh: newOnSolutions }, ...(suggestionsTab ? [{ value: "suggestions" as const, label: "Suggestions", count: suggestionsTab.count, fresh: newOnSuggestions }] : [])];
  // Arrow keys move between the primary tabs, as in a standard tablist.
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setTab(next.value);
    document.getElementById(`${tabsId}-${next.value}`)?.focus();
  };
  return <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <div className={`flex flex-wrap items-center justify-between gap-4 ${suggestionsTab ? "" : "border-b pb-5"}`} style={{ borderColor: "var(--glass-edge)" }}>
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
    {/* Primary tabs, underlined like the review queue's; status chips belong to My solutions only. */}
    {suggestionsTab && <div role="tablist" aria-label="My submissions" className="mt-5 flex flex-wrap gap-1 border-b border-(--glass-edge)">
      {tabs.map((option, index) => {
        const active = showing === option.value;
        return <button key={option.value} id={`${tabsId}-${option.value}`} type="button" role="tab" aria-selected={active} aria-controls={`${tabsId}-panel`} tabIndex={active ? 0 : -1}
          onClick={() => setTab(option.value)} onKeyDown={event => onTabKey(event, index)}
          className="-mb-px cursor-pointer border-b-[3px] px-3 py-3 text-[14px] font-semibold transition-colors" style={{ borderColor: active ? "var(--accent)" : "transparent", color: active ? "var(--accent)" : "var(--ink-2)" }}>
          {option.label}
          <span className="ml-2 rounded-full px-1.5 py-0.5 font-mono text-[11.5px]" style={{ background: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "color-mix(in srgb, var(--ink) 7%, transparent)" }}>{option.count}</span>
          {option.fresh > 0 && <span className="tab-new">{option.fresh} new</span>}
        </button>;
      })}
    </div>}
    <div id={`${tabsId}-panel`} role={suggestionsTab ? "tabpanel" : undefined} aria-labelledby={suggestionsTab ? `${tabsId}-${showing}` : undefined}>
    {showing === "suggestions" ? !suggested.length ? <div className="py-16 text-center">
      <h2 className="text-[20px]">No suggestions yet</h2>
      <p className="mt-2" style={{ color: "var(--ink-2)" }}>When colleagues suggest improvements to your published solutions, they appear here.</p>
    </div> : <>
      <div role="group" aria-label="Filter suggestions" className="mt-5 flex flex-wrap items-center gap-2">
        {([["new", "New", withNew.length], ["all", "All", suggested.length]] as const).map(([value, label, total]) => <Chip key={value} active={suggestionView === value} pressed={suggestionView === value} onClick={() => setSuggestionView(value)}>
          {value === "new" && total > 0 && suggestionView !== value && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />}
          {label}
          <span className="font-mono text-[11px] opacity-75">{total}</span>
        </Chip>)}
      </div>
      {!listed.length ? <div className="py-16 text-center">
        <h2 className="text-[20px]">Nothing new</h2>
        <p className="mt-2" style={{ color: "var(--ink-2)" }}>Every suggestion on your solutions has been addressed.</p>
        <button type="button" className="mt-3 cursor-pointer text-[14px] font-semibold" style={{ color: "var(--accent)" }} onClick={() => setSuggestionView("all")}>Show all</button>
      </div> : <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {/* Only the cards: each opens its solution, where the suggestions are read below the details. */}
        {listed.map(({ solution }, index) => <article key={solution.id} className="min-w-0">{card(solution, index)}</article>)}
      </div>}
    </> : <>
    {!entries.length ? <div className="py-20 text-center">
      <h2 className="text-[20px]">No submissions yet</h2>
      <p className="mt-2" style={{ color: "var(--ink-2)" }}>No saved drafts or submitted solutions.</p>
    </div> : <>
      <div role="group" aria-label="Filter by status" className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map(option => {
          const total = count(option);
          return <Chip key={option} active={filter === option} pressed={filter === option} onClick={() => setFilter(option)}>
            {option === "Changes requested" && total > 0 && filter !== option && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--proto)" }} />}
            {option}
            <span className="font-mono text-[11px] opacity-75">{total}</span>
          </Chip>;
        })}
      </div>
      {!visible.length ? <div className="py-16 text-center">
        <h2 className="text-[20px]">No submissions in this status</h2>
        <button type="button" className="mt-3 cursor-pointer text-[14px] font-semibold" style={{ color: "var(--accent)" }} onClick={() => setFilter("All")}>Show all submissions</button>
      </div> : <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map(({ solution }, index) => <article key={solution.id} className="min-w-0">{card(solution, index)}</article>)}
      </div>}
    </>}
    </>}
    </div>
    {feedbackTarget && <FeedbackPanel name={feedbackTarget.name || "Untitled solution"} feedback={feedbackTarget.reviewComments ?? ""} retired={feedbackTarget.publicationStatus === "Retired"} onClose={() => setFeedbackTarget(null)} onEdit={editable(feedbackTarget) ? () => { const target = feedbackTarget; setFeedbackTarget(null); edit(target); } : undefined} />}
    {deleteTarget && <ConfirmDialog title="Delete submission?" confirmLabel={deleting ? "Deleting..." : "Delete submission"} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete}>
      <p className="break-words text-[14px]">Permanently delete "{deleteTarget.name}" and its attached media from {connected ? "Dataverse" : "this browser"}? This cannot be undone.{deleteTarget.publicationStatus === "Published" ? " It will also be removed from the library and published access revoked." : ""}</p>
      {deleteError && <p role="alert" className="mt-3 text-[14px]">{deleteError}</p>}
    </ConfirmDialog>}
  </div>;
}
