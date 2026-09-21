import { useEffect, useId, useMemo, useState } from "react";
import type {
  AssetType,
  DemoAsset,
  Solution,
  SolutionContributor,
  SolutionStatus,
  SpecializationArea,
} from "../types";
import { AREA_ORDER, AREAS, BUILDERS, BUSINESS_CALENDARS, DEFAULT_BUSINESS_CALENDAR_ID, SOLUTIONS } from "../data/solutions";
import { Chip } from "../components/Badges";
import { Icon } from "../components/Icon";
import { SelectPicker } from "../components/SelectPicker";
import { SolutionCard } from "../components/SolutionCard";
import { navigate } from "../lib/router";
import type { AppUser } from "../lib/powerContext";
import { calculateEffort, usesDirectHours } from "../lib/effort";
import { assertSubmissionReady, UNTITLED_SOLUTION } from "../lib/submissions";

const STEPS = [
  "Before you start",
  "What is it?",
  "What & why",
  "Tag it",
  "Media",
  "Review & submit",
] as const;

const MAX_GALLERY = 6;

interface Draft {
  name: string;
  summary: string;
  area: SpecializationArea;
  status: SolutionStatus;
  whatItDoes: string;
  businessValue: string;
  capabilities: string[];
  technologies: string[];
  industries: string[];
  assetType: AssetType;
  assets: DemoAsset[];
  thumbnail: string;
  images: { id: string; src: string; caption: string }[];
  safetyAcknowledged: boolean;
  clientContext: string;
  redacted: string;
  contributors: SolutionContributor[];
}

const EMPTY_DRAFT: Draft = {
  name: "",
  summary: "",
  area: "ai",
  status: "Working prototype",
  whatItDoes: "",
  businessValue: "",
  capabilities: [],
  technologies: [],
  industries: [],
  assetType: "Self-contained HTML file",
  assets: [],
  thumbnail: "",
  images: [],
  safetyAcknowledged: false,
  clientContext: "",
  redacted: "",
  contributors: [],
};

const DRAFT_KEY = "nsl.draft.v2";

const STATUS_OPTIONS: SolutionStatus[] = [
  "Idea / concept",
  "Working prototype",
  "Client demo",
  "Live in production",
];

const ASSET_OPTIONS: AssetType[] = [
  "Self-contained HTML file",
  "Video walkthrough only",
  "Client-ready one-pager / slide",
];

function optionsFrom(key: "capabilities" | "industries" | "technologies"): string[] {
  return [...new Set(SOLUTIONS.flatMap((s) => s[key]))].sort();
}

