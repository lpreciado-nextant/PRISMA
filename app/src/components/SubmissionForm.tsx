import { useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { SectionCardsContext } from "./sectionCards";
import { OptionalMark, RequiredLegend, RequiredMark } from "./RequiredMark";
import { Notice } from "./Notice";
import { LoadingState, ProgressRail } from "./LoadingState";
import { Chip } from "./Badges";
import { SelectPicker } from "./SelectPicker";
import type { AssetPurpose } from "../lib/assetPurpose";
import { LINK_ASSET_TYPES, assetTypeLabel, validateLinkedAsset, type LinkedAssetInput, type LinkAssetType } from "../lib/linkedAssets";
import { useVideoPreparation } from "../lib/useVideoPreparation";
import { LocalVideoPreview } from "./ViewerFrame";

export const SUBMISSION_STEPS = ["Before you start", "Define the solution", "Solution context", "Tag it", "Media", "Review & submit"] as const;

const SECTION_META: Record<string, { icon: IconName; visibility?: Visibility }> = {
  "Before you start": { icon: "shield" },
  "Solution details": { icon: "file", visibility: "client" },
  Status: { icon: "clock", visibility: "client" },
  Client: { icon: "briefcase" },
  "Built by & effort": { icon: "users", visibility: "internal" },
  "What does it do, and why does it matter?": { icon: "sparkle", visibility: "client" },
  "Tag it": { icon: "tag", visibility: "client" },
  Media: { icon: "image", visibility: "client" },
  "Review & submit": { icon: "check" },
};

const STEP_INTRODUCTIONS: Record<string, string> = {
  "Before you start": "Help keep PRISMA content safe and ready to present to clients.",
  "Define the solution": "What it is and why it matters: the card and the story CSMs tell.",
  "Solution context": "Where it stands, who built it, and whether a client is involved.",
  Status: "How mature the solution is today. It also decides how effort is entered below.",
  "Solution details": "The card's first impression. Name it like a product, not a project code, and say in one line what it does.",
  Client: "Who this was built for, and how to talk about them in front of other clients.",
  "Built by & effort": "Add the contributors who worked on this solution and capture the effort required to deliver it. This information is used for internal tracking only.",
  "What does it do, and why does it matter?": "CSMs rely on this step most. Write it for someone who wasn't on the project.",
  "Tag it": "Tags help CSMs find this later. Capabilities and industries come from a fixed list; technologies are free text.",
  Media: "Add at least one screenshot. A thumbnail, video, slides or HTML demo are optional.",
  "Review & submit": "This is how the card will look in the library once it's approved.",
};

export const submissionInputClass = "w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[15px] outline-none transition-colors duration-200 border-(--glass-edge) text-(--ink) placeholder:text-(--ink-3) focus:border-(--accent)";

export function SubmissionSteps({ step, onStep, disabled = false, steps = SUBMISSION_STEPS }: { step: number; onStep: (step: number) => void; disabled?: boolean; steps?: readonly string[] }) {
  return <ol className="mt-6 flex flex-wrap gap-2" aria-label="Submission steps">
    {steps.map((label, index) => {
      const state = index === step ? "current" : index < step ? "done" : "todo";
      return <li key={label}><button type="button" disabled={disabled} onClick={() => index < step && onStep(index)} aria-current={state === "current" ? "step" : undefined}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-40 ${index < step ? "cursor-pointer" : "cursor-default"}`}
        style={{ fontFamily: "var(--font-display)", borderColor: state === "current" ? "var(--accent)" : "var(--glass-edge)", background: state === "current" ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent", color: state === "todo" ? "var(--ink-3)" : "var(--ink)" }}>
        <span className="grid h-4.5 w-4.5 place-items-center rounded-full font-mono text-[9.5px]" style={{ background: state === "done" ? "var(--live)" : "color-mix(in srgb, var(--ink) 12%, transparent)", color: state === "done" ? "var(--ground)" : "var(--ink-2)" }}>{state === "done" ? <Icon name="check" size={9} /> : index + 1}</span>{label}
      </button></li>;
    })}
  </ol>;
}

/** Steps with fields to fill explain the required marker; the safety gate and the final review have none. */
const NO_FIELDS = new Set(["Before you start", "Review & submit"]);

/** `notices` sit above the step title: guidance to read before the step itself. */
export function StepShell({ title, lede, notices, children }: { title: string; lede?: string; notices?: ReactNode; children: ReactNode }) {
  const cards = useContext(SectionCardsContext);
  const introduction = lede ?? STEP_INTRODUCTIONS[title];
  const meta = SECTION_META[title];
  const content = <>{!NO_FIELDS.has(title) && <RequiredLegend />}{children}</>;
  const top = notices && <div className="mb-6 grid gap-1.5">{notices}</div>;
  if (cards && meta) return <>{top}<SectionCard icon={meta.icon} title={title} description={introduction} visibility={meta.visibility}>{content}</SectionCard></>;
  return <section>{top}<h2 className="text-[20px] font-semibold">{title}</h2>{introduction && <p className="mt-1 text-[14px] text-(--ink-3)">{introduction}</p>}<div className="mt-6 flex flex-col gap-5">{content}</div></section>;
}

export function SubmissionFooter({ step, stepCount = SUBMISSION_STEPS.length, nextLabel = "Continue", busy = false, locked = false, canSave, canContinue, canSubmit, onBack, onSave, onContinue, onSubmit }: {
  step: number; stepCount?: number; nextLabel?: string; busy?: boolean; locked?: boolean; canSave: boolean; canContinue: boolean; canSubmit: boolean;
  onBack: () => void; onSave?: () => void; onContinue: () => void; onSubmit: () => void;
}) {
  const command = "cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40";
  return <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-(--glass-edge) pt-5">
    {step > 0 && <button type="button" disabled={busy || locked} onClick={onBack} className={`${command} border border-(--glass-edge) text-(--ink-2)`}>Back</button>}
    {onSave && <button type="button" disabled={busy || locked || !canSave} onClick={onSave} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"><Icon name="file" />{busy ? "Saving..." : "Save draft & close"}</button>}
    <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] text-(--ink-3) uppercase">Step {step + 1} of {stepCount}</span>
    {step < stepCount - 1 ? <button type="button" disabled={busy || locked || !canContinue} onClick={onContinue} className={`${command} bg-(--accent) text-(--on-accent)`}>{nextLabel}</button>
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

export function Field({ label, required, optional, hint, badge, children }: { label: string; required?: boolean; optional?: boolean; hint?: string; badge?: ReactNode; children: ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block"><span className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{label}{required ? <RequiredMark /> : optional && <OptionalMark />}</span>{badge}</span>{hint && <span className="mt-1 block text-[12px] text-(--ink-3)">{hint}</span>}</span>{children}</label>;
}

export function SubmissionSafety({ accepted, onChange }: { accepted: boolean; onChange: (accepted: boolean) => void }) {
  return <StepShell title="Before you start">
    <ul className="list-disc space-y-4 pl-5 text-[15px]">
      <li><b>Keep it client-safe.</b> Use fake or anonymized data in text, screenshots, videos, files, and HTML.</li>
      <li><b>Only share approved content.</b> Upload materials you're authorized to share. A librarian will review your submission before publishing.</li>
      <li><b>Protect client information.</b> If a client is associated with the solution, their real name is kept internal. Use an anonymous description for client-facing content.</li>
    </ul>
    <label className="flex cursor-pointer items-start gap-3 text-[15px]"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={accepted} onChange={event => onChange(event.target.checked)} /><span>I confirm that my submission is safe to share and does not contain confidential or unauthorized information.<RequiredMark /></span></label>
  </StepShell>;
}

type IdentityText = { name: string; summary: string; clientContext: string; redacted: string };
export function ImageUploadZone({ line, sub, multiple, disabled, onFiles, children }: { line: string; sub: string; multiple?: boolean; disabled?: boolean; onFiles: (files: File[]) => void; children?: ReactNode }) {
  return <label className={`grid place-items-center rounded-[16px] border border-dashed border-(--glass-edge-hi) px-6 py-8 text-center text-(--ink-3) transition-colors duration-200 focus-within:outline-2 focus-within:outline-(--accent) ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:border-(--accent)"}`}>
    <input type="file" aria-label={line} accept="image/png,image/jpeg,image/webp" disabled={disabled} multiple={multiple} className="sr-only" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files); }} />
    <Icon name="grid" size={20} /><p className="mt-2 text-[14px]">{line}</p><p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] uppercase">{sub}</p><p className="mt-1 text-[12px]">5 MB per image</p>{children}
  </label>;
}

