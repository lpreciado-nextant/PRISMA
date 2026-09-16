import { useEffect, useMemo, useState } from "react";
import type {
  AssetType,
  SampleDataLevel,
  Shareability,
  Solution,
  SolutionStatus,
  SpecializationArea,
} from "../types";
import { AREA_ORDER, AREAS, SOLUTIONS } from "../data/solutions";
import { Chip } from "../components/Badges";
import { Icon } from "../components/Icon";
import { SolutionCard } from "../components/SolutionCard";
import { navigate } from "../lib/router";
import type { AppUser } from "../lib/powerContext";

/** Mirrors §3.1 of the end-to-end design: seven steps, draft saving throughout. */
const STEPS = [
  "What is it?",
  "What & why",
  "Tag it",
  "Attach the demo",
  "Images",
  "Safety & sharing",
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
  assetUrl: string;
  allowsEmbedding: boolean;
  thumbnail: string;
  images: { id: string; src: string; caption: string }[];
  shareable: Shareability;
  sampleData: SampleDataLevel;
  clientContext: string;
  redacted: string;
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
  assetUrl: "",
  allowsEmbedding: true,
  thumbnail: "",
  images: [],
  shareable: "Yes",
  sampleData: "Yes – all data is invented",
  clientContext: "",
  redacted: "",
};

const DRAFT_KEY = "nsl.draft";

const STATUS_OPTIONS: SolutionStatus[] = [
  "Idea / concept",
  "Working prototype",
  "Client demo",
  "Live in production",
];

const ASSET_OPTIONS: AssetType[] = [
  "Self-contained HTML file",
  "Hosted web app (URL)",
  "Power Apps",
  "Power BI",
  "Video walkthrough only",
  "Desktop app or script",
  "Client-ready one-pager / slide",
];

const SHARE_OPTIONS: { value: Shareability; hint: string }[] = [
  { value: "Yes", hint: "Safe to show any client as-is." },
  { value: "Yes, with names removed", hint: "Shareable once the client name is redacted." },
  { value: "No – internal only", hint: "Never appears in present mode." },
];

const SAMPLE_OPTIONS: SampleDataLevel[] = [
  "Yes – all data is invented",
  "Partly – some real figures",
  "No – contains real client data",
];

function optionsFrom(key: "capabilities" | "industries" | "technologies"): string[] {
  return [...new Set(SOLUTIONS.flatMap((s) => s[key]))].sort();
}

function loadDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) };
    // Drafts persisted before a schema change may miss array fields.
    parsed.images ??= [];
    parsed.capabilities ??= [];
    parsed.technologies ??= [];
    parsed.industries ??= [];
    return parsed;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function SubmitView({ user }: { user: AppUser }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Draft saving at every step — the design's contribution-friction requirement.
  // Image data URLs stay in memory only: they can blow the storage quota.
  useEffect(() => {
    const t = setTimeout(() => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, thumbnail: "", images: [] }));
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 400);
    return () => clearTimeout(t);
  }, [draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const needsRedaction = draft.shareable === "Yes, with names removed";

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return draft.name.trim().length > 0 && draft.summary.trim().length > 0;
      case 5:
        return !needsRedaction || draft.redacted.trim().length > 0;
      default:
        return true;
    }
  }, [step, draft, needsRedaction]);

  const preview: Solution = useMemo(
    () => ({
      id: "preview",
      name: draft.name || "Untitled solution",
      summary: draft.summary || "The one-line summary appears here.",
      whatItDoes: draft.whatItDoes,
      businessValue: draft.businessValue,
      specializationArea: draft.area,
      builtBy: { name: user.fullName, email: user.userPrincipalName },
      status: draft.status,
      publicationStatus: "Draft",
      shareable: draft.shareable,
      sampleDataLevel: draft.sampleData,
      clientContext: draft.clientContext || undefined,
      clientContextRedacted: draft.redacted || undefined,
      thumbnail: draft.thumbnail || undefined,
      images: draft.images.map(({ id, src, caption }) => ({ id, src, caption: caption || undefined })),
      effort: "Weeks",
      dateAdded: new Date().toISOString().slice(0, 10),
      searchKeywords: "",
      capabilities: draft.capabilities,
      technologies: draft.technologies,
      industries: draft.industries,
      assets: [],
    }),
    [draft, user],
  );

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
            The librarian has been notified. Nothing reaches a client's screen unreviewed — once
            approved, <b style={{ color: "var(--ink)" }}>{draft.name || "your solution"}</b> is
            published and your name is on the card.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => navigate("/")} className="cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold" style={{ fontFamily: "var(--font-display)", background: "var(--accent)", color: "var(--on-accent)" }}>
              Back to the library
            </button>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem(DRAFT_KEY);
                setDraft(EMPTY_DRAFT);
                setStep(0);
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
        <h1 className="mt-2 text-[clamp(1.7rem,3.2vw,2.3rem)] font-bold" style={{ letterSpacing: "-0.03em" }}>
          Put your work on the shelf
        </h1>
        <p className="mt-2 max-w-[58ch] text-[15.5px]" style={{ color: "var(--ink-2)" }}>
          Seven short steps, under ten minutes. Your draft saves as you type
          {savedAt && (
            <span className="font-mono text-[11px]" style={{ color: "var(--ink-3)" }}>
              {" "}
              · saved {savedAt}
            </span>
          )}
        </p>
      </div>

      <ol className="mt-6 flex flex-wrap gap-2" aria-label="Submission steps">
        {STEPS.map((label, i) => {
          const state = i === step ? "current" : i < step ? "done" : "todo";
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
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
          <StepShell title="What is it?" lede="The card's first impression — name it like a product, not a project code.">
            <Field label="Solution name" required>
              <input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ledger Reconciler" maxLength={100} />
            </Field>
            <Field label="One-line summary" required hint={`${draft.summary.length}/200 — the sentence a CSM reads while triaging`}>
              <input className={inputCls} value={draft.summary} onChange={(e) => set("summary", e.target.value)} placeholder="What does it prove, in one sentence?" maxLength={200} />
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
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            title="What does it do, and why does it matter?"
            lede="The step CSMs depend on most. Write for the person who wasn't there."
          >
            <Field label="What it does" hint="Concrete behaviour, not architecture — what happens on screen?">
              <textarea className={`${inputCls} min-h-28 resize-y`} value={draft.whatItDoes} onChange={(e) => set("whatItDoes", e.target.value)} placeholder="Two personas share one dataset. Every edit is audited against…" maxLength={4000} />
            </Field>
            <Field label="Business value" hint="The client problem it solves, in the client's words">
              <textarea className={`${inputCls} min-h-28 resize-y`} value={draft.businessValue} onChange={(e) => set("businessValue", e.target.value)} placeholder="A cycle that ran on email and 47 workbooks runs in one place…" maxLength={4000} />
            </Field>
            <p className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-3)" }}>
              <Icon name="sparkle" size={14} />
              In the real app an AI assist expands terse bullets into prose here.
            </p>
          </StepShell>
        )}

        {step === 2 && (
          <StepShell title="Tag it" lede="Tags are how a CSM finds this in eight months. Capabilities and industries are governed; technologies are open.">
            <TagPicker label="Capabilities" governed options={optionsFrom("capabilities")} selected={draft.capabilities} onChange={(v) => set("capabilities", v)} />
            <TagPicker label="Technologies" options={optionsFrom("technologies")} selected={draft.technologies} onChange={(v) => set("technologies", v)} allowNew />
            <TagPicker label="Industries" governed options={optionsFrom("industries")} selected={draft.industries} onChange={(v) => set("industries", v)} />
          </StepShell>
        )}

        {step === 3 && (
          <StepShell title="Attach the demo" lede="Every solution needs at least one asset a CSM can show with no setup.">
            <Field label="Asset type">
              <div className="flex flex-wrap gap-2">
                {ASSET_OPTIONS.map((t) => (
                  <Chip key={t} active={draft.assetType === t} onClick={() => set("assetType", t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </Field>
            {draft.assetType === "Self-contained HTML file" || draft.assetType === "Video walkthrough only" || draft.assetType === "Client-ready one-pager / slide" ? (
              <div
                className="grid place-items-center rounded-[16px] border border-dashed px-6 py-10 text-center"
                style={{ borderColor: "var(--glass-edge-hi)", color: "var(--ink-3)" }}
              >
                <Icon name="download" size={22} />
                <p className="mt-2 text-[14px]">
                  Drop the file here — it lives in a Dataverse File column, no external storage.
                </p>
                <p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] uppercase">Mock — upload disabled in the PoC</p>
              </div>
            ) : (
              <>
                <Field label="URL" hint="Power Apps and Power BI links open in a new tab — embedding auth-stalls in frames">
                  <input className={inputCls} value={draft.assetUrl} onChange={(e) => set("assetUrl", e.target.value)} placeholder="https://…" type="url" maxLength={500} />
                </Field>
                {draft.assetType === "Hosted web app (URL)" && (
                  <Field label="Embedding">
                    <div className="flex flex-wrap gap-2">
                      <Chip active={draft.allowsEmbedding} onClick={() => set("allowsEmbedding", true)}>Embeds in the viewer</Chip>
                      <Chip active={!draft.allowsEmbedding} onClick={() => set("allowsEmbedding", false)}>Refuses frames — pop out</Chip>
                    </div>
                  </Field>
                )}
              </>
            )}
          </StepShell>
        )}

        {step === 4 && (
          <StepShell
            title="Images"
            lede="One thumbnail for the card, and as many screenshots as the story needs on the detail page. All optional."
          >
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
                  onFiles={(srcs) => srcs[0] && set("thumbnail", srcs[0])}
                  line="Upload a screenshot for the card — it lands in the solution's Dataverse Image column."
                  sub="PNG or JPG · 16:10 reads best"
                />
              )}
            </Field>

            <Field
              label={`Detail screenshots · ${draft.images.length}/${MAX_GALLERY}`}
              hint="Shown as a gallery on the detail page — each is a row in the images table"
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
                            placeholder="Caption — what is the CSM looking at?"
                            maxLength={200}
                            aria-label="Screenshot caption"
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
                      </div>
                    ))}
                  </div>
                )}
                {draft.images.length < MAX_GALLERY && (
                  <UploadZone
                    multiple
                    onFiles={(srcs) =>
                      set("images", [
                        ...draft.images,
                        ...srcs.slice(0, MAX_GALLERY - draft.images.length).map((src) => ({
                          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          src,
                          caption: "",
                        })),
                      ])
                    }
                    line="Add detail screenshots — flows, dashboards, the moments worth narrating."
                    sub={`Up to ${MAX_GALLERY} · select several at once`}
                  />
                )}
              </div>
            </Field>
          </StepShell>
        )}

        {step === 5 && (
          <StepShell
            title="Safety & sharing"
            lede="The highest-consequence answers in the form — they decide what a client can ever see."
          >
            <Field label="Shareable with clients" required>
              <div className="flex flex-col gap-2">
                {SHARE_OPTIONS.map(({ value, hint }) => (
                  <RadioRow key={value} label={value} hint={hint} checked={draft.shareable === value} onSelect={() => set("shareable", value)} />
                ))}
              </div>
            </Field>
            <Field label="Sample data level" required>
              <div className="flex flex-col gap-2">
                {SAMPLE_OPTIONS.map((value) => (
                  <RadioRow key={value} label={value} checked={draft.sampleData === value} onSelect={() => set("sampleData", value)} />
                ))}
              </div>
            </Field>
            <Field label="Client / context" hint="Internal only — never rendered in present mode">
              <input className={inputCls} value={draft.clientContext} onChange={(e) => set("clientContext", e.target.value)} placeholder="e.g. Fabrikam Logistics, FY26 pilot" maxLength={200} />
            </Field>
            {needsRedaction && (
              <Field label="Client context (redacted)" required hint="The client-safe substitute shown in present mode">
                <input className={inputCls} value={draft.redacted} onChange={(e) => set("redacted", e.target.value)} placeholder="e.g. a national logistics provider" maxLength={200} />
              </Field>
            )}
          </StepShell>
        )}

        {step === 6 && (
          <StepShell title="Review & submit" lede="Exactly how the card will look on the shelf once the librarian approves it.">
            <div className="pointer-events-none mx-auto w-full max-w-[400px]">
              <SolutionCard solution={preview} present={false} index={0} />
            </div>
            <dl className="grid gap-2 text-[14px] sm:grid-cols-2">
              <ReviewRow label="Asset">{draft.assetType}</ReviewRow>
              <ReviewRow label="Images">
                {draft.thumbnail ? "Thumbnail" : "Generated poster"} · {draft.images.length}{" "}
                {draft.images.length === 1 ? "screenshot" : "screenshots"}
              </ReviewRow>
              <ReviewRow label="Shareable">{draft.shareable}</ReviewRow>
              <ReviewRow label="Sample data">{draft.sampleData}</ReviewRow>
              <ReviewRow label="Goes to">Librarian review queue</ReviewRow>
            </dl>
          </StepShell>
        )}

        <div className="mt-8 flex items-center gap-3" style={{ borderTop: "1px solid var(--glass-edge)", paddingTop: "1.25rem" }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="cursor-pointer rounded-xl border px-4 py-2.5 text-[14px] font-semibold" style={{ fontFamily: "var(--font-display)", borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}>
              Back
            </button>
          )}
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
              onClick={() => setSubmitted(true)}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold"
              style={{ fontFamily: "var(--font-display)", background: "var(--live)", color: "var(--ground)" }}
            >
              Submit for review
            </button>
          )}
        </div>
      </div>
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
      <span className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          {label}
          {required && <span style={{ color: "var(--proto)" }}> *</span>}
        </span>
        {hint && (
          <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function RadioRow({ label, hint, checked, onSelect }: { label: string; hint?: string; checked: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-200"
      style={{
        borderColor: checked ? "var(--accent)" : "var(--glass-edge)",
        background: checked ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
      }}
    >
      <span
        className="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
        style={{ borderColor: checked ? "var(--accent)" : "var(--glass-edge-hi)" }}
      >
        {checked && <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />}
      </span>
      <span>
        <span className="block text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        {hint && (
          <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
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
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const all = [...new Set([...options, ...selected])];

  return (
    <Field label={label} hint={governed ? "Governed — librarian-managed vocabulary" : "Open — add what's missing"}>
      <div className="flex flex-wrap gap-2">
        {all.map((v) => (
          <Chip key={v} active={selected.includes(v)} onClick={() => toggle(v)}>
            {v}
          </Chip>
        ))}
        {allowNew && (
          <span className="inline-flex items-center gap-1">
            <input
              className={`${inputCls} h-8 w-40 rounded-full px-3 py-0 text-[12.5px]`}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTag.trim()) {
                  onChange([...selected, newTag.trim()]);
                  setNewTag("");
                }
              }}
              placeholder="Add a technology…"
              aria-label={`Add a new ${label.toLowerCase()} tag`}
            />
          </span>
        )}
      </div>
    </Field>
  );
}

function UploadZone({
  onFiles,
  line,
  sub,
  multiple,
}: {
  onFiles: (dataUrls: string[]) => void;
  line: string;
  sub: string;
  multiple?: boolean;
}) {
  return (
    <label
      className="grid cursor-pointer place-items-center rounded-[16px] border border-dashed px-6 py-8 text-center transition-colors duration-200 hover:border-(--accent)"
      style={{ borderColor: "var(--glass-edge-hi)", color: "var(--ink-3)" }}
    >
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length === 0) return;
          Promise.all(
            files.map(
              (file) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.readAsDataURL(file);
                }),
            ),
          ).then(onFiles);
          e.target.value = "";
        }}
      />
      <Icon name="grid" size={20} />
      <p className="mt-2 text-[14px]">{line}</p>
      <p className="mt-1 font-mono text-[10.5px] tracking-[0.1em] uppercase">{sub}</p>
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
