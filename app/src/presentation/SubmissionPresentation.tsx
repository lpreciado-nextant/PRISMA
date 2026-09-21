import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Background } from "../components/Background";
import { Icon } from "../components/Icon";
import { BUILDERS, DEFAULT_BUSINESS_CALENDAR_ID, SOLUTIONS } from "../data/solutions";
import { SubmitView } from "../views/SubmitView";
import prismaMark from "../../public/prisma-mark-v2.svg?raw";
import "../index.css";
import "./submission.css";

const DRAFT_KEY = "prisma.presentation.submission.v1";
const example = SOLUTIONS[0];
const user = { fullName: BUILDERS[2].name, userPrincipalName: BUILDERS[2].email, live: false };

const chapters = [
  {
    label: "Identity & effort", title: "Give the work a name. Give its builders credit.",
    summary: "The first step turns a project into a recognizable solution, with a clear owner and a consistent measure of contribution.",
    points: [
      ["A card, not a project code", "The name, one-line summary, specialization and maturity become the first impression in the library."],
      ["Credit every contributor", "Search people by name or email. Each person has their own dates and allocation; duplicate contributors are excluded."],
      ["Effort without guesswork", "Inclusive US business days, excluding federal holidays, multiplied by 8 hours and allocation. The sample totals 218 hours."],
    ],
    tryIt: "Change an allocation and watch the total recalculate. Clear the name to see Continue become unavailable.",
    boundary: "People are a mock list, not a live directory. Calendar coverage is 2026; effort is estimated capacity, not timesheet actuals.",
    output: "Solution identity + contributor rows",
  },
  {
    label: "What & why", title: "Make the story travel without its builder.",
    summary: "A CSM needs to explain the solution confidently, even when they were not part of the project.",
    points: [
      ["What it does", "Describe the actions a user takes and the result they see. Keep the language concrete."],
      ["Why it matters", "Connect the experience to a business problem. Include measurable outcomes only when they are known."],
      ["Ready for a conversation", "These descriptions supply the solution detail page and searchable catalogue text."],
    ],
    tryIt: "Rewrite the business value in one sentence. Your edits remain when you move between chapters.",
    boundary: "AI-assisted writing is a future capability. The PoC shows the intended hint but does not call an AI service.",
    output: "Solution description + business value",
  },
  {
    label: "Discoverability", title: "A useful solution has to be findable.",
    summary: "Tags connect the builder's language to the questions a CSM will ask months later.",
    points: [
      ["Capabilities", "Describe what the solution can do, so a search starts with a customer need rather than a product name."],
      ["Technologies", "Identify the implementation stack. An open vocabulary accommodates new tools."],
      ["Industries", "Add the business contexts where this work is relevant. Capabilities and industries are governed vocabularies."],
    ],
    tryIt: "Toggle a capability, then add a technology. The same tags appear on the review card.",
    boundary: "Options come from the bundled mock catalogue. Proposing a governed tag does not send a request to a librarian.",
    output: "Capability, technology + industry relationships",
  },
  {
    label: "Demo assets", title: "Give the CSM something they can actually show.",
    summary: "The submission captures the kind of demo and how it should open, keeping the client presentation path predictable.",
    points: [
      ["Choose the format", "HTML, hosted apps, Power Apps, Power BI, video, desktop tools and one-pagers have different delivery needs."],
      ["Choose the experience", "Hosted apps can embed or pop out. Power Apps and Power BI links open separately. HTML belongs in the sandboxed viewer."],
      ["Keep the handoff practical", "The intended submission includes a ready-to-show asset, not just a description of something that exists."],
    ],
    tryIt: "Select Hosted web app (URL) to reveal the URL and embedding controls, then switch back to HTML.",
    boundary: "File attachment is disabled. URLs are draft inputs only; this PoC does not upload assets or require an asset before advancing.",
    output: "Demo asset type + delivery settings",
  },
  {
    label: "Images", title: "Let the work speak before the demo starts.",
    summary: "A thumbnail helps people scan the shelf; screenshots make the detail page useful before anyone opens the demo.",
    points: [
      ["The shelf image", "One optional thumbnail appears on the solution card. Without it, PRISMA generates a poster."],
      ["The visual story", "Add up to six detail screenshots and caption each meaningful screen or result."],
      ["Schema-shaped assets", "The intended model stores the thumbnail on the solution and gallery items as related image rows."],
    ],
    tryIt: "Choose a local PNG or JPG. Caption a screenshot, remove it, or inspect the thumbnail on the review card.",
    boundary: "Image previews work locally. Image payloads stay in memory and are not restored after a reload or written to Dataverse.",
    output: "Card thumbnail + up to six gallery images",
  },
  {
    label: "Safety & sharing", title: "Decide what can reach a client's screen.",
    summary: "Sharing permission and sample-data classification are explicit decisions, not details left for the presenter to infer.",
    points: [
      ["Permission is deliberate", "Share as-is, share with names removed, or keep internal. Internal-only solutions are excluded from the present-mode catalogue."],
      ["Redaction is authored", "Sharing with names removed requires a separate client-safe context. PRISMA does not scrub names from the original text at runtime."],
      ["Data needs its own answer", "Invented, mixed and real client data are classified separately from permission to share."],
    ],
    tryIt: "Choose Yes, with names removed and clear the redacted context. Continue stays disabled until you provide one.",
    boundary: "This records local draft choices only. The PoC's client-side filtering is not a security boundary; production requires server-side access controls.",
    output: "Sharing policy + sample-data classification",
  },
  {
    label: "Review & submit", title: "Preview the shelf. Then hand off for review.",
    summary: "The builder sees the actual library card before submitting, with the key decisions summarized alongside it.",
    points: [
      ["The real card component", "This is the same SolutionCard used in the library, populated by the values entered in this form."],
      ["One last check", "Review contributors, effort, demo type, images, sharing and sample data before the handoff."],
      ["Submission is not publication", "The intended workflow moves to librarian review. Approval, not the submit button, makes the solution available on the shelf."],
    ],
    tryIt: "Submit for review to reach the handoff explanation. Use the chapter list to revisit any part of the story.",
    boundary: "Submission only changes the local screen. No record, notification or librarian queue entry is created, and the live catalogue is unchanged.",
    output: "Intended next state: Pending review",
  },
];