/** What to show, by capability: AI and data get their own tip; anything else gets the general one. */
function MediaTips({ capabilities }: { capabilities: string[] }) {
  const isAgent = capabilities.some(value => /ai|agent/i.test(value));
  const isData = capabilities.some(value => /data|analytics/i.test(value));
  return <>
    {isAgent && <Notice icon="sparkle" tone="var(--sa-ibo)" title="AI & agents">Show a user request, the agent's response and the outcome.</Notice>}
    {isData && <Notice icon="database" tone="var(--prism-4)" title="Data & analytics">Show a dashboard and the decision it enables.</Notice>}
    {!isAgent && !isData && <Notice icon="info" tone="var(--accent)" title="What to show">The experience and its business outcome, in visuals a client understands without technical context.</Notice>}
  </>;
}

export function SubmissionMedia({ capabilities, thumbnail, onRemoveThumbnail, thumbnailUpload, images, imageUpload, onCaption, onRemoveImage, onAttachment, attachments, onRemoveAttachment, onPreviewThumbnail, onPreviewImage, onPreviewAttachment, onLinkedAsset, onLinkedPending, onReorderImages, onReorderAttachments, onPreparationBusy, disabled = false, attachmentDisabled = false, local = false, children }: {
  capabilities: string[]; thumbnail?: ReactNode; onRemoveThumbnail: () => void; thumbnailUpload: ReactNode;
  images: { id: string; preview: ReactNode; caption: string }[]; imageUpload: ReactNode; onCaption: (id: string, caption: string) => void; onRemoveImage: (id: string) => void;
  /** A file added to one of the three sections; the section sets its purpose (ADR-0011). Videos arrive after compression. */
  onAttachment: (file: File, purpose: AssetPurpose) => void;
  attachments: { id: string; name: string; purpose: AssetPurpose; status?: ReactNode; linkedAsset?: LinkedAssetInput }[]; onRemoveAttachment: (id: string) => void;
  onLinkedAsset?: (input: LinkedAssetInput, id: string | undefined, purpose: AssetPurpose) => Promise<void>; onLinkedPending?: (pending: boolean) => void;
  onPreviewThumbnail?: () => void; onPreviewImage?: (id: string) => void; onPreviewAttachment?: (id: string) => void;
  onReorderImages?: (ids: string[]) => void; onReorderAttachments?: (ids: string[]) => void;
  onPreparationBusy?: (busy: boolean) => void;
  disabled?: boolean; attachmentDisabled?: boolean; local?: boolean; children?: ReactNode;
}) {
  // One link editor at a time: a new link in a section, or an existing link being edited.
  const [linkEditor, setLinkEditor] = useState<{ purpose: AssetPurpose; type: LinkAssetType; id?: string } | null>(null);
  const [linkedDirty, setLinkedDirty] = useState(false);
  // The section a video was added to, carried through compression.
  const videoPurpose = useRef<AssetPurpose>("Demo video");
  const preparation = useVideoPreparation(file => onAttachment(file, videoPurpose.current), onPreparationBusy);
  useEffect(() => { onLinkedPending?.(linkedDirty); return () => onLinkedPending?.(false); }, [linkedDirty, onLinkedPending]);
  const full = attachments.length >= 6;
  const addFile = (file: File, purpose: AssetPurpose) => {
    if (/\.(mp4|webm)$/i.test(file.name)) { videoPurpose.current = purpose; void preparation.select(file); }
    else onAttachment(file, purpose);
  };
  // Sections keep their own order; the saved order lists them section by section.
  const reorderSection = (purpose: AssetPurpose, ids: string[]) => onReorderAttachments?.(ATTACHMENT_SECTIONS.flatMap(section => section.purpose === purpose ? ids : attachments.filter(item => item.purpose === section.purpose).map(item => item.id)));
  return <StepShell title="Media" notices={<>
    <MediaTips capabilities={capabilities} />
    <Notice icon="shieldAlert" tone="var(--proto)" title="Before uploading">Remove confidential information, personal data and client identifiers.</Notice>
  </>}>
    <fieldset disabled={preparation.busy} className="flex min-w-0 flex-col gap-5">
    <div><p className="mb-1.5 text-[13.5px] font-semibold">Card thumbnail</p><p className="mb-2 text-[12px] text-(--ink-3)">The card grid's hero image — without one, the card gets a generated poster</p>
      {thumbnail ? <div className="flex flex-wrap items-center gap-4"><div className="h-24 w-40 shrink-0 overflow-hidden rounded-[12px] border border-(--glass-edge)">{onPreviewThumbnail ? <button type="button" className="h-full w-full cursor-pointer" disabled={disabled} onClick={onPreviewThumbnail} aria-label="Preview thumbnail">{thumbnail}</button> : thumbnail}</div><button type="button" disabled={disabled} onClick={onRemoveThumbnail} className="cursor-pointer rounded-lg border border-(--glass-edge) px-3 py-1.5 text-[12.5px] font-semibold text-(--ink-2) disabled:opacity-40">Remove</button></div> : thumbnailUpload}
    </div>
    <div><p className="mb-1.5 text-[13.5px] font-semibold">Detail screenshots · {images.length}/6<RequiredMark /></p><p className="mb-2 text-[12px] text-(--ink-3)">At least one image showing the experience or outcome. A thumbnail alone does not meet this requirement.</p>
      <div className="flex flex-col gap-3">{!!images.length && <div className="grid gap-3 sm:grid-cols-2">{images.map(image => <MediaReorderItem key={image.id} id={image.id} ids={images.map(item => item.id)} label={`Screenshot ${images.indexOf(image) + 1}`} group="images" disabled={disabled || attachmentDisabled || linkedDirty} onReorder={onReorderImages} className="min-w-0 overflow-hidden rounded-[14px] border border-(--glass-edge)">
        <div className="aspect-[16/10] w-full overflow-hidden">{onPreviewImage ? <button type="button" className="h-full w-full cursor-pointer" disabled={disabled} onClick={() => onPreviewImage(image.id)} aria-label={`Preview screenshot ${images.indexOf(image) + 1}`}>{image.preview}</button> : image.preview}</div><div className="flex items-center gap-2 p-2"><input disabled={disabled} className={`${submissionInputClass} h-8 min-w-0 flex-1 rounded-lg px-2.5 py-0 text-[12.5px]`} value={image.caption} onChange={event => onCaption(image.id, event.target.value)} placeholder="e.g. Unmatched invoices awaiting review" maxLength={200} aria-label="Screenshot caption" aria-describedby={`caption-hint-${image.id}`} /><button type="button" disabled={disabled} onClick={() => onRemoveImage(image.id)} aria-label="Remove this screenshot" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-(--ink-3) disabled:opacity-40"><Icon name="close" size={14} /></button></div>
        <p id={`caption-hint-${image.id}`} className="px-3 pb-3 text-[12px] text-(--ink-3)">Describe the screen or result shown.</p>
      </MediaReorderItem>)}</div>}{images.length < 6 && imageUpload}</div>
    </div>
    <div className="flex min-w-0 flex-col gap-4">
      <div><p className="text-[13.5px] font-semibold">Demos and material<OptionalMark /></p><p className="mt-0.5 text-[12px] text-(--ink-3)">Add each file where it belongs, so CSMs can tell a client demo from background material. Up to 6 in total.{local ? " Local preview only." : ""}</p></div>
      {ATTACHMENT_SECTIONS.map(section => {
        const items = attachments.filter(item => item.purpose === section.purpose);
        const links = !!onLinkedAsset && section.links;
        const editor = linkEditor?.purpose === section.purpose ? linkEditor : null;
        const edited = editor?.id ? items.find(item => item.id === editor.id) : undefined;
        const locked = disabled || attachmentDisabled || linkedDirty || !!linkEditor;
        return <section key={section.purpose} aria-labelledby={`media-${section.key}`} className="min-w-0 rounded-[14px] border border-(--glass-edge) p-4" style={{ background: "color-mix(in srgb, var(--ink) 3%, transparent)" }}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 id={`media-${section.key}`} className="text-[14.5px] font-semibold">{section.title}</h3>
            <span className="font-mono text-[11px] text-(--ink-3)">{items.length}</span>
            {section.recommended && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>Recommended</span>}
          </div>
          <p className="mt-1 text-[12.5px] text-(--ink-2)">{links ? section.hint : section.fileHint}</p>
          {!!items.length && <ul className="mt-3 space-y-3">{items.map(item => <MediaReorderItem as="li" key={item.id} id={item.id} ids={items.map(entry => entry.id)} label={item.name} group={`attachments-${section.key}`} disabled={locked} onReorder={onReorderAttachments ? ids => reorderSection(section.purpose, ids) : undefined} className="min-w-0 border-b border-(--glass-edge) pb-3 last:border-b-0 last:pb-0"><div className="flex min-w-0 flex-wrap items-center gap-3"><Icon name={item.linkedAsset ? "link" : section.purpose === "Demo video" ? "play" : "file"} className="shrink-0" /><div className="min-w-0 flex-1"><span className="break-words">{item.name}</span>{item.linkedAsset && <p className="text-[12px] text-(--ink-3)">{assetTypeLabel(item.linkedAsset.assetType)}</p>}{item.status}</div>{onLinkedAsset && item.linkedAsset && <button type="button" disabled={disabled || !!linkEditor || linkedDirty} title="Edit link" aria-label={`Edit ${item.name}`} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center disabled:opacity-40" onClick={() => { if (!linkedDirty) setLinkEditor({ purpose: section.purpose, type: item.linkedAsset!.assetType, id: item.id }); }}><Icon name="edit" /></button>}{onPreviewAttachment && <button type="button" disabled={disabled || !!item.status} title="Preview" aria-label={`Preview ${item.name}`} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center disabled:opacity-40" onClick={() => onPreviewAttachment(item.id)}><Icon name="play" /></button>}<button type="button" disabled={disabled || editor?.id === item.id} title="Remove" aria-label={`Remove ${item.name}`} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center disabled:opacity-40" onClick={() => onRemoveAttachment(item.id)}><Icon name="close" /></button></div></MediaReorderItem>)}</ul>}
          {editor && onLinkedAsset ? <div className="mt-3"><LinkedAssetEditor key={editor.id ?? editor.type} type={edited?.linkedAsset?.assetType ?? editor.type} initial={edited?.linkedAsset} disabled={disabled || attachmentDisabled || (!editor.id && full)} onPending={setLinkedDirty}
            onSave={async value => { await onLinkedAsset(value, editor.id, section.purpose); setLinkEditor(null); }} onCancel={() => setLinkEditor(null)} /></div>
          : <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--accent) ${locked || full ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:brightness-110"}`} style={section.recommended ? { background: "var(--accent)", color: "var(--on-accent)" } : { border: "1px solid var(--glass-edge)" }}>
              <input type="file" className="sr-only" aria-label={`Upload ${section.upload.toLowerCase()}`} disabled={locked || full} accept={section.accept} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) addFile(file, section.purpose); }} />
              <Icon name="plus" size={16} />{section.upload}
            </label>
            {links && <SelectPicker compact label={`Add a link to ${section.title.toLowerCase()}`} value={"" as LinkAssetType | ""} placeholder="Add a link" options={LINK_ASSET_TYPES} getLabel={type => type ? assetTypeLabel(type) : "Add a link"} getButtonLabel={() => "Add a link"} buttonIcon="plus" buttonClassName={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent) ${locked || full ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:brightness-110"}`} onChange={type => { if (type && !locked && !full) setLinkEditor({ purpose: section.purpose, type }); }} />}
          </div>}
        </section>;
      })}
    </div>
    </fieldset>
    {preparation.progress && <div className="min-w-0 border-t border-(--glass-edge) pt-4">
      <LoadingState label={preparation.progress.phase === "loading" ? "Loading video compressor..." : preparation.progress.phase === "checking" ? "Checking compressed video..." : preparation.progress.percent === undefined ? "Compressing video..." : `Compressing video: ${preparation.progress.percent}%`} progress={preparation.progress.phase === "encoding" ? preparation.progress.percent : undefined} />
      <button type="button" onClick={preparation.cancel} className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 text-[14px]"><Icon name="close" />Cancel compression</button>
    </div>}
    {preparation.failure && <div className="min-w-0 border-t border-(--glass-edge) pt-4"><p role="alert" className="text-[14px]">Video compression could not finish in this browser. Nothing has been uploaded.</p><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={preparation.cancel} className="min-h-10 cursor-pointer rounded-lg border border-(--glass-edge) px-3 text-[14px]">Cancel</button><button type="button" onClick={preparation.useOriginal} className="min-h-10 cursor-pointer rounded-lg bg-(--accent) px-3 text-[14px] text-(--on-accent)">Use original</button></div></div>}
    {preparation.note && <p role="status" className="text-[14px] text-(--ink-2)">{preparation.note}</p>}
    {preparation.preview && <LocalVideoPreview file={preparation.preview} onClose={preparation.closePreview} />}
    {children}
  </StepShell>;
}

/** The Media step's attachment sections; the section a file is added to is its purpose (ADR-0011). */
const ATTACHMENT_SECTIONS: { purpose: AssetPurpose; key: string; title: string; upload: string; accept: string; hint: string; fileHint: string; links: boolean; recommended?: boolean }[] = [
  { purpose: "Demo video", key: "demo", title: "Demo videos", upload: "Upload demo video", accept: ".mp4,.webm", links: false, recommended: true,
    hint: "Upload video walkthroughs that CSMs can use to demonstrate the solution to clients. Videos should ideally be 2–5 minutes long and highlight key features and capabilities. You can add multiple videos in MP4 or WebM format (up to 500 MB each).",
    fileHint: "Upload video walkthroughs that CSMs can use to demonstrate the solution to clients. Videos should ideally be 2–5 minutes long and highlight key features and capabilities. You can add multiple videos in MP4 or WebM format (up to 500 MB each)." },
  { purpose: "Interactive demo", key: "interactive", title: "Interactive demo", upload: "Upload HTML file", accept: ".html,.htm", links: true,
    hint: "Add interactive demos or prototypes that allow CSMs to explore the solution firsthand. You can upload a self-contained HTML file (up to 25 MB) or share a link to a prototype, web app, Power Apps app, or Power BI report.",
    fileHint: "Add interactive demos or prototypes that allow CSMs to explore the solution firsthand. You can upload a self-contained HTML file (up to 25 MB)." },
  { purpose: "Supporting material", key: "supporting", title: "Supporting material", upload: "Upload file", accept: ".pdf,.ppt,.pptx,.mp4,.webm", links: true,
    hint: "Add supporting materials that help CSMs understand and present the solution. You can upload slides, one-pagers, PDFs (up to 25 MB), or non-demo videos, and share links to relevant tools, repositories, or marketing resources.",
    fileHint: "Add supporting materials that help CSMs understand and present the solution. You can upload slides, one-pagers, PDFs (up to 25 MB), or non-demo videos." },
];

function MediaReorderItem({ as: Element = "div", id, ids, label, group, disabled, onReorder, className, children }: {
  as?: "div" | "li"; id: string; ids: string[]; label: string; group: string; disabled: boolean; onReorder?: (ids: string[]) => void; className: string; children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const index = ids.indexOf(id);
  const mime = `application/x-prisma-${group}`;
  const move = (source: string, target: number) => {
    if (disabled || !onReorder || !ids.includes(source) || target < 0 || target >= ids.length) return;
    const next = ids.filter(value => value !== source);
    next.splice(target, 0, source);
    if (next.some((value, position) => value !== ids[position])) onReorder(next);
  };
  const control = "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-(--glass-edge) text-(--ink-2) hover:bg-(--glass-edge) disabled:cursor-not-allowed disabled:opacity-30";
  return <Element className={`${className} ${over ? "ring-2 ring-(--accent)" : ""}`} onDragOver={event => { if (!disabled && onReorder && event.dataTransfer.types.includes(mime)) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOver(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false); }} onDrop={event => { setOver(false); if (!event.dataTransfer.types.includes(mime)) return; event.preventDefault(); move(event.dataTransfer.getData(mime), index); }}>
    {onReorder && ids.length > 1 && <div className="flex items-center gap-2 px-2 py-2">
      <button type="button" className={`${control} cursor-grab active:cursor-grabbing`} disabled={disabled} draggable={!disabled} title={`Drag to reorder ${label}`} aria-label={`Reorder ${label}`} onDragStart={event => { if (disabled) { event.preventDefault(); return; } event.dataTransfer.setData(mime, id); event.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => setOver(false)} onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); move(id, index + (event.key === "ArrowUp" ? -1 : 1)); } }}><Icon name="grid" size={14} /></button>
      <span className="mr-auto font-mono text-[11px] text-(--ink-3)">{index + 1} / {ids.length}</span>
      <button type="button" className={control} disabled={disabled || index === 0} title="Move earlier" aria-label={`Move ${label} earlier`} onClick={() => move(id, index - 1)}><Icon name="chevronDown" size={14} className="rotate-180" /></button>
      <button type="button" className={control} disabled={disabled || index === ids.length - 1} title="Move later" aria-label={`Move ${label} later`} onClick={() => move(id, index + 1)}><Icon name="chevronDown" size={14} /></button>
    </div>}{children}
  </Element>;
}

export function UploadProgress({ name, received, size, active }: { name: string; received: number; size: number; active: boolean }) {
  const percent = size > 0 ? Math.min(100, Math.max(0, Math.round(received / size * 100))) : 0;
  const bytes = (value: number) => value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
  return <div className="mt-2 w-full min-w-0 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px]"><span className="text-(--ink-2)">{active ? percent === 100 ? "Finalizing..." : "Uploading..." : "Upload incomplete"}</span><span className="font-mono text-(--accent)">{percent}%</span></div>
    <ProgressRail label={`Upload ${name}`} value={percent} valueText={`${percent}%${active && percent === 100 ? ", finalizing" : !active ? ", incomplete" : ""}`} />
    <p className="font-mono text-[10.5px] text-(--ink-3)">{bytes(received)} / {bytes(size)}</p>
  </div>;
}

export function LinkedAssetEditor({ type, initial, disabled, onSave, onCancel, onPending }: { type: LinkAssetType; initial?: LinkedAssetInput; disabled?: boolean; onSave: (input: LinkedAssetInput) => Promise<void>; onCancel: () => void; onPending?: (pending: boolean) => void }) {
  const empty: LinkedAssetInput = { name: "", assetType: type, externalUrl: "", allowsEmbedding: false, embedHint: "" };
  const [value, setValue] = useState(initial ?? empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(value) !== JSON.stringify(initial ?? empty);
  useEffect(() => { onPending?.(dirty || busy); return () => onPending?.(false); }, [dirty, busy, onPending]);
  return <fieldset disabled={disabled || busy} className="min-w-0 space-y-4 border-y border-(--glass-edge) py-5">
    <legend className="text-[14px] font-semibold">{initial ? "Edit asset" : "Add asset"}</legend>
    <Field label="Asset name" required><input className={submissionInputClass} maxLength={100} value={value.name} onChange={event => setValue({ ...value, name: event.target.value })} /></Field>
    {type !== "Desktop app or script" && <Field label="Application URL" required><input type="url" className={submissionInputClass} placeholder="https://" maxLength={2000} value={value.externalUrl} onChange={event => setValue({ ...value, externalUrl: event.target.value })} /></Field>}
    {type === "Hosted web app (URL)" && <label className="flex items-start gap-3 text-[14px]"><input type="checkbox" className="mt-1" checked={value.allowsEmbedding} onChange={event => setValue({ ...value, allowsEmbedding: event.target.checked })} />Allow sandboxed embedding</label>}
    <Field label={type === "Desktop app or script" ? "Demo arrangements" : "Access notes"} required={type === "Desktop app or script"}><textarea className={submissionInputClass} rows={3} maxLength={200} value={value.embedHint} onChange={event => setValue({ ...value, embedHint: event.target.value })} /></Field>
    {error && <p role="alert" className="text-[14px]">{error}</p>}
    <div className="flex flex-wrap gap-3"><button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-(--accent) px-4 py-2.5 text-[14px] font-semibold text-(--on-accent) disabled:opacity-40" onClick={async () => {
      setError(""); let validated: LinkedAssetInput;
      try { validated = validateLinkedAsset(value); } catch (caught) { setError(caught instanceof Error ? caught.message : "Check asset fields."); return; }
      setBusy(true);
      try { await onSave(validated); setValue(initial ?? empty); } catch (caught) { setError(caught instanceof Error ? caught.message : "Asset save failed."); } finally { setBusy(false); }
    }}><Icon name="check" />{busy ? "Saving..." : initial ? "Save asset" : "Add asset"}</button><button type="button" className="cursor-pointer rounded-lg border border-(--glass-edge) px-4 py-2.5 text-[14px]" onClick={onCancel}>Cancel</button></div>
  </fieldset>;
}

