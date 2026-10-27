import { useId, useState } from "react";
import { Icon } from "./Icon";
import { SelectPicker } from "./SelectPicker";
import type { NewTechnology } from "../lib/technologyName";

/** How the librarian settled one possible duplicate: replaced by an existing technology, or kept as its own entry. */
export type DuplicateDecision = { kind: "existing"; existing: string } | { kind: "kept" };

const decisionButton = "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";

/**
 * One warning row: a submitted technology and its matches. `pair`: the match is also on the solution, so the two
 * look-alikes share one row. `stays`: a resolved row whose match was already on the solution (it was removed, not swapped).
 */
type Row = NewTechnology & { pair?: string; stays?: boolean };

/**
 * New technologies that resemble an existing one: possible duplicates, never confirmed errors. Each one gets its own
 * decision, so the librarian settles them one by one: use the existing catalogue entry (a librarian edit of the
 * solution's technologies) or keep the submitted one as its own entry. When both look-alikes are on the solution
 * (`technologies`), they share one row instead of two that contradict each other: remove either, or keep both.
 * A removed technology is never offered as a match again. Nothing renders when there are none.
 * Without `editable` (the record cannot be edited now) the comparison shows with no decision buttons. With `blocked`
 * (the librarian may review but not edit it, e.g. their own solution) the changing buttons stay visible but disabled,
 * with the reason, and keeping still works: it changes no data.
 */
export function DuplicateTechnologies({ suspects, technologies = [], decisions, editable, blocked, busy, error, onUseExisting, onKeep, onUndoKeep }: {
  suspects: NewTechnology[];
  /** The solution's technologies, to tell a look-alike already on it from one only in the catalogue. */
  technologies?: readonly string[];
  decisions: Readonly<Record<string, DuplicateDecision>>;
  editable: boolean;
  /** Why the changing buttons are unavailable while the librarian can still decide. */
  blocked?: string;
  /** The technology whose replacement is being saved. */
  busy?: string;
  error?: { name: string; message: string };
  onUseExisting: (name: string, existing: string) => void;
  onKeep: (name: string) => void;
  onUndoKeep: (name: string) => void;
}) {
  const heading = useId();
  const onSolution = new Set(technologies);
  const removed = new Map(Object.entries(decisions).flatMap(([name, decision]) => decision.kind === "existing" ? [[name, decision.existing] as const] : []));
  const rows: Row[] = [];
  const paired = new Set<string>();
  for (const suspect of suspects) {
    const similar = suspect.similar.filter(name => !removed.has(name));
    if (!similar.length || paired.has(suspect.name)) continue;
    const pair = similar.find(name => onSolution.has(name));
    if (pair) paired.add(pair);
    rows.push(pair ? { name: suspect.name, similar: [pair], pair } : { name: suspect.name, similar });
  }
  // A replaced or removed technology leaves the solution, so it is no longer a suspect: it stays listed as resolved.
  for (const [name, existing] of removed) if (!suspects.some(item => item.name === name)) rows.push({ name, similar: [existing], stays: onSolution.has(existing) });
  if (!rows.length) return null;
  const resolved = rows.filter(row => decisions[row.name] || (row.pair && decisions[row.pair])).length;
  const decidable = editable || !!blocked;
  const blockedId = blocked ? `${heading}-blocked` : undefined;
  return <section aria-labelledby={heading} className="mt-4 rounded-xl border p-4 text-[14px]" style={{ borderColor: "color-mix(in srgb, var(--proto) 40%, transparent)" }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id={heading} className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--proto)" }}><Icon name="alert" size={14} />Possible duplicate {rows.length === 1 ? "technology" : "technologies"}</h3>
      <span className="font-mono text-[11px] text-(--ink-3)">{resolved} / {rows.length} resolved</span>
    </div>
    <p className="mt-1 text-[13.5px] text-(--ink-2)">This technology may already exist in the catalog. Review the suggested match and choose whether to use the existing technology or keep the submitted one.</p>
    <ul className="mt-3 space-y-2">
      {rows.map(row => <DuplicateRow key={row.name} row={row} decisions={decisions} editable={editable} decidable={decidable} blockedId={blockedId} busy={busy}
        error={error && (error.name === row.name || error.name === row.pair) ? error.message : undefined}
        onUseExisting={onUseExisting} onKeep={onKeep} onUndoKeep={onUndoKeep} />)}
    </ul>
    {resolved < rows.length && (editable ? <p className="mt-2.5 text-[12.5px] text-(--ink-3)">Using or removing a technology changes the solution, so it counts as your edit: explain it to the owner when you decide.</p>
      : blocked && <p id={blockedId} className="mt-2.5 text-[12.5px] text-(--ink-2)">{blocked}</p>)}
  </section>;
}

