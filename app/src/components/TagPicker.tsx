import { useId, useState } from "react";
import { checkTechnologyName } from "../lib/technologyName";
import { Chip } from "./Badges";
import { Icon } from "./Icon";
import { LoadingState } from "./LoadingState";
import { submissionInputClass } from "./SubmissionForm";

export function TagPicker({ label, options, selected, onChange, governed = false, allowNew = false, getLabel = value => value, onCreate }: {
  label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void;
  governed?: boolean; allowNew?: boolean; getLabel?: (value: string) => string;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [keepTyped, setKeepTyped] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const hintId = useId();
  const all = [...new Map([...options, ...selected].map(value => [value.trim().toLowerCase(), value])).values()];
  const filtered = all.filter(value => getLabel(value).toLowerCase().includes(query.trim().toLowerCase()));
  const check = allowNew && newTag.trim() ? checkTechnologyName(newTag, all.map(getLabel)) : undefined;
  const name = check && (keepTyped ? check.typed : check.suggested);
  const reset = () => { setNewTag(""); setKeepTyped(false); };
  const pick = (label: string) => {
    const value = all.find(entry => getLabel(entry) === label);
    if (value !== undefined && !selected.includes(value)) onChange([...selected, value]);
    reset();
  };
  const add = async () => {
    if (creating || !check || !name || check.error) return;
    setError("");
    if (check.existing) { pick(check.existing); return; }
    if (onCreate) {
      setCreating(true);
      try { await onCreate(name); reset(); }
      catch { setError("Technology was not confirmed. Reopen the draft before trying again."); }
      finally { setCreating(false); }
      return;
    }
    if (!selected.includes(name)) onChange([...selected, name]);
    reset();
  };
  return <fieldset className="min-w-0">
    <legend className="mb-2 text-[14px] font-semibold">{label}</legend>
    <p className="mb-2 text-[12px] text-(--ink-2)">{governed ? "Librarian-managed vocabulary" : "Tools, platforms and languages used to build the solution"}</p>
    <input type="search" className={submissionInputClass} aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} />
    <div className="mt-3 flex max-h-60 flex-wrap gap-2 overflow-y-auto">
      {filtered.map(value => <Chip key={value} active={selected.includes(value)} onClick={() => onChange(selected.includes(value) ? selected.filter(entry => entry !== value) : [...selected, value])}>{getLabel(value)}</Chip>)}
      {!filtered.length && <p className="text-[13px]">No matching tags.</p>}
    </div>
    {query && <p className="mt-2 text-[12px]">Selected: {selected.map(getLabel).join(", ") || "None"}</p>}
    {allowNew && <div className="mt-3 flex w-64 max-w-full items-center gap-2">
      <input disabled={creating} className="h-8 min-w-0 flex-1 rounded-full border border-(--glass-edge) bg-transparent px-3 py-1 text-[12.5px] font-medium text-(--ink) outline-none placeholder:text-(--ink-3) focus:border-(--accent)" value={newTag} onChange={event => { setNewTag(event.target.value); setKeepTyped(false); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} placeholder="Add a new technology" aria-label="Add a new technology" aria-describedby={check ? hintId : undefined} aria-invalid={check?.error ? true : undefined} maxLength={100} />
      <button type="button" title="Add new technology" aria-label="Add new technology" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-(--glass-edge) disabled:opacity-40" disabled={!check || !!check.error || creating} onClick={() => void add()}><Icon name="plus" /></button>
    </div>}
    {check && <div id={hintId} className="mt-2 space-y-2 text-[12.5px] text-(--ink-2)" aria-live="polite">
      {check.error ? <p className="text-(--proto)">{check.error}</p>
        : check.existing ? <p>Already listed as “{check.existing}”. Adding selects it.</p>
        : check.suggested !== check.typed && <p>{keepTyped ? "Will be added exactly as typed." : <>Will be added as “{check.suggested}”.</>}{" "}
          <button type="button" disabled={creating} className="cursor-pointer font-semibold text-(--accent) underline underline-offset-2 disabled:opacity-40" onClick={() => setKeepTyped(!keepTyped)}>{keepTyped ? `Use “${check.suggested}”` : `Keep “${check.typed}”`}</button></p>}
      {check.similar.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span>Similar existing:</span>
        {check.similar.map(label => <Chip key={label} title={`Select ${label}`} onClick={() => { if (!creating) pick(label); }}>{label}</Chip>)}</div>}
    </div>}
    {creating && <LoadingState className="mt-2" label="Saving technology..." />}
    {error && <p role="alert" className="mt-2 text-[13px]">{error}</p>}
  </fieldset>;
}