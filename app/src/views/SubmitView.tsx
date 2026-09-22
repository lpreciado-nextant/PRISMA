import { useEffect, useMemo, useState } from "react";
import type {
  AssetType,
  DemoAsset,
  Solution,
  SolutionContributor,
  SolutionStatus,
  SpecializationArea,
} from "../types";
import { AREA_ORDER, AREAS, BUILDERS, BUSINESS_CALENDARS, DEFAULT_BUSINESS_CALENDAR_ID, SOLUTIONS } from "../data/solutions";
import { Icon } from "../components/Icon";
import { TagPicker } from "../components/TagPicker";
import { SolutionCard } from "../components/SolutionCard";
import { navigate } from "../lib/router";
import type { AppUser } from "../lib/powerContext";
import { calculateEffort, usesDirectHours } from "../lib/effort";
import { assertSubmissionReady, UNTITLED_SOLUTION } from "../lib/submissions";
import { SubmissionSteps, SubmissionFooter, SubmissionSuccess, SubmissionSafety, IdentityFields, StoryFields, SubmissionReview, SubmissionMedia, ImageUploadZone, ContributorEditor, ContributorRow, StepShell, PersonPicker } from "../components/SubmissionForm";

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
  const [preparingVideo, setPreparingVideo] = useState(false);
  const mediaBusy = uploading || preparingVideo || imageUploads > 0;
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
    return <SubmissionSuccess name={draft.name} onSubmissions={() => navigate("/my-submissions")} onAnother={() => {
      if (initialSolution) { navigate("/submit"); return; }
      setDraft({ ...EMPTY_DRAFT, contributors: [{ id: crypto.randomUUID(), builtBy: { id: user.userPrincipalName, name: user.fullName, email: user.userPrincipalName }, startDate: "", endDate: "", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID }] });
      setStep(0); setSubmissionId(crypto.randomUUID()); setSubmitted(false);
    }}>is pending review in this local preview. No notification was sent and nothing was published. {onSaveDraft ? "Submissions and media are saved in this browser." : "This walkthrough does not save submissions."}</SubmissionSuccess>;
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
      <SubmissionSteps step={step} onStep={next => { if (next === 0 || safetyValid) setStep(next); }} />

      <div key={step} className="glass glass-lite glass-sheen animate-rise mt-5 rounded-[24px] p-6 sm:p-8">
        {step === 0 && <SubmissionSafety accepted={draft.safetyAcknowledged} onChange={value => set("safetyAcknowledged", value)} />}

        {step > 0 && !safetyValid && <p role="alert">Accept the safety requirements in Before you start to continue.</p>}

        {step === 1 && safetyValid && (
          <StepShell title="What is it?" lede="The card's first impression — name it like a product, not a project code.">
            <IdentityFields value={draft} onText={set} area={draft.area} areas={AREA_ORDER.map(value => ({ value, label: AREAS[value].name }))} onArea={value => set("area", value)} status={draft.status} statuses={STATUS_OPTIONS.map(value => ({ value, label: value }))} onStatus={value => set("status", value)} />
            <ContributorEditor direct={directEffort} total={contributorsValid ? totalHours : null} onAdd={() => set("contributors", [...draft.contributors, {
              id: crypto.randomUUID(), builtBy: { id: "", name: "", email: "" }, startDate: "", endDate: "", allocation: 100, calendarId: DEFAULT_BUSINESS_CALENDAR_ID,
            }])}>
              {draft.contributors.map((contributor, index) => {
                const calendar = BUSINESS_CALENDARS.find((entry) => entry.id === contributor.calendarId);
                const result = contributionResults[index];
                return <ContributorRow key={contributor.id} index={index} direct={directEffort} result={result} minDate={calendar?.startDate} maxDate={calendar?.endDate}
                  value={{ directHours: contributor.directHours ?? null, allocation: Number.isFinite(contributor.allocation) ? contributor.allocation : null, startDate: contributor.startDate, endDate: contributor.endDate }}
                  onChange={fields => updateContributor(contributor.id, { ...fields, directHours: fields.directHours === null ? undefined : fields.directHours ?? contributor.directHours, allocation: fields.allocation === null ? NaN : fields.allocation ?? contributor.allocation })}
                  onRemove={index > 0 ? () => set("contributors", draft.contributors.filter(entry => entry.id !== contributor.id)) : undefined}
                  person={<PersonPicker value={contributor.builtBy} options={builders.filter(builder => !draft.contributors.some(entry => entry.id !== contributor.id && entry.builtBy.id === builder.id))} onChange={builtBy => updateContributor(contributor.id, { builtBy })} />} />;
              })}
            </ContributorEditor>
          </StepShell>
        )}

        {step === 2 && safetyValid && (
          <StoryFields whatItDoes={draft.whatItDoes} businessValue={draft.businessValue} onChange={set}>
            <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-3)" }}>
              <Icon name="sparkle" size={14} />
              In the real app an AI assist expands terse bullets into prose here.
            </p>
          </StoryFields>
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
          <SubmissionMedia capabilities={draft.capabilities} local disabled={mediaBusy} onPreparationBusy={setPreparingVideo}
            onReorderImages={ids => set("images", ids.map(id => draft.images.find(image => image.id === id)!))}
            onReorderAttachments={ids => set("assets", ids.map((id, sortOrder) => ({ ...draft.assets.find(asset => asset.id === id)!, sortOrder })))}
            thumbnail={draft.thumbnail ? <img src={draft.thumbnail} alt="Thumbnail preview" className="h-full w-full object-cover" /> : undefined} onRemoveThumbnail={() => set("thumbnail", "")}
            thumbnailUpload={<UploadZone onBusyChange={imageBusyChanged} onFiles={sources => sources[0] && set("thumbnail", sources[0])} line="Upload a screenshot for the card." sub="PNG, JPG or WebP · 16:10 reads best" />}
            images={draft.images.map(image => ({ id: image.id, caption: image.caption, preview: <img src={image.src} alt="" className="h-full w-full object-cover" /> }))}
            onCaption={(id, caption) => set("images", draft.images.map(image => image.id === id ? { ...image, caption } : image))} onRemoveImage={id => set("images", draft.images.filter(image => image.id !== id))}
            imageUpload={<UploadZone multiple onBusyChange={imageBusyChanged} onFiles={sources => setDraft(current => ({ ...current, images: [...current.images, ...sources.slice(0, MAX_GALLERY - current.images.length).map(src => ({ id: crypto.randomUUID(), src, caption: "" }))] }))} line="Add detail screenshots — flows, dashboards, the moments worth narrating." sub="Up to 6 · select several at once" />}
            format={draft.assetType} onFormat={value => set("assetType", value)} attachments={draft.assets} onRemoveAttachment={id => set("assets", draft.assets.filter(asset => asset.id !== id))}
            onAttachment={async file => {
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
            }}>
            {uploading && <p role="status">Reading attachment...</p>}
            {uploadError && <p role="alert">{uploadError}</p>}
          </SubmissionMedia>
        )}

        {step === 5 && safetyValid && (
          <SubmissionReview card={<SolutionCard solution={preview} present index={0} />} attachments={draft.assets.length} contributors={draft.contributors.map(contributor => contributor.builtBy.name).join(", ")} hours={totalHours}
            images={`${draft.thumbnail ? "Thumbnail" : "Generated poster"} · ${draft.images.length} ${draft.images.length === 1 ? "screenshot" : "screenshots"}`} safety={safetyValid ? "Acknowledged; review required" : "Not acknowledged"} client={draft.clientContext} context={draft.redacted} nextState="Pending review (local)">
            {(!basicsValid || !mediaValid || !capabilityValid) && <p role="alert">Complete Identity & effort, select one capability and add at least one detail image before submitting.</p>}
          </SubmissionReview>
        )}

        <SubmissionFooter step={step} busy={saving || mediaBusy} canSave={nameValid} canContinue={stepValid} canSubmit={basicsValid && safetyValid && mediaValid && capabilityValid}
          onBack={() => setStep(current => current - 1)} onSave={onSaveDraft ? () => void persist(true) : undefined} onContinue={() => setStep(current => current + 1)} onSubmit={() => void persist(false)} />
      </div>
      </fieldset>
    </div>
  );
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
  return <ImageUploadZone line={line} sub={sub} multiple={multiple} disabled={busy}
        onFiles={async files => {
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
        }}>
      {busy && <p role="status">Reading images...</p>}
      {error && <p role="alert">{error}</p>}
    </ImageUploadZone>;
}

