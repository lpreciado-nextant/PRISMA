import { useId, useState } from "react";
import { checkTechnologyName } from "../lib/technologyName";
import { Chip } from "./Badges";
import { Icon } from "./Icon";
import { LoadingState } from "./LoadingState";
import { OptionalMark, RequiredMark } from "./RequiredMark";

/** Longer lists get a search box; short ones show every option at once. */
const SEARCH_THRESHOLD = 12;

export function TagPicker({ label, options, selected, onChange, governed = false, allowNew = false, getLabel = value => value, onCreate, required = false, optional = false, hint }: {
  label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void;
  governed?: boolean; allowNew?: boolean; getLabel?: (value: string) => string;
  onCreate?: (name: string) => Promise<void>;
  /** Marks the picker like the form's other fields. */
  required?: boolean; optional?: boolean;
  /** What the field is for, in one short line. */
  hint?: string;
}) {
  // A trailing "(…)" in the label, such as "(choose one)", reads as a note: small and regular weight, like "(optional)".
  const [, heading = label, note] = /^(.*?)\s*(\([^)]*\))$/.exec(label) ?? [];
  const [query, setQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [keepTyped, setKeepTyped] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const hintId = useId();
  const all = [...new Map([...options, ...selected].map(value => [value.trim().toLowerCase(), value])).values()];
  const searchable = all.length > SEARCH_THRESHOLD;
  // Chosen tags sit in their own row; the options below only list what is still available.
  const available = all.filter(value => !selected.includes(value) && getLabel(value).toLowerCase().includes(query.trim().toLowerCase()));
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
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter(entry => entry !== value) : [...selected, value]);
  return <fieldset className="min-w-0 border-t border-(--glass-edge) pt-5">
    <legend className="float-left w-full text-[14px] font-semibold">{heading}{required ? <RequiredMark /> : optional && <OptionalMark />}{note && <span className="ml-1 text-[12px] font-normal text-(--ink-3)">{note}</span>}</legend>
    <p className="clear-left pt-0.5 text-[12px] text-(--ink-3)">{hint ?? (governed ? "Librarian-managed vocabulary" : "Tools, platforms and languages used to build the solution")}</p>
    {selected.length > 0 && <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Selected ${heading.toLowerCase()}`}>
      {selected.map(value => <Chip key={value} active onClick={() => toggle(value)} title={`Remove ${getLabel(value)}`}><span className="sr-only">Remove </span>{getLabel(value)}<Icon name="close" size={12} /></Chip>)}
    </div>}
    {searchable && <div className="relative mt-3 w-full sm:w-72">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--ink-3)"><Icon name="search" size={14} /></span>
      <input type="search" className="h-9 w-full rounded-lg border border-(--glass-edge) bg-transparent pr-3 pl-8 text-[13.5px] text-(--ink) outline-none placeholder:text-(--ink-3) focus:border-(--accent)" aria-label={`Search ${heading.toLowerCase()}`} placeholder={`Search ${heading.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} />
    </div>}
    <div className="mt-3 flex max-h-60 flex-wrap items-center gap-2 overflow-y-auto" role="group" aria-label={`Available ${heading.toLowerCase()}`}>
      {available.map(value => <Chip key={value} onClick={() => toggle(value)}><span className="sr-only">Add </span>{getLabel(value)}</Chip>)}
      {!available.length && <p className="text-[12.5px] text-(--ink-3)">{query ? "No matching tags." : "Everything in this list is selected."}</p>}
    </div>
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