export function MediaGuidance({ capabilities }: { capabilities: string[] }) {
  const isAgent = capabilities.some((value) => /ai|agent/i.test(value));
  const isData = capabilities.some((value) => /data|analytics/i.test(value));
  const isWorkflow = capabilities.some((value) => /workflow|approval/i.test(value));
  return <div className="space-y-1">
    {isAgent && <p>AI & agents: show a user request, the agent's response and the outcome. A simple interaction diagram or explanatory slide works too.</p>}
    {isData && <p>Data & analytics: show a dashboard and the decision it enables. A clear data-source or integration diagram can explain reusable connections.</p>}
    {isWorkflow && <p>Workflows: show the important before-and-after steps and the result for the user.</p>}
    {!isAgent && !isData && !isWorkflow && <p>Show the experience and its business outcome. Use screenshots or explanatory diagrams that a client can understand without technical context.</p>}
  </div>;
}
import { useId, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Chip } from "./Badges";
import { SelectPicker } from "./SelectPicker";
import type { AssetType } from "../types";

export const SUBMISSION_STEPS = ["Before you start", "What is it?", "What & why", "Tag it", "Media", "Review & submit"] as const;

export const submissionInputClass = "w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[15px] outline-none transition-colors duration-200 border-(--glass-edge) text-(--ink) placeholder:text-(--ink-3) focus:border-(--accent)";

export function SubmissionSteps({ step, onStep, disabled = false }: { step: number; onStep: (step: number) => void; disabled?: boolean }) {
  return <ol className="mt-6 flex flex-wrap gap-2" aria-label="Submission steps">
    {SUBMISSION_STEPS.map((label, index) => {
      const state = index === step ? "current" : index < step ? "done" : "todo";
      return <li key={label}><button type="button" disabled={disabled} onClick={() => index < step && onStep(index)} aria-current={state === "current" ? "step" : undefined}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40 ${index < step ? "cursor-pointer" : "cursor-default"}`}
        style={{ fontFamily: "var(--font-display)", borderColor: state === "current" ? "var(--accent)" : "var(--glass-edge)", background: state === "current" ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent", color: state === "todo" ? "var(--ink-3)" : "var(--ink)" }}>
        <span className="grid h-4.5 w-4.5 place-items-center rounded-full font-mono text-[9.5px]" style={{ background: state === "done" ? "var(--live)" : "color-mix(in srgb, var(--ink) 12%, transparent)", color: state === "done" ? "var(--ground)" : "var(--ink-2)" }}>{state === "done" ? <Icon name="check" size={9} /> : index + 1}</span>{label}
      </button></li>;
    })}
  </ol>;
}

export function StepShell({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  const introductions: Record<string, string> = {
    "Before you start": "Your work will help CSMs present solutions to clients. Prepare a client-safe story before adding content.",
    "What is it?": "The card's first impression — name it like a product, not a project code.",
    "What does it do, and why does it matter?": "The step CSMs depend on most. Write for the person who wasn't there.",
    "Tag it": "Tags are how a CSM finds this in eight months. Capabilities and industries are governed; technologies are open.",
    Media: "At least one detail image is required. Add an optional thumbnail, video, one-pager or slide deck, or self-contained HTML demo.",
    "Review & submit": "Exactly how the card will look on the shelf once the librarian approves it.",
  };
  const introduction = lede ?? introductions[title];
  return <section><h2 className="text-[20px] font-semibold">{title}</h2>{introduction && <p className="mt-1 text-[14px] text-(--ink-3)">{introduction}</p>}<div className="mt-6 flex flex-col gap-5">{children}</div></section>;
}

export function SubmissionFooter({ step, busy = false, locked = false, canSave, canContinue, canSubmit, onBack, onSave, onContinue, onSubmit }: {
  step: number; busy?: boolean; locked?: boolean; canSave: boolean; canContinue: boolean; canSubmit: boolean;
  onBack: () => void; onSave?: () => void; onContinue: () => void; onSubmit: () => void;
}) {
  const command = "cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";
  return <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-(--glass-edge) pt-5">
    {step > 0 && <button type="button" disabled={busy || locked} onClick={onBack} className={`${command} border border-(--glass-edge) text-(--ink-2)`}>Back</button>}
    {onSave && <button type="button" disabled={busy || locked || !canSave} onClick={onSave} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"><Icon name="file" />{busy ? "Saving..." : "Save draft & close"}</button>}
    <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] text-(--ink-3) uppercase">Step {step + 1} of {SUBMISSION_STEPS.length}</span>
    {step < SUBMISSION_STEPS.length - 1 ? <button type="button" disabled={busy || locked || !canContinue} onClick={onContinue} className={`${command} bg-(--accent) text-(--on-accent)`}>Continue</button>
      : <button type="button" disabled={busy || locked || !canSubmit} onClick={onSubmit} className={`${command} bg-(--live) text-(--ground)`}>{busy ? "Saving..." : "Submit for review"}</button>}
  </div>;
}

export function SubmissionSuccess({ name, children, onSubmissions, onAnother }: { name: string; children: ReactNode; onSubmissions: () => void; onAnother: () => void }) {
  return <div className="mx-auto w-full max-w-[720px] px-4 pt-16 pb-24 sm:px-6">
    <div className="glass glass-lite glass-sheen animate-scale-in rounded-[26px] p-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-(--live) text-(--ground)"><Icon name="check" size={26} /></span>
      <p className="eyebrow mt-6">Submitted</p><h1 className="mt-2 text-[26px] font-bold">Now it's pending review</h1>
      <p className="mx-auto mt-3 max-w-[46ch] text-[15.5px] text-(--ink-2)"><b className="text-(--ink)">{name || "Your solution"}</b> {children}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onSubmissions} className="cursor-pointer rounded-xl bg-(--accent) px-4 py-2.5 text-[14px] font-semibold text-(--on-accent)">My submissions</button>
        <button type="button" onClick={onAnother} className="cursor-pointer rounded-xl border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold text-(--ink-2)">Submit another</button>
      </div>
    </div>
  </div>;
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block"><span className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{label}{required && <span style={{ color: "var(--proto)" }}> *</span>}</span>{hint && <span className="mt-1 block text-[12px] text-(--ink-3)">{hint}</span>}</span>{children}</label>;
}

export function SubmissionSafety({ accepted, onChange }: { accepted: boolean; onChange: (accepted: boolean) => void }) {
  return <StepShell title="Before you start">
    <ul className="list-disc space-y-4 pl-5 text-[15px]">
      <li>Use invented or anonymized data in descriptions, screenshots, videos, documents and HTML. Remove confidential figures, names and identifying details.</li>
      <li>Only attach material you are authorized to share. Acknowledging this does not replace librarian review.</li>
      <li>The dedicated client field is internal only. Write a separate anonymous description for presentations, or leave both fields empty for work without a client.</li>
    </ul>
    <label className="flex cursor-pointer items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={accepted} onChange={event => onChange(event.target.checked)} /><span>I understand and will submit only authorized, client-safe content, with client identity confined to the internal client field.</span></label>
  </StepShell>;
}

type IdentityText = { name: string; summary: string; clientContext: string; redacted: string };
export function ImageUploadZone({ line, sub, multiple, disabled, onFiles, children }: { line: string; sub: string; multiple?: boolean; disabled?: boolean; onFiles: (files: File[]) => void; children?: ReactNode }) {
  return <label className={`grid place-items-center rounded-[16px] border border-dashed border-(--glass-edge-hi) px-6 py-8 text-center text-(--ink-3) transition-colors duration-200 focus-within:outline-2 focus-within:outline-(--accent) ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-(--accent)"}`}>
    <input type="file" aria-label={line} accept="image/png,image/jpeg,image/webp" disabled={disabled} multiple={multiple} className="sr-only" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files); }} />
    <Icon name="grid" size={20} /><p className="mt-2 text-[14px]">{line}</p><p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] uppercase">{sub}</p><p className="mt-1 text-[12px]">5 MB per image</p>{children}
  </label>;
}