function seedDraft() {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
    name: example.name, summary: example.summary, area: example.specializationArea,
    status: example.status, whatItDoes: example.whatItDoes, businessValue: example.businessValue,
    capabilities: example.capabilities, technologies: example.technologies, industries: example.industries,
    assetType: "Self-contained HTML file", assetUrl: "", allowsEmbedding: true,
    thumbnail: "", images: [], shareable: example.shareable, sampleData: example.sampleDataLevel,
    clientContext: example.clientContext, redacted: example.clientContextRedacted,
    contributors: example.contributors.map((contributor) => ({ ...contributor, calendarId: DEFAULT_BUSINESS_CALENDAR_ID })),
  }));
}

if (!sessionStorage.getItem(DRAFT_KEY)) seedDraft();

export function SubmissionPresentation() {
  const [step, setStep] = useState(0);
  const [revision, setRevision] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [theme, setTheme] = useState("light");
  const [reset, setReset] = useState<"sample" | "blank" | null>(null);
  const chapter = chapters[step];

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const goTo = (next: number) => {
    setSubmitted(false);
    setStep(Math.max(0, Math.min(chapters.length - 1, next)));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || reset) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, button, a, [contenteditable='true'], [role='combobox']")) return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      setSubmitted(false);
      setStep((current) => Math.max(0, Math.min(6, current + (event.key === "ArrowRight" ? 1 : -1))));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reset]);

  const restart = () => {
    if (reset === "sample") seedDraft();
    else sessionStorage.removeItem(DRAFT_KEY);
    setRevision((current) => current + 1);
    setStep(0);
    setSubmitted(false);
    setReset(null);
  };

  return (
    <>
      <Background />
      <a className="presentation-skip" href="#submission-stage">Skip to submission</a>
      <header className="presentation-header">
        <a className="presentation-brand" href="./index.html" aria-label="PRISMA design presentation">
          <img src={`data:image/svg+xml,${encodeURIComponent(prismaMark)}`} alt="" width="42" height="42" />
          <span>PRISMA<span className="presentation-brand-note">NEXTANT / SOLUTION LIBRARY</span></span>
        </a>
        <span className="presentation-series">THE SUBMISSION FLOW</span>
        <div className="presentation-tools">
          <button className="presentation-command" onClick={() => setReset("sample")}><Icon name="play" />Load example</button>
          <button className="presentation-command" onClick={() => setReset("blank")}><Icon name="plus" />Start blank</button>
          <button className="presentation-icon" title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}><Icon name={theme === "light" ? "moon" : "sun"} size={19} /></button>
        </div>
      </header>

      <div className="presentation-heading">
        <div><p className="eyebrow">From a builder's work to a client-ready story</p><h1>The submission flow</h1></div>
        <p className="presentation-source"><span />Live PoC components<span className="presentation-source-detail">Interactive walkthrough / mock data only</span></p>
      </div>

      <nav className="presentation-chapters" aria-label="Presentation chapters">
        {chapters.map((entry, index) => (
          <button key={entry.label} onClick={() => goTo(index)} aria-current={step === index ? "step" : undefined}>
            <span className="presentation-chapter-number">{String(index + 1).padStart(2, "0")}</span>
            <span>{entry.label}</span>
          </button>
        ))}
      </nav>

      <main className="presentation-layout">
        <aside className="presentation-notes" aria-label="Stage explanation">
          <div className="presentation-notes-content" key={submitted ? "submitted" : step}>
            <p className="eyebrow">{submitted ? "The handoff" : `Chapter ${String(step + 1).padStart(2, "0")} / 07`}</p>
            <h2>{submitted ? "The builder is done. Curation comes next." : chapter.title}</h2>
            <p className="presentation-summary">{submitted ? "The intended next step belongs to the librarian: verify the story, assets and sharing choices before publication." : chapter.summary}</p>
            <dl className="presentation-points">
              {(submitted ? [
                ["Review", "The librarian checks completeness, classifications, demo readiness and client-safe context."],
                ["Approve or return", "Approved work is published. Work needing changes goes back to the contributor."],
                ["Discover and present", "Once approved, CSMs can find the solution and show only content permitted in present mode."],
              ] : chapter.points).map(([title, detail], index) => (
                <div key={title}><span className="presentation-point-number">{index + 1}</span><div><dt>{title}</dt><dd>{detail}</dd></div></div>
              ))}
            </dl>
            {!submitted && <div className="presentation-try"><Icon name="sliders" size={18} /><div><h3>Try it live</h3><p>{chapter.tryIt}</p></div></div>}
            <div className="presentation-boundary"><p className="eyebrow">PoC boundary</p><p>{submitted ? "This was a simulation. No data was sent, no librarian was notified and nothing was published." : chapter.boundary}</p></div>
            <div className="presentation-output"><Icon name="arrowRight" /><span>{submitted ? "Planned workflow, not a live review queue" : chapter.output}</span></div>
          </div>
          <div className="presentation-paging">
            <button className="presentation-icon" aria-label="Previous chapter" title="Previous chapter" disabled={step === 0} onClick={() => goTo(step - 1)}><Icon name="chevronLeft" size={20} /></button>
            <span>{String(step + 1).padStart(2, "0")} / 07</span>
            <button className="presentation-icon" aria-label="Next chapter" title="Next chapter" disabled={step === 6} onClick={() => goTo(step + 1)}><Icon name="arrowRight" size={20} /></button>
          </div>
        </aside>

        <section className="presentation-demo" aria-label="Interactive PoC submission">
          <div className="presentation-demo-label"><span><Icon name="present" />{submitted ? "SUBMISSION HANDOFF" : "THE REAL SUBMISSION FORM"}</span><span>{submitted ? "SIMULATED" : "EDITABLE"}</span></div>
          <div id="submission-stage" className="submission-stage" tabIndex={-1}>
            {submitted ? (
              <section className="presentation-handoff" aria-labelledby="handoff-title">
                <span className="presentation-handoff-icon"><Icon name="check" size={32} /></span>
                <p className="eyebrow">Simulation complete</p>
                <h2 id="handoff-title">Ready for the librarian</h2>
                <p>In the production workflow, this is where your solution would become <strong>Pending review</strong>.</p>
                <ol className="presentation-review-flow">
                  <li><Icon name="check" /><div><strong>Contributor submits</strong><span>Story, people, effort, assets and sharing</span></div></li>
                  <li><Icon name="shield" /><div><strong>Librarian reviews</strong><span>Checks quality and client readiness</span></div></li>
                  <li><Icon name="grid" /><div><strong>Approved work reaches the shelf</strong><span>CSMs discover, open and present</span></div></li>
                </ol>
                <p className="presentation-simulation">No notification was sent. The catalogue has not changed.</p>
                <button className="presentation-command" onClick={() => setReset("sample")}><Icon name="play" />Restart the walkthrough</button>
              </section>
            ) : <SubmitView key={revision} user={user} draftKey={DRAFT_KEY} activeStep={step} onStepChange={goTo} onSubmitted={() => setSubmitted(true)} />}
          </div>
        </section>
      </main>
      <footer className="presentation-footer"><span>PRISMA / BUILT TO BE SHARED, CURATED TO BE TRUSTED</span><span>Local draft only. No Dataverse connection.</span></footer>
      {reset && <ResetDialog kind={reset} onCancel={() => setReset(null)} onConfirm={restart} />}
    </>
  );
}

export function ResetDialog({ kind, onCancel, onConfirm }: { kind: "sample" | "blank"; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const dialog = document.querySelector<HTMLDialogElement>("#reset-dialog")!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog id="reset-dialog" className="presentation-dialog" aria-labelledby="reset-title" onCancel={onCancel}>
    <h2 id="reset-title">{kind === "sample" ? "Load the BSO Quota example?" : "Start a blank submission?"}</h2>
    <p>This replaces the presentation draft, including local images. Your separate PoC draft is not affected.</p>
    <div><button className="presentation-command" autoFocus onClick={onCancel}>Cancel</button><button className="presentation-command presentation-primary" onClick={onConfirm}>{kind === "sample" ? "Load example" : "Start blank"}</button></div>
  </dialog>;
}

createRoot(document.getElementById("root")!).render(<SubmissionPresentation />);