type IdentityProps<Area extends string, Status extends string, Role extends string> = {
  value: IdentityText; onText: (key: keyof IdentityText, value: string) => void;
  area?: Area; areas: { value: Area; label: string }[]; onArea?: (value: Area) => void;
  status: Status; statuses: { value: Status; label: string }[]; onStatus: (value: Status) => void;
  role?: Role | ""; roles?: readonly Role[]; onRole?: (value: Role | "") => void;
  /** Multi-valued mode (native N:N). When set, replaces the single-area picker. */
  selectedAreas?: Area[]; onAreas?: (value: Area[]) => void; maxAreas?: number;
};

/** Name, summary, area and status. \`grouped\` splits them into labelled subsections inside a section card. */
/** Pass `selectedAreas` + `onAreas` for N:N specialization areas (up to `maxAreas`); otherwise `area` + `onArea` pick one. */
/** Omit `onStatus` to leave Status out (the guided flow asks it under Solution context, through `StatusField`). */
export function SolutionDetailsFields<Area extends string, Status extends string>({ value, onText, area, areas, onArea, status, statuses, onStatus, grouped = false, selectedAreas, onAreas, maxAreas = 3 }: Omit<IdentityProps<Area, Status, string>, "role" | "roles" | "onRole" | "status" | "statuses" | "onStatus"> & Partial<Pick<IdentityProps<Area, Status, string>, "status" | "statuses" | "onStatus">> & { grouped?: boolean }) {
  const toggleArea = (option: Area) => {
    if (!selectedAreas || !onAreas) return;
    if (selectedAreas.includes(option)) onAreas(selectedAreas.filter(entry => entry !== option));
    else if (selectedAreas.length < maxAreas) onAreas([...selectedAreas, option]);
  };
  const naming = <>
    <Field label="Solution name" required hint="A short product name people will remember."><input className={submissionInputClass} value={value.name} onChange={event => onText("name", event.target.value)} placeholder="e.g. Ledger Reconciler" maxLength={100} /></Field>
    <Field label="One-line summary" required hint={`Who it's for and what it does for them, in one sentence. ${value.summary.length}/200 characters.`}><input className={submissionInputClass} value={value.summary} onChange={event => onText("summary", event.target.value)} placeholder="e.g. Helps finance teams match invoices to payments." maxLength={200} /></Field>
  </>;
  const classification = <>
    {selectedAreas && onAreas
      ? <Field label="Specialization areas" required hint={`Choose up to ${maxAreas}. The first one you pick sets the card colour.`}><div className="flex flex-wrap gap-2">{areas.map(option => <Chip key={option.value} active={selectedAreas.includes(option.value)} onClick={() => toggleArea(option.value)}>{option.label}</Chip>)}</div></Field>
      : <Field label="Specialization area" required><div className="flex flex-wrap gap-2">{areas.map(option => <Chip key={option.value} active={area === option.value} onClick={() => onArea?.(option.value)}>{option.label}</Chip>)}</div></Field>}
    {onStatus && status !== undefined && statuses && <StatusField status={status} statuses={statuses} onStatus={onStatus} />}
  </>;
  if (!grouped) return <>{naming}{classification}</>;
  return <>
    <FormSubsection title="Name & summary"><div className="flex min-w-0 flex-col gap-5">{naming}</div></FormSubsection>
    <FormSubsection title="Classification"><div className="flex min-w-0 flex-col gap-5">{classification}</div></FormSubsection>
  </>;
}