export function SubmissionMedia({ capabilities, thumbnail, onRemoveThumbnail, thumbnailUpload, images, imageUpload, onCaption, onRemoveImage, format, onFormat, onAttachment, attachments, onRemoveAttachment, onPreviewThumbnail, onPreviewImage, onPreviewAttachment, disabled = false, attachmentDisabled = false, local = false, children }: {
  capabilities: string[]; thumbnail?: ReactNode; onRemoveThumbnail: () => void; thumbnailUpload: ReactNode;
  images: { id: string; preview: ReactNode; caption: string }[]; imageUpload: ReactNode; onCaption: (id: string, caption: string) => void; onRemoveImage: (id: string) => void;
  format: AssetType; onFormat: (format: AssetType) => void; onAttachment: (file: File) => void;
  attachments: { id: string; name: string; status?: ReactNode }[]; onRemoveAttachment: (id: string) => void;
  onPreviewThumbnail?: () => void; onPreviewImage?: (id: string) => void; onPreviewAttachment?: (id: string) => void;
  disabled?: boolean; attachmentDisabled?: boolean; local?: boolean; children?: ReactNode;
}) {
  return <StepShell title="Media">
    <div className="border-l-2 border-(--accent) pl-4 text-[14px] text-(--ink-2)"><MediaGuidance capabilities={capabilities} /><p className="mt-2">Remove confidential data and client identifiers from every attachment before uploading.</p></div>
    <div><p className="mb-1.5 text-[13.5px] font-semibold">Card thumbnail</p><p className="mb-2 text-[12px] text-(--ink-3)">The card grid's hero image — without one, the card gets a generated poster</p>
      {thumbnail ? <div className="flex flex-wrap items-center gap-4"><div className="h-24 w-40 shrink-0 overflow-hidden rounded-[12px] border border-(--glass-edge)">{onPreviewThumbnail ? <button type="button" className="h-full w-full cursor-pointer" disabled={disabled} onClick={onPreviewThumbnail} aria-label="Preview thumbnail">{thumbnail}</button> : thumbnail}</div><button type="button" disabled={disabled} onClick={onRemoveThumbnail} className="cursor-pointer rounded-lg border border-(--glass-edge) px-3 py-1.5 text-[12.5px] font-semibold text-(--ink-2) disabled:opacity-40">Remove</button></div> : thumbnailUpload}
    </div>
    <div><p className="mb-1.5 text-[13.5px] font-semibold">Detail screenshots · {images.length}/6 <span className="text-(--proto)">*</span></p><p className="mb-2 text-[12px] text-(--ink-3)">At least one image showing the experience or outcome. A thumbnail alone does not meet this requirement.</p>
      <div className="flex flex-col gap-3">{!!images.length && <div className="grid gap-3 sm:grid-cols-2">{images.map(image => <div key={image.id} className="min-w-0 overflow-hidden rounded-[14px] border border-(--glass-edge)">
        <div className="aspect-[16/10] w-full overflow-hidden">{onPreviewImage ? <button type="button" className="h-full w-full cursor-pointer" disabled={disabled} onClick={() => onPreviewImage(image.id)} aria-label={`Preview screenshot ${images.indexOf(image) + 1}`}>{image.preview}</button> : image.preview}</div><div className="flex items-center gap-2 p-2"><input disabled={disabled} className={`${submissionInputClass} h-8 min-w-0 flex-1 rounded-lg px-2.5 py-0 text-[12.5px]`} value={image.caption} onChange={event => onCaption(image.id, event.target.value)} placeholder="e.g. Unmatched invoices awaiting review" maxLength={200} aria-label="Screenshot caption" aria-describedby={`caption-hint-${image.id}`} /><button type="button" disabled={disabled} onClick={() => onRemoveImage(image.id)} aria-label="Remove this screenshot" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ink-3) disabled:opacity-40"><Icon name="close" size={14} /></button></div>
        <p id={`caption-hint-${image.id}`} className="px-3 pb-3 text-[12px] text-(--ink-3)">Describe the screen or result shown.</p>
      </div>)}</div>}{images.length < 6 && imageUpload}</div>
    </div>
    <Field label="Additional media format"><SelectPicker label="Additional media format" value={format} options={["Self-contained HTML file", "Video walkthrough only", "Client-ready one-pager / slide"]} onChange={onFormat} /></Field>
    <Field label="Attach additional media" hint={`Optional. MP4/WebM videos up to 500 MB each; HTML and PDF/PPT/PPTX documents up to 25 MB each. Up to 6 additional files.${local ? " Local preview only." : ""}`}>
      <input type="file" className="max-w-full" disabled={disabled || attachmentDisabled || attachments.length >= 6} accept={format === "Self-contained HTML file" ? ".html,.htm" : format === "Video walkthrough only" ? ".mp4,.webm" : ".pdf,.ppt,.pptx"} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onAttachment(file); }} />
    </Field>
    <ul className="space-y-4">{attachments.map(item => <li key={item.id} className="flex min-w-0 items-center gap-3 border-b border-(--glass-edge) pb-3"><Icon name="file" className="shrink-0" /><div className="min-w-0 flex-1"><span className="break-words">{item.name}</span>{item.status}</div>{onPreviewAttachment && <button type="button" disabled={disabled || !!item.status} title="Preview attachment" aria-label={`Preview ${item.name}`} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center disabled:opacity-40" onClick={() => onPreviewAttachment(item.id)}><Icon name="play" /></button>}<button type="button" disabled={disabled} title="Remove attachment" aria-label={`Remove ${item.name}`} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center disabled:opacity-40" onClick={() => onRemoveAttachment(item.id)}><Icon name="close" /></button></li>)}</ul>
    {children}
  </StepShell>;
}