function loadDraft(draftKey: string): Draft {
  try {
    const raw = sessionStorage.getItem(draftKey);
    if (!raw) return EMPTY_DRAFT;
    const parsed = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
    // Drafts persisted before a schema change may miss array fields.
    parsed.images ??= [];
    parsed.capabilities ??= [];
    parsed.technologies ??= [];
    parsed.industries ??= [];
    parsed.contributors ??= [];
    parsed.contributors = parsed.contributors.map((contributor) => ({
      ...contributor, calendarId: DEFAULT_BUSINESS_CALENDAR_ID,
    }));
    return parsed;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function SubmitView({ user, draftKey = DRAFT_KEY, activeStep, onStepChange, onSubmitted, onSaveDraft, initialSolution }: {
  user: AppUser;
  draftKey?: string;
  activeStep?: number;
  onStepChange?: (step: number) => void;
  onSubmitted?: (solution: Solution) => void | Promise<void>;
  onSaveDraft?: (solution: Solution) => Promise<void>;
  initialSolution?: Solution;
}) {
  const [internalStep, setInternalStep] = useState(0);
  const step = activeStep ?? internalStep;
  const setStep = (next: number | ((current: number) => number)) => {
    const value = typeof next === "function" ? next(step) : next;
    setInternalStep(value);
    onStepChange?.(value);
  };
  const [draft, setDraft] = useState<Draft>(() => {
    const saved: Draft = initialSolution ? {
      ...EMPTY_DRAFT, name: initialSolution.name === UNTITLED_SOLUTION ? "" : initialSolution.name, summary: initialSolution.summary,
      area: initialSolution.specializationArea, status: initialSolution.status,
      whatItDoes: initialSolution.whatItDoes, businessValue: initialSolution.businessValue,
      capabilities: initialSolution.capabilities, technologies: initialSolution.technologies,
      industries: initialSolution.industries, contributors: initialSolution.contributors,
      thumbnail: initialSolution.thumbnail ?? "", images: (initialSolution.images ?? []).map((image) => ({ ...image, caption: image.caption ?? "" })),
      assets: initialSolution.assets, clientContext: initialSolution.clientContext ?? "",
      redacted: initialSolution.clientContextRedacted ?? "", safetyAcknowledged: initialSolution.publicationStatus === "Draft" && initialSolution.safetyAcknowledged,
    } : loadDraft(draftKey);
    if (saved.contributors.length) return saved;
    return { ...saved, contributors: [{
      id: crypto.randomUUID(),
      builtBy: BUILDERS.find((builder) => builder.email === user.userPrincipalName) ?? {
        id: user.userPrincipalName, name: user.fullName, email: user.userPrincipalName,
      },
      startDate: "", endDate: "", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID,
    }] };
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState(() => initialSolution?.id ?? crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUploads, setImageUploads] = useState(0);
  const mediaBusy = uploading || imageUploads > 0;
  const imageBusyChanged = (busy: boolean) => setImageUploads((count) => count + (busy ? 1 : -1));

  // Draft saving at every step — the design's contribution-friction requirement.
  // Image data URLs stay in memory only: they can blow the storage quota.
  useEffect(() => {
    if (submitted) {
      try { sessionStorage.removeItem(draftKey); } catch { return; }
      return;
    }
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey, JSON.stringify({ ...draft, thumbnail: "", images: [], assets: [] }));
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setStorageError("");
      } catch {
        setStorageError("Draft storage is unavailable. Keep this page open until you submit.");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [draft, draftKey, submitted]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const directEffort = usesDirectHours(draft.status);
  const normalizedContributors = draft.contributors.map((contributor) => ({ ...contributor, effortMode: directEffort ? "direct" as const : "calendar" as const }));
  const builders = [...new Map([
    ...BUILDERS,
    BUILDERS.find((builder) => builder.email.toLowerCase() === user.userPrincipalName.toLowerCase()) ??
      { id: user.userPrincipalName, name: user.fullName, email: user.userPrincipalName },
    ...draft.contributors.map((contributor) => contributor.builtBy),
  ].filter((builder) => builder.id).map((builder) => [builder.email.toLowerCase(), builder])).values()];
  const contributionResults = normalizedContributors.map((contributor) => {
    try {
      if (!contributor.builtBy.id) throw new Error("Select a contributor.");
      if (draft.contributors.filter((entry) => entry.builtBy.id === contributor.builtBy.id).length > 1) {
        throw new Error("Each person can only be added once.");
      }
      return { ...calculateEffort(contributor, BUSINESS_CALENDARS.find((calendar) => calendar.id === contributor.calendarId)), error: "" };
    } catch (error) {
      return { businessDays: 0, hours: 0, error: error instanceof Error ? error.message : "Check this contributor's effort." };
    }
  });
  const contributorsValid = draft.contributors.length > 0 && contributionResults.every((result) => !result.error);
  const nameValid = Boolean(draft.name.trim()) && draft.name.trim() !== UNTITLED_SOLUTION && draft.name.length <= 100;
  const basicsValid = nameValid && Boolean(draft.summary.trim()) && contributorsValid && (!draft.clientContext.trim() || Boolean(draft.redacted.trim()));
  const safetyValid = draft.safetyAcknowledged;
  const mediaValid = draft.images.length > 0 && !mediaBusy;
  const capabilityValid = draft.capabilities.length === 1;
  const stepValid = safetyValid && (step === 1 ? basicsValid : step === 3 ? capabilityValid : step === 4 ? mediaValid : true);
  const totalHours = Math.round(contributionResults.reduce((total, result) => total + result.hours, 0) * 100) / 100;
  const updateContributor = (id: string, patch: Partial<SolutionContributor>) =>
    set("contributors", draft.contributors.map((contributor) => contributor.id === id ? { ...contributor, ...patch } : contributor));

  const preview: Solution = useMemo(
    () => ({
      ...initialSolution,
      id: "preview",
      name: draft.name || "Untitled solution",
      summary: draft.summary || "The one-line summary appears here.",
      whatItDoes: draft.whatItDoes,
      businessValue: draft.businessValue,
      specializationArea: draft.area,
      contributors: draft.contributors.map((contributor) => ({
        ...contributor, effortMode: usesDirectHours(draft.status) ? "direct" : "calendar",
      })),
      status: draft.status,
      publicationStatus: "Draft",
      safetyAcknowledged: draft.safetyAcknowledged,
      clientSafeReviewed: false,
      clientContext: draft.clientContext || undefined,
      clientContextRedacted: draft.redacted || undefined,
      thumbnail: draft.thumbnail || undefined,
      images: draft.images.map(({ id, src, caption }) => ({ id, src, caption: caption || undefined })),
      dateAdded: initialSolution?.dateAdded ?? new Date().toISOString().slice(0, 10),
      searchKeywords: initialSolution?.searchKeywords ?? "",
      capabilities: draft.capabilities,
      technologies: draft.technologies,
      industries: draft.industries,
      assets: draft.assets,
    }),
    [draft, initialSolution],
  );

  const persist = async (asDraft: boolean) => {
    if (saving || mediaBusy || !nameValid || (!asDraft && (!basicsValid || !safetyValid || !mediaValid || !capabilityValid))) return;
    setSaving(true);
    setSaveError("");
    try {
      const solution: Solution = { ...preview, id: submissionId, name: draft.name.trim(), summary: draft.summary.trim(), publicationStatus: asDraft ? "Draft" : "Pending review" };
      if (!asDraft) assertSubmissionReady(solution);
      if (asDraft) await onSaveDraft?.(solution);
      else await onSubmitted?.(solution);
      try { sessionStorage.removeItem(draftKey); } catch { setSavedAt(null); }
      if (asDraft) navigate("/my-submissions");
      else setSubmitted(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save. Your changes are still open here.");
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 pt-16 pb-24 sm:px-6">
        <div className="glass glass-lite glass-sheen animate-scale-in rounded-[26px] p-10 text-center">
          <span
            className="mx-auto grid h-14 w-14 place-items-center rounded-full"
            style={{ background: "var(--live)", color: "var(--ground)" }}
          >
            <Icon name="check" size={26} />
          </span>
          <p className="eyebrow mt-6">Submitted</p>
          <h1 className="mt-2 text-[26px] font-bold">Now it's pending review</h1>
          <p className="mx-auto mt-3 max-w-[46ch] text-[15.5px]" style={{ color: "var(--ink-2)" }}>
            <b style={{ color: "var(--ink)" }}>{draft.name || "Your solution"}</b> is pending review in this local preview.
            No notification was sent and nothing was published. {onSaveDraft ? "Submissions and media are saved in this browser." : "This walkthrough does not save submissions."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => navigate("/my-submissions")} className="cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold" style={{ fontFamily: "var(--font-display)", background: "var(--accent)", color: "var(--on-accent)" }}>
              My submissions
            </button>
            <button
              type="button"
              onClick={() => {
                if (initialSolution) { navigate("/submit"); return; }
                setDraft({ ...EMPTY_DRAFT, contributors: [{ id: crypto.randomUUID(), builtBy: { id: user.userPrincipalName, name: user.fullName, email: user.userPrincipalName }, startDate: "", endDate: "", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID }] });
                setStep(0);
                setSubmissionId(crypto.randomUUID());
                setSubmitted(false);
              }}
              className="cursor-pointer rounded-xl border px-4 py-2.5 text-[14px] font-semibold"
              style={{ fontFamily: "var(--font-display)", borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}
            >
              Submit another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 pt-8 pb-24 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}
      >
        <Icon name="chevronLeft" size={15} />
        Back to the library
      </button>

      <div className="animate-rise mt-4">
        <p className="eyebrow">Contributor · guided submission</p>
        <h1 className="mt-2 text-[28px] font-bold">
          {initialSolution ? "Edit submission" : "Put your work on the shelf"}
        </h1>
        <p className="mt-2 max-w-[58ch] text-[15.5px]" style={{ color: "var(--ink-2)" }}>
          {initialSolution?.publicationStatus === "Published" ? "Saving changes removes this record from the library until it is approved again." : onSaveDraft ? "Drafts and submissions are saved in this browser only." : "Walkthrough only. Text backups stay in this tab; media stays in memory."}
          {savedAt && (
            <span className="font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>
              {" "}
              · text backup {savedAt}
            </span>
          )}
        </p>
      </div>

      {initialSolution?.reviewComments && <section aria-label="Librarian feedback" className="mt-5 border-l-2 pl-4" style={{ borderColor: "var(--proto)" }}>
        <h2 className="text-[15px] font-semibold">Librarian feedback</h2>
        <p className="mt-1 whitespace-pre-wrap break-words text-[14px]">{initialSolution.reviewComments}</p>
      </section>}
      {saveError && <p role="alert" className="mt-3 text-[14px]">{saveError}</p>}

      {storageError && <p role="alert" className="mt-3 text-[14px]">{storageError}</p>}

      <fieldset disabled={saving} className="min-w-0">
      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Submission steps">
        {STEPS.map((label, i) => {
          const state = i === step ? "current" : i < step ? "done" : "todo";
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => i < step && (i === 0 || safetyValid) && setStep(i)}
                aria-current={state === "current" ? "step" : undefined}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${i < step ? "cursor-pointer" : "cursor-default"}`}
                style={{
                  fontFamily: "var(--font-display)",
                  borderColor: state === "current" ? "var(--accent)" : "var(--glass-edge)",
                  background:
                    state === "current"
                      ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                      : "transparent",
                  color: state === "todo" ? "var(--ink-3)" : "var(--ink)",
                }}
              >
                <span
                  className="grid h-4.5 w-4.5 place-items-center rounded-full font-mono text-[9.5px]"
                  style={{
                    background: state === "done" ? "var(--live)" : "color-mix(in srgb, var(--ink) 12%, transparent)",
                    color: state === "done" ? "var(--ground)" : "var(--ink-2)",
                  }}
                >
                  {state === "done" ? <Icon name="check" size={9} /> : i + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      <div key={step} className="glass glass-lite glass-sheen animate-rise mt-5 rounded-[24px] p-6 sm:p-8">
        {step === 0 && (
          <StepShell title="Before you start" lede="Your work will help CSMs present solutions to clients. Prepare a client-safe story before adding content.">
            <ul className="list-disc space-y-4 pl-5 text-[15px]">
              <li>Use invented or anonymized data in descriptions, screenshots, videos, documents and HTML. Remove confidential figures, names and identifying details.</li>
              <li>Only attach material you are authorized to share. Acknowledging this does not replace librarian review.</li>
              <li>The dedicated client field is internal only. Write a separate anonymous description for presentations, or leave both fields empty for work without a client.</li>
            </ul>
            <label className="flex cursor-pointer items-start gap-3 text-[15px]">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={draft.safetyAcknowledged} onChange={(event) => set("safetyAcknowledged", event.target.checked)} />
              <span>I understand and will submit only authorized, client-safe content, with client identity confined to the internal client field.</span>
            </label>
          </StepShell>
        )}

        {step > 0 && !safetyValid && <p role="alert">Accept the safety requirements in Before you start to continue.</p>}

        {step === 1 && safetyValid && (
          <StepShell title="What is it?" lede="The card's first impression — name it like a product, not a project code.">
            <Field label="Solution name" required hint="Give the solution a short, recognizable product name.">
              <input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ledger Reconciler" maxLength={100} />
            </Field>
            <Field label="One-line summary" required hint={`Describe who it helps and what it achieves in one sentence. ${draft.summary.length}/200 characters.`}>
              <input className={inputCls} value={draft.summary} onChange={(e) => set("summary", e.target.value)} placeholder="e.g. Helps finance teams match invoices to payments." maxLength={200} />
            </Field>
            <Field label="Specialization area">
              <div className="flex flex-wrap gap-2">
                {AREA_ORDER.map((id) => (
                  <Chip key={id} active={draft.area === id} onClick={() => set("area", id)}>
                    {AREAS[id].name}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Status">
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <Chip key={s} active={draft.status === s} onClick={() => set("status", s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Who was this developed for?" hint="Optional. Client and engagement name for internal discovery only; never included in present mode.">
              <input className={inputCls} value={draft.clientContext} onChange={(event) => set("clientContext", event.target.value)} placeholder="e.g. Fabrikam Logistics, FY26 pilot" maxLength={200} />
            </Field>
            <Field label="How should we describe this client?" required={Boolean(draft.clientContext.trim())} hint="Client-visible context without names or identifying details. Leave empty if this work has no client.">
              <input className={inputCls} value={draft.redacted} onChange={(event) => set("redacted", event.target.value)} placeholder="e.g. a national logistics provider" maxLength={200} />
            </Field>
            <section aria-labelledby="contributors-heading" className="mt-2 min-w-0 border-t pt-5" style={{ borderColor: "var(--glass-edge)" }}>
              <h3 id="contributors-heading" className="text-[17px] font-semibold">Built by & effort</h3>
              <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>{directEffort ? "Enter each person's hours, including preparation and discovery." : "Estimated capacity: inclusive US business days, excluding federal holidays, multiplied by 8 hours and allocation."}</p>
              {draft.contributors.map((contributor, index) => {
                const calendar = BUSINESS_CALENDARS.find((entry) => entry.id === contributor.calendarId);
                const result = contributionResults[index];
                return (
                  <fieldset key={contributor.id} className="mt-5 min-w-0 border-b pb-5" style={{ borderColor: "var(--glass-edge)" }} aria-describedby={`effort-${contributor.id}`}>
                    <legend className="mb-3 text-[13px] font-semibold">Contributor {index + 1}</legend>
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <div className="min-w-0 sm:col-span-2">
                        <PersonPicker
                          value={contributor.builtBy}
                          options={builders.filter((builder) => !draft.contributors.some((entry) => entry.id !== contributor.id && entry.builtBy.id === builder.id))}
                          onChange={(builtBy) => updateContributor(contributor.id, { builtBy })}
                        />
                      </div>
                      {directEffort ? <Field label="Hours contributed" required>
                        <input type="number" className={inputCls} min={0} step={0.01} value={contributor.directHours ?? ""} onChange={(event) => updateContributor(contributor.id, { directHours: event.target.value === "" ? undefined : Number(event.target.value) })} />
                      </Field> : <>
                      <Field label="Start date" required>
                        <input type="date" className={`${inputCls} min-w-0`} min={calendar?.startDate} max={calendar?.endDate} value={contributor.startDate} onChange={(event) => updateContributor(contributor.id, { startDate: event.target.value })} />
                      </Field>
                      <Field label="End date" required>
                        <input type="date" className={`${inputCls} min-w-0`} min={contributor.startDate || calendar?.startDate} max={calendar?.endDate} value={contributor.endDate} onChange={(event) => updateContributor(contributor.id, { endDate: event.target.value })} />
                      </Field>
                      <Field label="Allocation (%)" required>
                        <input type="number" className={inputCls} min={0} max={100} step={0.01} value={Number.isFinite(contributor.allocation) ? contributor.allocation : ""} onChange={(event) => updateContributor(contributor.id, { allocation: event.target.value === "" ? NaN : Number(event.target.value) })} />
                      </Field>
                      </>}
                      <div className="flex min-w-0 items-center justify-between gap-3 sm:col-span-2">
                        <p id={`effort-${contributor.id}`} aria-live="polite" className="text-[13px]" style={{ color: result.error ? "var(--proto)" : "var(--ink-2)" }}>
                          {result.error || `${directEffort ? "" : `${result.businessDays} business days · `}${result.hours.toLocaleString()} hours`}
                        </p>
                        {index > 0 && (
                          <button type="button" className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border" style={{ borderColor: "var(--glass-edge)" }} title="Remove contributor" aria-label={`Remove contributor ${index + 1}`} onClick={() => set("contributors", draft.contributors.filter((entry, entryIndex) => entryIndex === 0 || entry.id !== contributor.id))}>
                            <Icon name="close" size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </fieldset>
                );
              })}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: "var(--glass-edge)" }} onClick={() => set("contributors", [...draft.contributors, {
                  id: crypto.randomUUID(), builtBy: { id: "", name: "", email: "" },
                  startDate: "", endDate: "", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID,
                }])}><Icon name="plus" size={14} />Add contributor</button>
                <p aria-live="polite" className="text-[14px] font-semibold">Total effort: {contributorsValid ? `${totalHours.toLocaleString()} hours` : "Incomplete"}</p>
              </div>
            </section>
          </StepShell>
        )}

        {step === 2 && safetyValid && (
          <StepShell
            title="What does it do, and why does it matter?"
            lede="The step CSMs depend on most. Write for the person who wasn't there."
          >
            <Field label="What it does" hint="Describe the main actions a user takes and the results they see.">
              <textarea className={`${inputCls} min-h-28 resize-y`} value={draft.whatItDoes} onChange={(e) => set("whatItDoes", e.target.value)} placeholder="e.g. Upload invoices, review suggested matches, and export unmatched items." maxLength={4000} />
            </Field>
            <Field label="Business value" hint="Explain the business problem and the benefit of solving it; include measured results only when known.">
              <textarea className={`${inputCls} min-h-28 resize-y`} value={draft.businessValue} onChange={(e) => set("businessValue", e.target.value)} placeholder="e.g. Reduces manual invoice matching so finance can focus on exceptions." maxLength={4000} />
            </Field>
            <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-3)" }}>
              <Icon name="sparkle" size={14} />
              In the real app an AI assist expands terse bullets into prose here.
            </p>
          </StepShell>
        )}

        {step === 3 && safetyValid && (
          <StepShell title="Tag it" lede="Tags are how a CSM finds this in eight months. Capabilities and industries are governed; technologies are open.">
            <TagPicker label="Capability (required, choose one)" governed options={optionsFrom("capabilities")} selected={draft.capabilities} onChange={(value) => set("capabilities", value.slice(-1))} />
            {!capabilityValid && <p className="text-[13px]" style={{ color: "var(--proto)" }}>Select exactly one capability before submitting.</p>}
            <TagPicker label="Technologies" options={optionsFrom("technologies")} selected={draft.technologies} onChange={(v) => set("technologies", v)} allowNew />
            <TagPicker label="Industries" governed options={optionsFrom("industries")} selected={draft.industries} onChange={(v) => set("industries", v)} />
          </StepShell>
        )}

        {step === 4 && safetyValid && (
          <StepShell
            title="Media"
            lede="At least one detail image is required. Add an optional thumbnail, video, one-pager or slide deck, or self-contained HTML demo."
          >
            <div className="border-l-2 pl-4 text-[14px]" style={{ borderColor: "var(--accent)", color: "var(--ink-2)" }}>
              <MediaGuidance capabilities={draft.capabilities} />
              <p className="mt-2">Remove confidential data and client identifiers from every attachment before uploading.</p>
            </div>
            <Field label="Card thumbnail" hint="The card grid's hero image — without one, the card gets a generated poster">
              {draft.thumbnail ? (
                <div className="flex items-center gap-4">
                  <img
                    src={draft.thumbnail}
                    alt="Thumbnail preview"
                    className="h-24 w-40 rounded-[12px] border object-cover"
                    style={{ borderColor: "var(--glass-edge)" }}
                  />
                  <button
                    type="button"
                    onClick={() => set("thumbnail", "")}
                    className="cursor-pointer rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
                    style={{ fontFamily: "var(--font-display)", borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <UploadZone
                  onBusyChange={imageBusyChanged}
                  onFiles={(srcs) => srcs[0] && set("thumbnail", srcs[0])}
                  line="Upload a screenshot for the card — it lands in the solution's Dataverse Image column."
                  sub="PNG or JPG · 16:10 reads best"
                />
              )}
            </Field>

            <Field
              label={`Detail screenshots · ${draft.images.length}/${MAX_GALLERY}`}
              required
              hint="At least one image showing the experience or outcome. A thumbnail alone does not meet this requirement."
            >
              <div className="flex flex-col gap-3">
                {draft.images.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {draft.images.map((img) => (
                      <div key={img.id} className="overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--glass-edge)" }}>
                        <img src={img.src} alt="" className="aspect-[16/10] w-full object-cover" />
                        <div className="flex items-center gap-2 p-2">
                          <input
                            className={`${inputCls} h-8 flex-1 rounded-lg px-2.5 py-0 text-[12.5px]`}
                            value={img.caption}
                            onChange={(e) =>
                              set(
                                "images",
                                draft.images.map((x) => (x.id === img.id ? { ...x, caption: e.target.value } : x)),
                              )
                            }
                            placeholder="e.g. Unmatched invoices awaiting review"
                            maxLength={200}
                            aria-label="Screenshot caption"
                            aria-describedby={`caption-hint-${img.id}`}
                          />
                          <button
                            type="button"
                            onClick={() => set("images", draft.images.filter((x) => x.id !== img.id))}
                            aria-label="Remove this screenshot"
                            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg"
                            style={{ color: "var(--ink-3)" }}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                        <p id={`caption-hint-${img.id}`} className="px-3 pb-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
                          Describe the screen or result shown.
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {draft.images.length < MAX_GALLERY && (
                  <UploadZone
                    multiple
                    onBusyChange={imageBusyChanged}
                    onFiles={(srcs) =>
                      setDraft((current) => ({ ...current, images: [
                        ...current.images,
                        ...srcs.slice(0, MAX_GALLERY - current.images.length).map((src) => ({
                          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          src,
                          caption: "",
                        })),
                      ] }))
                    }
                    line="Add detail screenshots — flows, dashboards, the moments worth narrating."
                    sub={`Up to ${MAX_GALLERY} · select several at once`}
                  />
                )}
              </div>
            </Field>
            <Field label="Additional media format">
              <SelectPicker label="Additional media format" value={draft.assetType} options={ASSET_OPTIONS} onChange={(value) => set("assetType", value)} />
            </Field>
            <Field label="Attach additional media" hint="Optional. MP4/WebM videos up to 500 MB each; HTML and PDF/PPT/PPTX documents up to 25 MB each. Up to 6 additional files. Local preview only.">
              <input type="file" disabled={uploading || draft.assets.length >= 6} accept={draft.assetType === "Self-contained HTML file" ? ".html,.htm" : draft.assetType === "Video walkthrough only" ? ".mp4,.webm" : ".pdf,.ppt,.pptx"}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const type = draft.assetType;
                  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
                  const allowed = type === "Self-contained HTML file" ? ["html", "htm"] : type === "Video walkthrough only" ? ["mp4", "webm"] : ["pdf", "ppt", "pptx"];
                  const maxSizeMb = type === "Video walkthrough only" ? 500 : 25;
                  if (!allowed.includes(extension) || !file.size || file.size > maxSizeMb * 1024 * 1024) { setUploadError(`Choose a supported, non-empty file of ${maxSizeMb} MB or less.`); return; }
                  setUploading(true);
                  setUploadError("");
                  try {
                    const asset: DemoAsset = { id: crypto.randomUUID(), name: file.name, assetType: type, allowsEmbedding: type !== "Client-ready one-pager / slide", sortOrder: draft.assets.length + 1 };
                    if (type === "Self-contained HTML file") asset.htmlContent = await file.text();
                    else asset.fileData = await readDataUrl(file);
                    setDraft((current) => ({ ...current, assets: [...current.assets, asset].slice(0, 6) }));
                  } catch { setUploadError("This file could not be read. Try another file."); }
                  finally { setUploading(false); }
                }} />
            </Field>
            {uploading && <p role="status">Reading attachment...</p>}
            {uploadError && <p role="alert">{uploadError}</p>}
            <ul className="space-y-4">
              {draft.assets.map((asset) => <li key={asset.id} className="flex min-w-0 items-center gap-3 border-b pb-3" style={{ borderColor: "var(--glass-edge)" }}>
                <Icon name="file" /><span className="min-w-0 flex-1 break-words">{asset.name}</span>
                <button type="button" title="Remove attachment" aria-label={`Remove ${asset.name}`} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center" onClick={() => set("assets", draft.assets.filter((entry) => entry.id !== asset.id))}><Icon name="close" /></button>
              </li>)}
            </ul>
          </StepShell>
        )}

        {step === 5 && safetyValid && (
          <StepShell title="Review & submit" lede="Exactly how the card will look on the shelf once the librarian approves it.">
            <div className="pointer-events-none mx-auto w-full max-w-[400px]">
              <SolutionCard solution={preview} present index={0} />
            </div>
            <dl className="grid gap-2 text-[14px] sm:grid-cols-2">
              <ReviewRow label="Attachments">{draft.assets.length} additional files</ReviewRow>
              <ReviewRow label="Built by">{draft.contributors.map((contributor) => contributor.builtBy.name).join(", ")}</ReviewRow>
              <ReviewRow label="Total effort">{totalHours.toLocaleString()} hours</ReviewRow>
              <ReviewRow label="Images">
                {draft.thumbnail ? "Thumbnail" : "Generated poster"} · {draft.images.length}{" "}
                {draft.images.length === 1 ? "screenshot" : "screenshots"}
              </ReviewRow>
              <ReviewRow label="Safety">{safetyValid ? "Acknowledged; review required" : "Not acknowledged"}</ReviewRow>
              <ReviewRow label="Client (internal)">{draft.clientContext || "No client"}</ReviewRow>
              <ReviewRow label="Public context">{draft.redacted || "None"}</ReviewRow>
              <ReviewRow label="Next state">Pending review (local)</ReviewRow>
            </dl>
            {(!basicsValid || !mediaValid || !capabilityValid) && <p role="alert">Complete Identity & effort, select one capability and add at least one detail image before submitting.</p>}
          </StepShell>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3" style={{ borderTop: "1px solid var(--glass-edge)", paddingTop: "1.25rem" }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="cursor-pointer rounded-xl border px-4 py-2.5 text-[14px] font-semibold" style={{ fontFamily: "var(--font-display)", borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}>
              Back
            </button>
          )}
          {onSaveDraft && <button type="button" disabled={saving || mediaBusy || !nameValid} onClick={() => void persist(true)} className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ borderColor: "var(--glass-edge)" }}><Icon name="file" />{saving ? "Saving..." : "Save draft & close"}</button>}
          <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] uppercase" style={{ color: "var(--ink-3)" }}>
            Step {step + 1} of {STEPS.length}
          </span>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!stepValid}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontFamily: "var(--font-display)", background: "var(--accent)", color: "var(--on-accent)" }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void persist(false)}
              disabled={saving || !basicsValid || !safetyValid || !mediaValid || !capabilityValid}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{ fontFamily: "var(--font-display)", background: "var(--live)", color: "var(--ground)" }}
            >
              {saving ? "Saving..." : "Submit for review"}
            </button>
          )}
        </div>
      </div>
      </fieldset>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border bg-transparent px-3.5 py-2.5 text-[15px] outline-none transition-colors duration-200 " +
  "border-(--glass-edge) text-(--ink) placeholder:text-(--ink-3) focus:border-(--accent)";

function StepShell({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[20px] font-semibold">{title}</h2>
      <p className="mt-1 text-[14px]" style={{ color: "var(--ink-3)" }}>
        {lede}
      </p>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block">
        <span className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          {label}
          {required && <span style={{ color: "var(--proto)" }}> *</span>}
        </span>
        {hint && (
          <span className="mt-1 block text-[12px]" style={{ color: "var(--ink-3)" }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function PersonPicker({ value, options, onChange }: {
  value: SolutionContributor["builtBy"];
  options: SolutionContributor["builtBy"][];
  onChange: (person: SolutionContributor["builtBy"]) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const terms = (query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = options.filter((person) => terms.every((term) => `${person.name} ${person.email}`.toLowerCase().includes(term)));
  const activePerson = matches[activeIndex];
  const close = () => {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  };
  const select = (person: SolutionContributor["builtBy"]) => {
    onChange(person);
    close();
  };

  return (
    <div className="relative min-w-0">
      <Field label="Person" required hint="Find a contributor by name or email and select their match.">
        <input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={open && activePerson ? `${id}-option-${activePerson.id}` : undefined}
          aria-required="true"
          autoComplete="off"
          className={inputCls}
          value={query ?? value.name}
          placeholder="e.g. Alex"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={close}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((current) => {
                if (!matches.length) return -1;
                if (!open || current < 0) return event.key === "ArrowDown" ? 0 : matches.length - 1;
                return (current + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
              });
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              if (activePerson) select(activePerson);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
        />
      </Field>
      {open && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border p-1 shadow-lg" style={{ background: "var(--ground)", borderColor: "var(--glass-edge)" }}>
          <ul id={`${id}-list`} role="listbox" aria-label="People" className="max-h-60 overflow-y-auto">
            {matches.map((person, index) => (
              <li
                key={person.id}
                id={`${id}-option-${person.id}`}
                role="option"
                aria-selected={person.id === value.id}
                ref={(element) => { if (index === activeIndex) element?.scrollIntoView({ block: "nearest" }); }}
                className="cursor-pointer rounded-md px-3 py-2 text-[14px] break-words hover:bg-(--glass-edge)"
                style={{ background: index === activeIndex ? "var(--glass-edge)" : undefined }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(person)}
              >
                <span className="block font-semibold">{person.name}</span>
                <span className="block text-[12px]" style={{ color: "var(--ink-3)" }}>{person.email}</span>
              </li>
            ))}
          </ul>
          {matches.length === 0 && <p role="status" className="px-3 py-2 text-[13px]" style={{ color: "var(--ink-3)" }}>No matching people</p>}
        </div>
      )}
    </div>
  );
}

function MediaGuidance({ capabilities }: { capabilities: string[] }) {
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

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.onabort = () => reject(new Error("File reading was cancelled."));
    reader.readAsDataURL(file);
  });
}

function TagPicker({
  label,
  options,
  selected,
  onChange,
  governed,
  allowNew,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  governed?: boolean;
  allowNew?: boolean;
}) {
  const [newTag, setNewTag] = useState("");
  const [query, setQuery] = useState("");
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const all = [...new Map([...options, ...selected].map((value) => [value.trim().toLowerCase(), value])).values()];
  const filtered = all.filter((value) => value.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[14px] font-semibold">{label}</legend>
      <p className="mb-2 text-[12px]" style={{ color: "var(--ink-2)" }}>{governed ? "Librarian-managed vocabulary" : "Tools, platforms and languages used to build the solution"}</p>
      <input type="search" className={inputCls} aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-3 flex max-h-60 flex-wrap gap-2 overflow-y-auto">
        {filtered.map((v) => (
          <Chip key={v} active={selected.includes(v)} onClick={() => toggle(v)}>
            {v}
          </Chip>
        ))}
        {!filtered.length && <p className="text-[13px]">No matching tags.</p>}
      </div>
      {query && <p className="mt-2 text-[12px]">Selected: {selected.join(", ") || "None"}</p>}
        {allowNew && (
          <div className="mt-3 flex w-64 max-w-full items-center gap-2">
            <input
              className="h-8 min-w-0 flex-1 rounded-full border border-(--glass-edge) bg-transparent px-3 py-1 text-[12.5px] font-medium text-(--ink) outline-none placeholder:text-(--ink-3) focus:border-(--accent)"
              style={{ background: "color-mix(in srgb, var(--ink) 6%, transparent)" }}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  e.preventDefault();
                  const value = all.find((entry) => entry.toLowerCase() === newTag.trim().toLowerCase()) ?? newTag.trim();
                  if (!selected.some((entry) => entry.toLowerCase() === value.toLowerCase())) onChange([...selected, value]);
                  setNewTag("");
                }
              }}
              placeholder="Add a new technology"
              aria-label="Add a new technology"
              maxLength={100}
            />
            <button type="button" title="Add new technology" aria-label="Add new technology" className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border border-(--glass-edge) disabled:cursor-not-allowed disabled:opacity-40" disabled={!newTag.trim()} onClick={() => {
              const value = all.find((entry) => entry.toLowerCase() === newTag.trim().toLowerCase()) ?? newTag.trim();
              if (value && !selected.some((entry) => entry.toLowerCase() === value.toLowerCase())) onChange([...selected, value]);
              setNewTag("");
            }}><Icon name="plus" /></button>
          </div>
        )}
    </fieldset>
  );
}

function UploadZone({
  onFiles,
  onBusyChange,
  line,
  sub,
  multiple,
}: {
  onFiles: (dataUrls: string[]) => void;
  onBusyChange: (busy: boolean) => void;
  line: string;
  sub: string;
  multiple?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <label
      className="grid cursor-pointer place-items-center rounded-[16px] border border-dashed px-6 py-8 text-center transition-colors duration-200 hover:border-(--accent)"
      style={{ borderColor: "var(--glass-edge-hi)", color: "var(--ink-3)" }}
    >
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        multiple={multiple}
        className="sr-only"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length === 0) return;
          if (files.length > MAX_GALLERY || files.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024)) {
            setError("Choose up to six PNG, JPG or WebP images, each non-empty and no larger than 5 MB.");
            return;
          }
          setBusy(true);
          onBusyChange(true);
          setError("");
          try {
            const sources = await Promise.all(files.map(async (file) => {
              const source = await readDataUrl(file);
              const image = new Image();
              image.src = source;
              await image.decode();
              return source;
            }));
            onFiles(sources);
          } catch { setError("An image could not be read. Choose a valid PNG, JPG or WebP file."); }
          finally { setBusy(false); onBusyChange(false); }
        }}
      />
      <Icon name="grid" size={20} />
      <p className="mt-2 text-[14px]">{line}</p>
      <p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] uppercase">{sub}</p>
      <p className="mt-1 text-[12px]">5 MB per image</p>
      {busy && <p role="status">Reading images...</p>}
      {error && <p role="alert">{error}</p>}
    </label>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "var(--glass-edge)" }}>
      <dt className="w-24 shrink-0 font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-3)" }}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1" style={{ color: "var(--ink)" }}>
        {children}
      </dd>
    </div>
  );
}
