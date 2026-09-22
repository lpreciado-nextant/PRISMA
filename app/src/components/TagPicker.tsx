import { useState } from "react";
import { Chip } from "./Badges";
import { Icon } from "./Icon";
import { submissionInputClass } from "./SubmissionForm";

export function TagPicker({ label, options, selected, onChange, governed = false, allowNew = false, getLabel = value => value, onCreate }: {
  label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void;
  governed?: boolean; allowNew?: boolean; getLabel?: (value: string) => string;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const all = [...new Map([...options, ...selected].map(value => [value.trim().toLowerCase(), value])).values()];
  const filtered = all.filter(value => getLabel(value).toLowerCase().includes(query.trim().toLowerCase()));
  const add = async () => {
    if (creating || !newTag.trim()) return;
    setError("");
    const existing = all.find(entry => getLabel(entry).toLowerCase() === newTag.trim().toLowerCase());
    if (!existing && onCreate) {
      setCreating(true);
      try { await onCreate(newTag.trim()); setNewTag(""); }
      catch { setError("Technology was not confirmed. Reopen the draft before trying again."); }
      finally { setCreating(false); }
      return;
    }
    const value = existing ?? newTag.trim();
    if (!selected.includes(value)) onChange([...selected, value]);
    setNewTag("");
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
      <input disabled={creating} className="h-8 min-w-0 flex-1 rounded-full border border-(--glass-edge) bg-transparent px-3 py-1 text-[12.5px] font-medium text-(--ink) outline-none placeholder:text-(--ink-3) focus:border-(--accent)" value={newTag} onChange={event => setNewTag(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void add(); } }} placeholder="Add a new technology" aria-label="Add a new technology" maxLength={100} />
      <button type="button" title="Add new technology" aria-label="Add new technology" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-(--glass-edge) disabled:opacity-40" disabled={!newTag.trim() || creating} onClick={() => void add()}><Icon name="plus" /></button>
    </div>}
    {creating && <p role="status" className="mt-2 text-[13px]">Saving technology...</p>}
    {error && <p role="alert" className="mt-2 text-[13px]">{error}</p>}
  </fieldset>;
}