export function IdentityFields<Area extends string, Status extends string>({ value, onText, area, areas, onArea, status, statuses, onStatus }: {
  value: IdentityText; onText: (key: keyof IdentityText, value: string) => void;
  area: Area; areas: { value: Area; label: string }[]; onArea: (value: Area) => void;
  status: Status; statuses: { value: Status; label: string }[]; onStatus: (value: Status) => void;
}) {
  return <>
    <Field label="Solution name" required hint="Give the solution a short, recognizable product name."><input className={submissionInputClass} value={value.name} onChange={event => onText("name", event.target.value)} placeholder="e.g. Ledger Reconciler" maxLength={100} /></Field>
    <Field label="One-line summary" required hint={`Describe who it helps and what it achieves in one sentence. ${value.summary.length}/200 characters.`}><input className={submissionInputClass} value={value.summary} onChange={event => onText("summary", event.target.value)} placeholder="e.g. Helps finance teams match invoices to payments." maxLength={200} /></Field>
    <Field label="Specialization area"><div className="flex flex-wrap gap-2">{areas.map(option => <Chip key={option.value} active={area === option.value} onClick={() => onArea(option.value)}>{option.label}</Chip>)}</div></Field>
    <Field label="Status"><div className="flex flex-wrap gap-2">{statuses.map(option => <Chip key={option.value} active={status === option.value} onClick={() => onStatus(option.value)}>{option.label}</Chip>)}</div></Field>
    <Field label="Who was this developed for?" hint="Optional. Client and engagement name for internal discovery only; never included in present mode."><input className={submissionInputClass} value={value.clientContext} onChange={event => onText("clientContext", event.target.value)} placeholder="e.g. Fabrikam Logistics, FY26 pilot" maxLength={200} /></Field>
    <Field label="How should we describe this client?" required={!!value.clientContext.trim()} hint="Client-visible context without names or identifying details. Leave empty if this work has no client."><input className={submissionInputClass} value={value.redacted} onChange={event => onText("redacted", event.target.value)} placeholder="e.g. a national logistics provider" maxLength={200} /></Field>
  </>;
}