function DuplicateRow({ row, decisions, editable, decidable, blockedId, busy, error, onUseExisting, onKeep, onUndoKeep }: {
  row: Row; decisions: Readonly<Record<string, DuplicateDecision>>; editable: boolean; decidable: boolean; blockedId?: string; busy?: string; error?: string;
  onUseExisting: (name: string, existing: string) => void; onKeep: (name: string) => void; onUndoKeep: (name: string) => void;
}) {
  const [match, setMatch] = useState(row.similar[0]);
  const existing = row.similar.includes(match) ? match : row.similar[0];
  const { name, pair } = row;
  const decision = decisions[name] ?? (pair ? decisions[pair] : undefined);
  // Buttons that change the solution: disabled, pointing at the reason, when the librarian may not edit it.
  const changing = { disabled: !!busy || !editable, "aria-describedby": editable ? undefined : blockedId };
  if (decision) {
    const subject = decisions[name] ? name : pair ?? name;
    const other = decision.kind === "existing" ? decision.existing : pair;
    return <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[13.5px]" style={{ borderColor: "color-mix(in srgb, var(--live) 35%, transparent)", background: "color-mix(in srgb, var(--live) 6%, transparent)" }}>
      <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ color: "var(--live)", background: "color-mix(in srgb, var(--live) 16%, transparent)" }}><Icon name="check" size={12} /></span>
      <span className="min-w-0 flex-1">{decision.kind === "existing"
        ? pair || row.stays ? <>Removed <span className="font-semibold">{subject}</span>; <span className="font-semibold">{other}</span> stays</>
          : <>Replaced <span className="font-semibold">{subject}</span> with the existing <span className="font-semibold">{other}</span></>
        : pair ? <>Kept both <span className="font-semibold">{name}</span> and <span className="font-semibold">{pair}</span></>
          : <>Kept <span className="font-semibold">{name}</span> as a separate technology</>}</span>
      {decision.kind === "kept" && decidable && <button type="button" onClick={() => { onUndoKeep(name); if (pair) onUndoKeep(pair); }} disabled={!!busy} aria-label={`Undo: decide again for ${pair ? `${name} and ${pair}` : name}`} className="cursor-pointer rounded-md px-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ color: "var(--accent)" }}>Undo</button>}
    </li>;
  }
  // Compact rows: what to decide on the left, its buttons on the same line at the right (they wrap below on narrow screens).
  const shell = "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-(--glass-edge) bg-(--ink)/3 px-3 py-2.5";
  const failure = error && <p role="alert" className="basis-full text-[13px]" style={{ color: "var(--proto)" }}>{error}</p>;
  if (pair) return <li className={shell}>
    <div className="min-w-0 flex-1 basis-72">
      <p className="text-[13.5px] font-semibold break-words">{name} <span className="font-normal text-(--ink-3)">and</span> {pair}</p>
      <p className="mt-0.5 text-[12.5px] text-(--ink-2)">Both technologies are listed in this solution and may overlap. Remove one if it's not needed, or keep both if they serve different purposes.</p>
    </div>
    {decidable && <div className="flex shrink-0 flex-wrap items-center gap-2">
      {[name, pair].map(target => <button key={target} type="button" {...changing} onClick={() => onUseExisting(target, target === name ? pair : name)} aria-label={`Remove ${target}; keep ${target === name ? pair : name}`} className={`${decisionButton} border border-(--glass-edge) text-(--ink)`}>
        <Icon name="close" size={13} />{busy === target ? "Removing…" : `Remove ${target}`}
      </button>)}
      <button type="button" disabled={!!busy} onClick={() => { onKeep(name); onKeep(pair); }} aria-label={`Keep both ${name} and ${pair}`} className={`${decisionButton} border border-(--glass-edge) text-(--ink-2)`}>Keep both</button>
    </div>}
    {failure}
  </li>;
  return <li className={shell}>
    <dl className="grid min-w-0 flex-1 basis-72 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[13.5px]">
      <dt className="text-(--ink-3)">Submitted technology</dt>
      <dd className="font-semibold break-words">{name}</dd>
      <dt className="text-(--ink-3)">Existing technology</dt>
      <dd className="min-w-0">{row.similar.length > 1 && editable
        ? <SelectPicker compact label={`Existing technology to use instead of ${name}`} value={existing} options={row.similar} onChange={setMatch} />
        : <span className="font-semibold break-words">{existing}</span>}</dd>
    </dl>
    {decidable && <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button type="button" {...changing} onClick={() => onUseExisting(name, existing)} aria-label={`Use existing: replace ${name} with ${existing}`} className={decisionButton} style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        <Icon name="check" size={13} />{busy === name ? "Replacing…" : "Use existing"}
      </button>
      <button type="button" disabled={!!busy} onClick={() => onKeep(name)} aria-label={`Keep submitted: keep ${name} as a separate technology`} className={`${decisionButton} border border-(--glass-edge) text-(--ink-2)`}>
        Keep submitted
      </button>
    </div>}
    {failure}
  </li>;
}
