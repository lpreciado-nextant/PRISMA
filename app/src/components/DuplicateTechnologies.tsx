import { useId, useState } from "react";
import { Icon } from "./Icon";
import { SelectPicker } from "./SelectPicker";
import type { NewTechnology } from "../lib/technologyName";

/** How the librarian settled one possible duplicate: replaced by an existing technology, or kept as its own entry. */
export type DuplicateDecision = { kind: "existing"; existing: string } | { kind: "kept" };

const decisionButton = "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";

/**
 * New technologies that resemble an existing one: possible duplicates, never confirmed errors. Each one gets its own
 * decision, so the librarian settles them one by one: use the existing catalogue entry (a librarian edit of the
 * solution's technologies) or keep the submitted one as its own entry. Nothing renders when there are none.
 * Without `editable` (the record cannot be edited now) the comparison shows with no decision buttons.
 */
export function DuplicateTechnologies({ suspects, decisions, editable, busy, error, onUseExisting, onKeep, onUndoKeep }: {
  suspects: NewTechnology[];
  decisions: Readonly<Record<string, DuplicateDecision>>;
  editable: boolean;
  /** The technology whose replacement is being saved. */
  busy?: string;
  error?: { name: string; message: string };
  onUseExisting: (name: string, existing: string) => void;
  onKeep: (name: string) => void;
  onUndoKeep: (name: string) => void;
}) {
  const heading = useId();
  // A replaced technology leaves the solution, so it no longer appears as a suspect: it stays listed as resolved.
  const replaced = Object.entries(decisions).flatMap(([name, decision]) => decision.kind === "existing" && !suspects.some(item => item.name === name) ? [{ name, similar: [decision.existing] }] : []);
  const rows = [...suspects.filter(item => item.similar.length > 0), ...replaced];
  if (!rows.length) return null;
  const resolved = rows.filter(item => decisions[item.name]).length;
  return <section aria-labelledby={heading} className="mt-4 rounded-xl border p-4 text-[14px]" style={{ borderColor: "color-mix(in srgb, var(--proto) 40%, transparent)" }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id={heading} className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--proto)" }}><Icon name="alert" size={14} />Possible duplicate {rows.length === 1 ? "technology" : "technologies"}</h3>
      <span className="font-mono text-[11px] text-(--ink-3)">{resolved} / {rows.length} resolved</span>
    </div>
    <p className="mt-1 text-[13.5px] text-(--ink-2)">This technology may already exist in the catalog. Review the suggested match and choose whether to use the existing technology or keep the submitted one.</p>
    <ul className="mt-3 space-y-2">
      {rows.map(item => <DuplicateRow key={item.name} item={item} decision={decisions[item.name]} editable={editable} busy={busy} error={error?.name === item.name ? error.message : undefined}
        onUseExisting={existing => onUseExisting(item.name, existing)} onKeep={() => onKeep(item.name)} onUndoKeep={() => onUndoKeep(item.name)} />)}
    </ul>
    {editable && resolved < rows.length && <p className="mt-2.5 text-[12.5px] text-(--ink-3)">Use existing changes the solution's technologies, so it counts as your edit: explain it to the owner when you decide.</p>}
  </section>;
}

function DuplicateRow({ item, decision, editable, busy, error, onUseExisting, onKeep, onUndoKeep }: {
  item: NewTechnology; decision?: DuplicateDecision; editable: boolean; busy?: string; error?: string;
  onUseExisting: (existing: string) => void; onKeep: () => void; onUndoKeep: () => void;
}) {
  const [match, setMatch] = useState(item.similar[0]);
  const existing = item.similar.includes(match) ? match : item.similar[0];
  if (decision) return <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[13.5px]" style={{ borderColor: "color-mix(in srgb, var(--live) 35%, transparent)", background: "color-mix(in srgb, var(--live) 6%, transparent)" }}>
    <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ color: "var(--live)", background: "color-mix(in srgb, var(--live) 16%, transparent)" }}><Icon name="check" size={12} /></span>
    <span className="min-w-0 flex-1">{decision.kind === "existing"
      ? <>Replaced <span className="font-semibold">{item.name}</span> with the existing <span className="font-semibold">{decision.existing}</span></>
      : <>Kept <span className="font-semibold">{item.name}</span> as a separate technology</>}</span>
    {decision.kind === "kept" && editable && <button type="button" onClick={onUndoKeep} disabled={!!busy} aria-label={`Undo: decide again for ${item.name}`} className="cursor-pointer rounded-md px-1.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ color: "var(--accent)" }}>Undo</button>}
  </li>;
  const saving = busy === item.name;
  return <li className="rounded-lg border border-(--glass-edge) bg-(--ink)/3 px-3 py-2.5">
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-[13.5px]">
      <dt className="text-(--ink-3)">Submitted technology</dt>
      <dd className="font-semibold break-words">{item.name}</dd>
      <dt className="text-(--ink-3)">Existing technology</dt>
      <dd className="min-w-0">{item.similar.length > 1 && editable
        ? <SelectPicker compact label={`Existing technology to use instead of ${item.name}`} value={existing} options={item.similar} onChange={setMatch} />
        : <span className="font-semibold break-words">{existing}</span>}</dd>
    </dl>
    {editable && <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
      <button type="button" disabled={!!busy} onClick={() => onUseExisting(existing)} aria-label={`Use existing: replace ${item.name} with ${existing}`} className={decisionButton} style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
        <Icon name="check" size={13} />{saving ? "Replacing…" : "Use existing"}
      </button>
      <button type="button" disabled={!!busy} onClick={onKeep} aria-label={`Keep submitted: keep ${item.name} as a separate technology`} className={`${decisionButton} border border-(--glass-edge) text-(--ink-2)`}>
        Keep submitted
      </button>
    </div>}
    {error && <p role="alert" className="mt-2 text-[13px]" style={{ color: "var(--proto)" }}>{error}</p>}
  </li>;
}