export function StoryFields({ whatItDoes, businessValue, onChange, children }: { whatItDoes: string; businessValue: string; onChange: (key: "whatItDoes" | "businessValue", value: string) => void; children?: ReactNode }) {
  return <StepShell title="What does it do, and why does it matter?">
    <Field label="What it does" hint="Describe the main actions a user takes and the results they see."><textarea className={`${submissionInputClass} min-h-28 resize-y`} value={whatItDoes} onChange={event => onChange("whatItDoes", event.target.value)} placeholder="e.g. Upload invoices, review suggested matches, and export unmatched items." maxLength={4000} /></Field>
    <Field label="Business value" hint="Explain the business problem and the benefit of solving it; include measured results only when known."><textarea className={`${submissionInputClass} min-h-28 resize-y`} value={businessValue} onChange={event => onChange("businessValue", event.target.value)} placeholder="e.g. Reduces manual invoice matching so finance can focus on exceptions." maxLength={4000} /></Field>
    {children}
  </StepShell>;
}

export function SubmissionReview({ card, attachments, contributors, hours, images, safety, client, context, nextState, children }: {
  card: ReactNode; attachments: number; contributors: string; hours: number | null; images: string; safety: string; client: string; context: string; nextState: string; children?: ReactNode;
}) {
  const rows = [["Attachments", `${attachments} additional files`], ["Built by", contributors], ["Total effort", hours === null ? "Incomplete" : `${hours.toLocaleString()} hours`], ["Images", images], ["Safety", safety], ["Client (internal)", client || "No client"], ["Public context", context || "None"], ["Next state", nextState]];
  return <StepShell title="Review & submit"><div className="pointer-events-none mx-auto w-full max-w-[400px]" inert>{card}</div>
    <dl className="grid gap-2 text-[14px] sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="flex min-w-0 gap-3 rounded-xl border border-(--glass-edge) px-3.5 py-2.5"><dt className="w-24 shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-(--ink-3) uppercase">{label}</dt><dd className="min-w-0 flex-1 break-words text-(--ink)">{value}</dd></div>)}</dl>{children}
  </StepShell>;
}

