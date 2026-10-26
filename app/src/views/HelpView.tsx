import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "../components/Icon";
import { VideoPlayer } from "../components/ViewerFrame";
import { navigate } from "../lib/router";
import demoVideoUrl from "../../../presentation/PRISMA Demo-web.mp4?url";

/** A guide is numbered `steps`, or free-form `body` (headings and bullets) when steps do not fit. */
type Role = { id: string; icon: IconName; eyebrow: string; title: string; steps?: ReactNode[]; body?: ReactNode };
/** Prefilled links to the PRISMA team. Who is on it is configured by the app, so the page never names people. */
export type HelpContact = { teams: string; email: string };
const contactButton = "inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-semibold outline-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)";

/**
 * "How PRISMA works" (`#/help`): one short guide per role and common questions, reached from the masthead's help button.
 * It never sits in the hero flow (search → grid → detail → viewer) and is not offered in present mode. `connected` adds
 * what only the Dataverse app does (librarian editing, Dataverse permissions); the PoC shows the shared basics.
 * Guide buttons toggle their content without changing the hash, which belongs to the router.
 * `contact` (connected only) adds "Questions or something looks wrong?" with a Teams chat and an email to the PRISMA team.
 */
export function HelpView({ connected = false, librarian = true, contact }: { connected?: boolean; librarian?: boolean; contact?: HelpContact }) {
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const roles: Role[] = [
    { id: "help-find", icon: "search", eyebrow: "Everyone · CSMs", title: "Find and Present a Solution", steps: [
      <><b>Find a solution:</b> Search the Library by name, problem, or technology. Use <b>Refine</b> to filter by area, capability, industry, demo type, and more.</>,
      <><b>Explore the details:</b> Open a solution to learn what it does, its business value, available demos, screenshots, and contributors.</>,
      <><b>Present to clients:</b> Before sharing your screen with a client, enable <b>Present Mode</b> in the top bar. This hides internal information, such as client names, contributors, development effort, and internal notes.</>,
      ...(connected ? [
        <><b>Download a presentation:</b> Use <b>Download Presentation</b> to get a ready-to-use deck when the solution is approved for client sharing.</>,
        <><b>Save and suggest:</b> Click the heart to save your favorite solutions, or use <b>Suggest an Improvement</b> to privately share feedback with the solution team.</>,
      ] : [<><b>Save solutions:</b> Click the heart to save your favorite solutions and find them again under <b>Saved solutions</b>.</>]),
    ] },
    { id: "help-share", icon: "plus", eyebrow: "Contributors", title: "Share Your Work", steps: [
      <><b>Submit a solution:</b> Click <b>Submit a Solution</b> in the top bar. You can save your progress as a draft and continue later from <b>My Submissions</b>.</>,
      <><b>Add solution details:</b> Describe what your solution does, its business value, and its main capability. Add contributors, development effort, screenshots, and any available demos.</>,
      <><b>Submit for review:</b> Make sure your content is safe to share and click <b>Submit for Review</b>. A Librarian will review and approve it before publication.</>,
      <><b>Address Change Requests:</b> If the Librarian requests changes, review their comments in <b>My Submissions</b>, make the required updates, and resubmit your solution for approval.</>,
      connected
        ? <><b>Edit published solutions:</b> Use <b>Unpublish &amp; Edit</b> to make updates. Your solution will be temporarily removed from the Library until approved again. Librarians can also make corrections directly, and you'll be able to see what changed and why.</>
        : <>To change a submission, open it from My submissions and choose <b>Edit submission</b>.</>,
    ] },
    ...(connected ? [{ id: "help-feedback", icon: "message" as const, eyebrow: "Solution teams", title: "Change Requests & Suggestions", body: <div className="mt-4 text-[15px] leading-relaxed">
      <p>PRISMA allows users to provide two types of feedback: <b>Change Requests</b> and <b>Suggestions</b>.</p>
      <h3 className="mt-5 text-[16px] font-semibold">Change Requests</h3>
      <p className="mt-1.5">A Change Request comes from a Librarian during the review process. <b>Change Requests take priority because your solution cannot be published until they are resolved.</b></p>
      <ul className="mt-2 space-y-1.5">
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} /><span className="min-w-0">Your solution will appear under <b>Needs Your Attention</b> in My Submissions, marked as <b>Changes Requested</b>.</span></li>
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} /><span className="min-w-0">Review the Librarian's comments, make the necessary changes, and resubmit your solution for approval.</span></li>
      </ul>
      <h3 className="mt-5 text-[16px] font-semibold">Suggestions</h3>
      <p className="mt-1.5">Any PRISMA user can suggest improvements to a published solution by clicking <b>Suggest an Improvement</b>.</p>
      <ul className="mt-2 space-y-1.5">
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} /><span className="min-w-0">Suggestions are private and visible only to the solution owner, contributors, and Librarians.</span></li>
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} /><span className="min-w-0">The solution owner can view suggestions directly on the solution page or under <b>Needs Your Attention</b> in My Submissions.</span></li>
        <li className="flex items-start gap-2.5"><span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} /><span className="min-w-0">Suggestions remain pending until the owner marks them as <b>Addressed</b>.</span></li>
      </ul>
      <p className="mt-5"><b>Important:</b> Suggestions are optional. You decide whether to apply them. Marking a suggestion as Addressed simply means you've reviewed it; it doesn't automatically change your solution.</p>
    </div> }] : []),
    ...(librarian ? [{ id: "help-review", icon: "clipboardCheck" as const, eyebrow: "Librarians", title: "Review and Curate", steps: [
      <><b>Review submissions:</b> Open the <b>Review Queue</b> and select a solution. Check its content using the <b>Publication Checklist</b>.{connected ? " You'll see solutions from all capabilities within your area, while Global Librarians can review all submissions." : ""}</>,
      <><b>Approve or Request Changes:</b> Approve solutions that are ready to publish. If significant changes are needed, select <b>Request Changes</b> and explain what the owner needs to fix before resubmitting.</>,
      ...(connected ? [
        <><b>Make minor corrections before publishing:</b> Use <b>Edit Solution</b> to make small corrections directly to a user's submission before approving it, such as fixing typos, formatting, or minor content issues. For larger changes, use <b>Request Changes</b> so the owner can update the solution.</>,
        <><b>Explain your changes:</b> If you edit a solution, let the owner know what you changed and why. Use the approval note for pending solutions or <b>Confirm Changes</b> for published ones.</>,
        <><b>Manage published solutions:</b> Use <b>Send Back to Owner</b> when updates are required, or <b>Retire from Library</b> when a solution is no longer relevant. Both options remove the solution from the Library.</>,
      ] : []),
    ] }] : []),
  ];
  const questions: { question: string; answer: ReactNode }[] = [
    { question: "What does present mode hide?", answer: <>Real client names (the anonymous description is shown instead), contributors and the CSM, effort, projects, library notes and every internal section. Your submissions, saved solutions and the review queue are unavailable until you turn it off. It prevents accidental exposure on a shared screen; it is not a permission system.</> },
    ...(connected ? [
      { question: "Why can't I edit a solution after submitting it?", answer: <>Submitted and published solutions are locked so the librarian reviews exactly what you sent. Use <b>Withdraw &amp; edit</b> (pending) or <b>Unpublish &amp; edit</b> (published) from the solution's page in My submissions, then resubmit.</> },
      { question: "Why isn't Download presentation offered?", answer: <>The deck is only produced for published solutions that are cleared for clients, and it never includes effort, builder names or internal notes.</> },
    ] : []),
    { question: "What do complexity and estimated hours mean?", answer: <>How hard the whole solution was to build (Easy, Medium or Hard; required to submit) and, optionally, the least time it took in whole hours, including preparation and discovery. Both are internal and never shown to clients.</> },
    { question: "Who sees my drafts?", answer: <>{connected ? "A draft stays with you until you submit it; then librarians review it. Published solutions are visible to everyone with access to PRISMA." : "In this local preview, drafts and submissions live in this browser only."}</> },
    ...(connected ? [{ question: "Why does My submissions keep showing \"pending\"?", answer: <>It counts your solutions with feedback still waiting for you: suggestions until you mark them <b>Addressed</b>, and change requests until you resubmit the solution. Reading a suggestion does not clear it; marking it addressed does.</> }] : []),
    ...(connected ? [{ question: "Why can't I edit my own solution from the Review Queue?", answer: <>
      <span className="block">As a Librarian, you can make minor corrections to other users' solutions during review. For larger changes, use <b>Request Changes</b> so the owner can update the content.</span>
      <span className="mt-2 block">To edit your own solution, go to <b>My Submissions</b>, select <b>Withdraw &amp; Edit</b> (or <b>Unpublish &amp; Edit</b> if already published), make your changes, and resubmit it for approval.</span>
    </> }] : []),
  ];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  return <section className="animate-rise mx-auto w-full max-w-[980px] px-4 pt-8 pb-24 sm:px-6" aria-labelledby="help-title">
    <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold text-(--ink-2)" onClick={() => navigate("/")}><Icon name="chevronLeft" size={15} />Back to the library</button>
    <p className="eyebrow mt-4">Help</p>
    <h1 id="help-title" className="mt-2 text-[28px] font-bold">How PRISMA works</h1>
    <p className="mt-2 max-w-[68ch] text-[15px] text-(--ink-2)">PRISMA is where Nextant keeps the demos, prototypes and products it has built, so anyone can find the right one and show it to a client.</p>
    {contact && <button type="button" onClick={() => jump("help-contact")} className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-[14px] font-semibold text-(--accent)"><Icon name="message" size={15} />Questions or something looks wrong? Contact us</button>}
    <ol aria-label="How a solution gets into PRISMA" className="mt-5 grid gap-3 sm:grid-cols-3">
      {([["plus", "Share", "A team adds a solution it built."], ["shield", "Review", "A librarian checks it is complete and safe to show clients."], ["present", "Find & present", "Anyone at Nextant finds it and presents it live."]] as const).map(([icon, title, text], index) => <li key={title} className="flex items-start gap-3 rounded-[18px] border border-(--glass-edge) p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}><Icon name={icon} size={17} /></span>
        <span className="min-w-0"><span className="block text-[15px] font-semibold"><span className="font-mono text-[12px] text-(--ink-3)">{index + 1} · </span>{title}</span><span className="mt-0.5 block text-[13.5px] text-(--ink-2)">{text}</span></span>
      </li>)}
    </ol>

    <div className="mt-6">
      <button type="button" aria-expanded={demoOpen} aria-controls="help-demo" onClick={() => setDemoOpen(open => !open)} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg text-[15px] font-semibold text-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)">
        <Icon name="play" size={18} />Watch the demo
        <Icon name="chevronDown" size={16} className={`shrink-0 transition-transform motion-reduce:transition-none ${demoOpen ? "rotate-180" : ""}`} />
      </button>
      <div id="help-demo" hidden={!demoOpen} className="mt-3 aspect-video overflow-hidden rounded-lg bg-black">
        {demoOpen && <VideoPlayer src={demoVideoUrl} name="PRISMA demo" className="h-full w-full object-contain" />}
      </div>
    </div>

    <h2 className="eyebrow mt-8">Guides</h2>
    <nav aria-label="Guides" className={`mt-3 grid gap-3 ${roles.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
      {roles.map(role => <button key={role.id} type="button" aria-expanded={activeGuide === role.id} aria-controls={role.id} onClick={() => setActiveGuide(current => current === role.id ? null : role.id)} className="glass glass-lite flex cursor-pointer items-start gap-3 rounded-[18px] p-4 text-left transition-[filter] hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)">
        <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}><Icon name={role.icon} size={17} /></span>
        <span className="min-w-0"><span className="eyebrow block text-[10px]">{role.eyebrow}</span><span className="mt-1 block text-[15px] font-semibold">{role.title}</span></span>
        <Icon name="chevronDown" size={16} className={`ml-auto shrink-0 self-center transition-transform motion-reduce:transition-none ${activeGuide === role.id ? "rotate-180" : ""}`} />
      </button>)}
    </nav>

    {roles.map(role => <section key={role.id} id={role.id} hidden={activeGuide !== role.id} aria-labelledby={`${role.id}-title`} className="glass glass-lite glass-sheen mt-6 scroll-mt-24 rounded-[24px] p-6 sm:p-8">
      <p className="eyebrow">{role.eyebrow}</p>
      <h2 id={`${role.id}-title`} className="mt-1.5 text-[21px] font-bold">{role.title}</h2>
      {role.body ?? <ol className="mt-4 space-y-3">
        {role.steps?.map((step, index) => <li key={index} className="flex items-start gap-3 text-[15px] leading-relaxed">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }} aria-hidden="true">{index + 1}</span>
          <span className="min-w-0">{step}</span>
        </li>)}
      </ol>}
    </section>)}

    <section aria-labelledby="help-faq" className="mt-8">
      <h2 id="help-faq" className="text-[21px] font-bold">Common questions</h2>
      <div className="mt-3 space-y-2">
        {questions.map(item => <details key={item.question} className="group rounded-[16px] border border-(--glass-edge) px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
            {item.question}<Icon name="chevronDown" size={16} className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <p className="mt-2 text-[14.5px] leading-relaxed text-(--ink-2)">{item.answer}</p>
        </details>)}
      </div>
    </section>

    {contact && <section id="help-contact" aria-labelledby="help-contact-title" className="glass glass-lite glass-sheen mt-8 scroll-mt-24 rounded-[24px] p-6 sm:p-8">
      <p className="eyebrow">Contact</p>
      <h2 id="help-contact-title" className="mt-1.5 text-[21px] font-bold">Questions or Issues?</h2>
      <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-(--ink-2)">Have a question about PRISMA or noticed something that doesn&apos;t seem right? Reach out to our support team. If you&apos;re reporting an issue, please include a brief description and any relevant screenshots or evidence to help us investigate.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={contact.teams} target="_blank" rel="noopener noreferrer" className={contactButton} style={{ color: "var(--on-accent)", background: "var(--accent)" }}><Icon name="message" size={16} />Chat in Teams<span className="sr-only"> (opens in a new tab)</span></a>
        <a href={contact.email} target="_blank" rel="noopener noreferrer" className={`${contactButton} border border-(--glass-edge) text-(--ink)`}><Icon name="mail" size={16} />Email us</a>
      </div>
    </section>}
  </section>;
}