export function StatusField<Status extends string>({ status, statuses, onStatus }: { status: Status; statuses: { value: Status; label: string }[]; onStatus: (value: Status) => void }) {
  return <Field label="Status" required><div className="flex flex-wrap gap-2">{statuses.map(option => <Chip key={option.value} active={status === option.value} onClick={() => onStatus(option.value)}>{option.label}</Chip>)}</div></Field>;
}

/**
 * Target role, internal client name and anonymous profile. Fields carry their own badges because their visibility differs.
 * Pass `associated` + `onAssociated` to ask "Is this solution associated with a client?" first and show the fields only on Yes.
 */
export function ClientFields<Role extends string>({ value, onText, role, roles, onRole, framed = false, associated, onAssociated }: Pick<IdentityProps<string, string, Role>, "value" | "onText" | "role" | "roles" | "onRole"> & { framed?: boolean; associated?: boolean; onAssociated?: (associated: boolean) => void }) {
  const asked = onAssociated !== undefined;
  const question = asked && <fieldset className="min-w-0">
    <legend className="mb-2 text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>Is this solution associated with a client?<RequiredMark /></legend>
    <div className="flex flex-wrap gap-2">{([[true, "Yes"], [false, "No"]] as const).map(([option, label]) => <label key={label} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-semibold focus-within:outline-2 focus-within:outline-(--accent) ${associated === option ? "border-(--accent) bg-(--accent) text-(--on-accent)" : "border-(--glass-edge) text-(--ink-2)"}`}>
      <input type="radio" className="sr-only" name="client-associated" checked={associated === option} onChange={() => onAssociated(option)} />{label}
    </label>)}</div>
  </fieldset>;
  const fields = (!asked || associated) && <>
    {onRole && roles && <FormSubsection title="Audience">
      <Field label="Target client role" optional badge={<VisibilityBadge visibility="client" />} hint="Select the primary client role this solution is designed to support."><SelectPicker label="Target client role" value={role ?? ""} options={role ? ["", ...roles] : roles} onChange={onRole} getLabel={option => option || "No specific role"} placeholder="e.g. Chief of Staff" /></Field>
    </FormSubsection>}
    <FormSubsection title="Client details">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <Field label="Client name" required={asked} badge={<VisibilityBadge visibility="internal" />} hint="Internal reference only. Enter the client or organization associated with this solution."><input className={submissionInputClass} value={value.clientContext} onChange={event => onText("clientContext", event.target.value)} placeholder="e.g. Fabrikam Logistics" maxLength={200} /></Field>
        <Field label="Anonymous client profile" required={asked || !!value.clientContext.trim()} badge={<VisibilityBadge visibility="client" />} hint="Used in presentations instead of the client name. Keep it brief and non-identifying."><input className={submissionInputClass} value={value.redacted} onChange={event => onText("redacted", event.target.value)} placeholder="e.g. A national logistics provider" maxLength={200} /></Field>
      </div>
    </FormSubsection>
  </>;
  if (!framed) return <>{question}{fields}</>;
  return <SectionCard level={3} icon={SECTION_META.Client.icon} title="Client" description={STEP_INTRODUCTIONS.Client}>{question}{fields}</SectionCard>;
}

/** The single-page identity step used by the connected app: details followed by a framed Client card. */
export function IdentityFields<Area extends string, Status extends string, Role extends string = string>({ role, roles, onRole, ...details }: IdentityProps<Area, Status, Role>) {
  return <>
    <SolutionDetailsFields {...details} />
    <ClientFields value={details.value} onText={details.onText} role={role} roles={roles} onRole={onRole} framed />
  </>;
}

export function FormSubsection({ title, children }: { title: string; children: ReactNode }) {
  return <div className="min-w-0 border-t border-(--glass-edge) pt-5 first:border-t-0 first:pt-0"><h4 className="mb-3 font-mono text-[10.5px] tracking-[0.12em] text-(--ink-3) uppercase">{title}</h4>{children}</div>;
}

export type Visibility = "internal" | "client";

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const internal = visibility === "internal";
  const color = internal ? "var(--proto)" : "var(--accent)";
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-[0.08em] uppercase" style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}><Icon name={internal ? "eyeOff" : "present"} size={11} />{internal ? "Internal only" : "Shown to clients"}</span>;
}

/** A level-3 SectionCard whose icon, description and visibility come from the section metadata. */
export function NamedSection({ title, children }: { title: string; children: ReactNode }) {
  const meta = SECTION_META[title];
  return <SectionCard level={3} icon={meta.icon} title={title} description={STEP_INTRODUCTIONS[title]} visibility={meta.visibility}>{children}</SectionCard>;
}

/** The bordered section pattern: icon, title with an optional section-level visibility badge, description, grouped content. */
export function SectionCard({ level = 2, icon, title, description, visibility, children }: { level?: 2 | 3; icon: IconName; title: string; description?: string; visibility?: Visibility; children: ReactNode }) {
  const id = useId();
  const Heading = level === 2 ? "h2" : "h3";
  return <section aria-labelledby={id} className="min-w-0 rounded-[20px] border border-(--glass-edge) p-5 sm:p-6" style={{ background: "color-mix(in srgb, var(--ink) 4%, transparent)" }}>
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}><Icon name={icon} size={16} /></span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1"><Heading id={id} className={`${level === 2 ? "text-[20px]" : "text-[17px]"} font-semibold`}>{title}</Heading>{visibility && <VisibilityBadge visibility={visibility} />}</div>
        {description && <p className="mt-0.5 text-[13px] text-(--ink-3)">{description}</p>}
      </div>
    </div>
    <div className="mt-5 flex min-w-0 flex-col gap-5 border-t border-(--glass-edge) pt-5">{children}</div>
  </section>;
}

/** `nested` renders the story as a section card inside a larger step (Define the solution) instead of a step of its own. */
export function StoryFields({ whatItDoes, businessValue, onChange, nested = false, children }: { whatItDoes: string; businessValue: string; onChange: (key: "whatItDoes" | "businessValue", value: string) => void; nested?: boolean; children?: ReactNode }) {
  const Shell = nested ? NamedSection : StepShell;
  return <Shell title="What does it do, and why does it matter?">
    <Field label="What the solution does" required hint="What a user does in it, and what they get out of it."><textarea className={`${submissionInputClass} min-h-28 resize-y`} value={whatItDoes} onChange={event => onChange("whatItDoes", event.target.value)} placeholder="e.g. Upload invoices, review suggested matches, and export unmatched items." maxLength={4000} /></Field>
    <Field label="Business value" required hint="The problem it solves and why that matters. Add real numbers only if you have them."><textarea className={`${submissionInputClass} min-h-28 resize-y`} value={businessValue} onChange={event => onChange("businessValue", event.target.value)} placeholder="e.g. Reduces manual invoice matching so finance can focus on exceptions." maxLength={4000} /></Field>
    {children}
  </Shell>;
}

export function SubmissionReview({ card, attachments, contributors, hours, images, safety, client, context, role, nextState, children }: {
  card: ReactNode; attachments: number; contributors: string; hours: number | null; images: string; safety: string; client: string; context: string; role?: string; nextState: string; children?: ReactNode;
}) {
  const rows = [["Attachments", `${attachments} additional files`], ["Built by", contributors], ["Total effort", hours === null ? "Incomplete" : `${hours.toLocaleString()} hours`], ["Images", images], ["Safety", safety], ["Client (internal)", client || "No client"], ["Public context", context || "None"], ...(role === undefined ? [] : [["Client role", role || "Not specified"]]), ["Next state", nextState]];
  return <StepShell title="Review & submit"><div className="pointer-events-none mx-auto w-full max-w-[400px]" inert>{card}</div>
    <dl className="grid gap-2 text-[14px] sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="flex min-w-0 gap-3 rounded-xl border border-(--glass-edge) px-3.5 py-2.5"><dt className="w-24 shrink-0 font-mono text-[10.5px] tracking-[0.1em] text-(--ink-3) uppercase">{label}</dt><dd className="min-w-0 flex-1 break-words text-(--ink)">{value}</dd></div>)}</dl>{children}
  </StepShell>;
}

export function ContributorEditor({ children, total, onAdd, addDisabled = false, bare = false }: { children: ReactNode; total: number | null; onAdd: () => void; addDisabled?: boolean; bare?: boolean }) {
  return <section aria-labelledby={bare ? undefined : "contributors-heading"} aria-label={bare ? "Contributors" : undefined} className={bare ? "min-w-0" : "mt-2 min-w-0 border-t border-(--glass-edge) pt-5"}>
    {!bare && <h3 id="contributors-heading" className="text-[17px] font-semibold">Built by &amp; effort</h3>}
    <p className={`${bare ? "" : "mt-1 "}text-[13px] text-(--ink-2)`}>Enter the minimum hours each person needed to work on this solution, including preparation and discovery.</p>
    {children}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <button type="button" disabled={addDisabled} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-(--glass-edge) px-3 py-2 text-[13px] font-semibold disabled:opacity-40" onClick={onAdd}><Icon name="plus" size={14} />Add contributor</button>
      <p aria-live="polite" className="text-[14px] font-semibold">Total effort: {total === null ? "Incomplete" : `${total.toLocaleString()} hours`}</p>
    </div>
  </section>;
}

/** `level` is the selected consultant's directory level; leave it undefined until a person is selected. */
export function ContributorRow({ index, person, level, value, onChange, onRemove, result }: {
  index: number; person: ReactNode; level?: string | null; value: number | null; onChange: (directHours: number | null) => void;
  onRemove?: () => void; result: { error: string; hours: number };
}) {
  const id = useId();
  return <fieldset className="mt-5 min-w-0 border-b border-(--glass-edge) pb-5" aria-describedby={id}>
    <legend className="mb-3 text-[13px] font-semibold">Contributor {index + 1}</legend>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className={`min-w-0 ${level === undefined ? "sm:col-span-2" : ""}`}>{person}</div>
      {level !== undefined && <div className="min-w-0">
        <p className="mb-1.5 text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>Level</p>
        <p className="py-2.5 text-[15px] text-(--ink-2)">{level || "Not recorded in the consultant directory"}</p>
      </div>}
      <Field label="Minimum hours required" required><input type="number" className={submissionInputClass} min={0} step={0.01} value={value ?? ""} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} /></Field>
      <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2">
        <p id={id} aria-live="polite" className={`text-[13px] ${result.error ? "text-(--proto)" : "text-(--ink-2)"}`}>{result.error || `${result.hours.toLocaleString()} hours`}</p>
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
    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the combobox input owns keyboard selection (aria-activedescendant). */}
    {open && <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border border-(--glass-edge) bg-(--ground) p-1 shadow-lg"><ul id={`${id}-list`} role="listbox" aria-label="People" className="max-h-60 overflow-y-auto">{matches.map((person, index) => <li key={person.id} id={`${id}-option-${person.id}`} role="option" aria-selected={person.id === value.id} ref={element => { if (index === activeIndex) element?.scrollIntoView({ block: "nearest" }); }} className="cursor-pointer rounded-md px-3 py-2 text-[14px] break-words hover:bg-(--glass-edge)" style={{ background: index === activeIndex ? "var(--glass-edge)" : undefined }} onPointerDown={event => event.preventDefault()} onClick={() => select(person)}><span className="block font-semibold">{person.name}</span>{person.email && <span className="block text-[12px] text-(--ink-3)">{person.email}</span>}</li>)}</ul>{!matches.length && <p role="status" className="px-3 py-2 text-[13px] text-(--ink-3)">No matching people</p>}</div>}
  </div>;
}