export function ContributorEditor({ direct, children, total, onAdd, addDisabled = false }: { direct: boolean; children: ReactNode; total: number | null; onAdd: () => void; addDisabled?: boolean }) {
  return <section aria-labelledby="contributors-heading" className="mt-2 min-w-0 border-t border-(--glass-edge) pt-5">
    <h3 id="contributors-heading" className="text-[17px] font-semibold">Built by &amp; effort</h3>
    <p className="mt-1 text-[13px] text-(--ink-2)">{direct ? "Enter each person's hours, including preparation and discovery." : "Estimated capacity: inclusive US business days, excluding federal holidays, multiplied by 8 hours and allocation."}</p>
    {children}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <button type="button" disabled={addDisabled} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[13px] font-semibold disabled:opacity-40" onClick={onAdd}><Icon name="plus" size={14} />Add contributor</button>
      <p aria-live="polite" className="text-[14px] font-semibold">Total effort: {total === null ? "Incomplete" : `${total.toLocaleString()} hours`}</p>
    </div>
  </section>;
}

type EffortFields = { directHours: number | null; startDate: string; endDate: string; allocation: number | null };
export function ContributorRow({ index, person, direct, value, onChange, onRemove, minDate, maxDate, result }: {
  index: number; person: ReactNode; direct: boolean; value: EffortFields; onChange: (fields: Partial<EffortFields>) => void;
  onRemove?: () => void; minDate?: string; maxDate?: string; result: { error: string; hours: number; businessDays: number };
}) {
  const id = useId();
  return <fieldset className="mt-5 min-w-0 border-b border-(--glass-edge) pb-5" aria-describedby={id}>
    <legend className="mb-3 text-[13px] font-semibold">Contributor {index + 1}</legend>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2">{person}</div>
      {direct ? <Field label="Hours contributed" required><input type="number" className={submissionInputClass} min={0} step={0.01} value={value.directHours ?? ""} onChange={event => onChange({ directHours: event.target.value === "" ? null : Number(event.target.value) })} /></Field> : <>
        <Field label="Start date" required><input type="date" className={`${submissionInputClass} min-w-0`} min={minDate} max={maxDate} value={value.startDate} onChange={event => onChange({ startDate: event.target.value })} /></Field>
        <Field label="End date" required><input type="date" className={`${submissionInputClass} min-w-0`} min={value.startDate || minDate} max={maxDate} value={value.endDate} onChange={event => onChange({ endDate: event.target.value })} /></Field>
        <Field label="Allocation (%)" required><input type="number" className={submissionInputClass} min={0} max={100} step={0.01} value={value.allocation ?? ""} onChange={event => onChange({ allocation: event.target.value === "" ? null : Number(event.target.value) })} /></Field>
      </>}
      <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2">
        <p id={id} aria-live="polite" className={`text-[13px] ${result.error ? "text-(--proto)" : "text-(--ink-2)"}`}>{result.error || `${direct ? "" : `${result.businessDays} business days · `}${result.hours.toLocaleString()} hours`}</p>
        {onRemove && <button type="button" onClick={onRemove} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-(--glass-edge)" title="Remove contributor" aria-label={`Remove contributor ${index + 1}`}><Icon name="close" size={16} /></button>}
      </div>
    </div>
  </fieldset>;
}

type Person = { id: string; name: string; email?: string };
export function PersonPicker<PersonType extends Person>({ value, options, onChange, label = "Person", hint = "Find a contributor by name or email and select their match." }: { value: PersonType; options: PersonType[]; onChange: (person: PersonType) => void; label?: string; hint?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const terms = (query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = options.filter(person => terms.every(term => `${person.name} ${person.email ?? ""}`.toLowerCase().includes(term)));
  const activePerson = matches[activeIndex];
  const close = () => { setOpen(false); setQuery(null); setActiveIndex(-1); };
  const select = (person: PersonType) => { onChange(person); close(); };
  return <div className="relative min-w-0">
    <Field label={label} required hint={hint || undefined}><input role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && activePerson ? `${id}-option-${activePerson.id}` : undefined} aria-required="true" autoComplete="off" className={submissionInputClass} value={query ?? value.name} placeholder="e.g. Alex" onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={close}
      onChange={event => { setQuery(event.target.value); setActiveIndex(-1); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActiveIndex(current => !matches.length ? -1 : !open || current < 0 ? event.key === "ArrowDown" ? 0 : matches.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length);
        } else if (event.key === "Enter" && open) { event.preventDefault(); if (activePerson) select(activePerson); }
        else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); close(); }
      }} /></Field>
    {open && <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-(--glass-edge) bg-(--ground) p-1 shadow-lg"><ul id={`${id}-list`} role="listbox" aria-label="People" className="max-h-60 overflow-y-auto">{matches.map((person, index) => <li key={person.id} id={`${id}-option-${person.id}`} role="option" aria-selected={person.id === value.id} ref={element => { if (index === activeIndex) element?.scrollIntoView({ block: "nearest" }); }} className="cursor-pointer rounded-md px-3 py-2 text-[14px] break-words hover:bg-(--glass-edge)" style={{ background: index === activeIndex ? "var(--glass-edge)" : undefined }} onPointerDown={event => event.preventDefault()} onClick={() => select(person)}><span className="block font-semibold">{person.name}</span>{person.email && <span className="block text-[12px] text-(--ink-3)">{person.email}</span>}</li>)}</ul>{!matches.length && <p role="status" className="px-3 py-2 text-[13px] text-(--ink-3)">No matching people</p>}</div>}
  </div>;
}