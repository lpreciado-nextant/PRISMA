import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Background } from "../components/Background";
import { Icon } from "../components/Icon";
import { BUILDERS, DEFAULT_BUSINESS_CALENDAR_ID, SOLUTIONS } from "../data/solutions";
import { SubmitView } from "../views/SubmitView";
import prismaMark from "../../public/prisma-mark-v2.svg?raw";
import "../index.css";
import "./submission.css";

const DRAFT_KEY = "prisma.presentation.submission.v2";
const example = SOLUTIONS[0];
const user = { fullName: BUILDERS[2].name, userPrincipalName: BUILDERS[2].email, live: false };

const chapters = [
  {
    label: "Before you start", title: "Prepare a client-safe story first.",
    summary: "Contributors acknowledge privacy requirements before entering content, not after uploading it.",
    points: [
      ["Authorized material only", "Descriptions and media must use invented or anonymized data, with confidential figures and identifying details removed."],
      ["One internal exception", "The dedicated client field supports internal discovery. An authored anonymous description takes its place in presentations."],
      ["Acknowledgment is not approval", "Submission still requires librarian review. Contributors cannot clear their own work for client presentation."],
    ],
    tryIt: "Accept the safety requirements to unlock Continue. Editing requires a fresh acknowledgment.",
    boundary: "This is a local preview. Production requires Dataverse access controls and server-side validation.",
    output: "Safety acknowledgment",
  },
  {
    label: "Identity & effort", title: "Give the work a name. Give its builders credit.",
    summary: "The first step turns a project into a recognizable solution, with a clear owner and a consistent measure of contribution.",
    points: [
      ["A card, not a project code", "The name, one-line summary, specialization and maturity become the first impression in the library."],
      ["Credit every contributor", "Search people by name or email. Duplicate contributors are excluded; keep at least one person."],
      ["Effort fits maturity", "Ideas and prototypes take direct hours. Demos and production use US business days multiplied by 8 hours and allocation. The sample totals 218 hours."],
    ],
    tryIt: "Switch from Working prototype to Client demo to see dates and allocation. Add a client name and an anonymous description.",
    boundary: "People are a mock list. Calendar coverage is 2026. Direct hours are reported effort; calendar hours are estimated capacity.",
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
    tryIt: "Search the tag lists. Add React and then react: the technology should only be selected once.",
    boundary: "Governed options come from the bundled catalogue. New technologies are local draft values, not shared reference records.",
    output: "Capability, technology + industry relationships",
  },
  {
    label: "Media", title: "Give the CSM something they can actually show.",
    summary: "Images and demo files live in one step, with guidance based on the capabilities selected earlier.",
    points: [
      ["Images are required", "Add one to six detail images. The card thumbnail remains optional, with a generated poster as the fallback."],
      ["Four categories", "Images, videos, one-pagers or slides, and self-contained HTML. Permission-dependent app links are deferred."],
      ["Show the outcome", "Use user flows, understandable diagrams or dashboard screenshots. Remove confidential data and client identifiers."],
    ],
    tryIt: "Remove the detail images to see Continue disabled. A thumbnail alone is not sufficient. Add a PNG, JPG or WebP to continue.",
    boundary: "Media stays in memory and is lost on reload. No file is uploaded to Dataverse. HTML runs in a restrictive sandbox in the app viewer.",
    output: "Required gallery + optional thumbnail and attachments",
  },
  {
    label: "Review & submit", title: "Preview the shelf. Then hand off for review.",
    summary: "The builder sees the actual library card before submitting, with the key decisions summarized alongside it.",
    points: [
      ["The real card component", "This is the same SolutionCard used in the library, populated by the values entered in this form."],
      ["One last check", "Review contributors, effort, media, acknowledgment and internal versus client-visible context."],
      ["Submission is not publication", "The intended workflow moves to librarian review. Approval, not the submit button, makes the solution available on the shelf."],
    ],
    tryIt: "Submit for review to reach the handoff explanation. Use the chapter list to revisit any part of the story.",
    boundary: "This walkthrough simulates the handoff. The app also provides My submissions for local inspection and editing; neither writes to Dataverse or notifies a librarian.",
    output: "Intended next state: Pending review",
  },
];

function seedDraft() {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
    name: example.name, summary: example.summary, area: example.specializationArea,
    status: example.status, whatItDoes: example.whatItDoes, businessValue: example.businessValue,
    capabilities: example.capabilities, technologies: example.technologies, industries: example.industries,
    assetType: "Self-contained HTML file", assets: [],
    thumbnail: "", images: example.images, safetyAcknowledged: false,
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
      setStep((current) => Math.max(0, Math.min(chapters.length - 1, current + (event.key === "ArrowRight" ? 1 : -1))));
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
            <p className="eyebrow">{submitted ? "The handoff" : `Chapter ${String(step + 1).padStart(2, "0")} / 06`}</p>
            <h2>{submitted ? "The builder is done. Curation comes next." : chapter.title}</h2>
            <p className="presentation-summary">{submitted ? "The intended next step belongs to the librarian: verify the story, assets and sharing choices before publication." : chapter.summary}</p>
            <dl className="presentation-points">
              {(submitted ? [
                ["Review", "The librarian checks completeness, safe media and anonymous presentation context."],
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
            <span>{String(step + 1).padStart(2, "0")} / 06</span>
            <button className="presentation-icon" aria-label="Next chapter" title="Next chapter" disabled={step === chapters.length - 1} onClick={() => goTo(step + 1)}><Icon name="arrowRight" size={20} /></button>
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
                  <li><Icon name="check" /><div><strong>Contributor submits</strong><span>Story, people, effort, media and safety acknowledgment</span></div></li>
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