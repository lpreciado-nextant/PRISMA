import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "../components/Icon";
import { VideoPlayer } from "../components/ViewerFrame";
import { navigate } from "../lib/router";
import demoVideoUrl from "../../../presentation/PRISMA Demo-web.mp4?url";

type Role = { id: string; icon: IconName; eyebrow: string; title: string; steps: ReactNode[] };
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
    { id: "help-find", icon: "search", eyebrow: "Everyone · CSMs", title: "Find and present a solution", steps: [
      <>Search the <b>Library</b> by name, problem or technology, and narrow it with <b>Refine</b> (area, capability, industry, demo type and more).</>,
      <>Open a solution to read what it does, why it matters, its demo, screenshots and who built it.</>,
      <>Before showing it on a client's screen, turn on <b>Present mode</b> in the top bar. It removes internal information, such as real client names, contributors, effort and notes, before anything is shown.</>,
      ...(connected ? [
        <>Use <b>Download presentation</b> for a ready-made deck. It appears only for solutions cleared for clients.</>,
        <>Save solutions with the heart, and use <b>Suggest an improvement</b> to send the solution team an idea privately.</>,
      ] : [<>Save solutions with the heart to find them again under <b>Saved solutions</b>.</>]),
    ] },
    { id: "help-share", icon: "plus", eyebrow: "Contributors", title: "Share your work", steps: [
      <>Click <b>Submit a solution</b> in the top bar. You can <b>Save draft &amp; close</b> at any step and finish later from <b>My submissions</b>.</>,
      <>Describe what it does and its business value, choose its main capability (and, if one played a significant role, one other), add who built it and how complex it was, then add one to six screenshots and any demo.</>,
      <>Confirm the content is safe for clients and <b>Submit for review</b>. A librarian checks it before anything is published.</>,
      <>If the reviewer requests changes, you see their comment in My submissions. Edit and resubmit.{connected ? " See Change requests and suggestions below." : ""}</>,
      connected
        ? <>To change a published solution, use <b>Unpublish &amp; edit</b>. It leaves the library until it is approved again. A librarian may also correct it directly; you then see what changed and why.</>
        : <>To change a submission, open it from My submissions and choose <b>Edit submission</b>.</>,
    ] },
    ...(connected ? [{ id: "help-feedback", icon: "message" as const, eyebrow: "Solution teams", title: "Change requests and suggestions", steps: [
      <>A solution can get two kinds of feedback. A <b>change request</b> comes from its reviewer: a librarian who owns a capability in the solution's area, or the global librarian. You must act on it before the solution is published. A <b>suggestion</b> is an idea from any PRISMA user; you decide whether to apply it.</>,
      <><b>Change request:</b> when the reviewer uses <b>Request changes</b>, the solution goes back to Draft as <b>Changes requested</b> with their comment. It leads <b>Needs your attention</b> in My submissions, in amber. Edit the solution and resubmit it; it stays pending until you do.</>,
      <><b>Suggestion:</b> anyone can open a published solution and use <b>Suggest an improvement</b>, at the end of its side column. It is private, not a public comment: only the solution's owner, its contributors and librarians see it, with who sent it and when. It cannot be edited once sent.</>,
      <>The team sees suggestions on the solution's page. The owner also sees them in <b>My submissions</b>: under <b>Needs your attention</b>, on the solution's card and in the top bar, each counts as <b>pending</b> until the owner marks it <b>Addressed</b>. Contributors and librarians can read them but not mark them. There are no emails yet, so check My submissions from time to time.</>,
      <><b>Addressed</b> only means "we have seen this and dealt with it". A suggestion does not require a change and nothing changes automatically: the owner decides whether to update the solution, and can undo it.</>,
    ] }] : []),
    ...(librarian ? [{ id: "help-review", icon: "clipboardCheck" as const, eyebrow: "Librarians", title: "Review and curate", steps: [
      <>Open the <b>Review queue</b>, then a submission. Check its content and the <b>Publication checklist</b>.{connected ? " The queue lists the solutions whose main capability is in an area where you own a capability; the global librarian sees them all." : ""}</>,
      <><b>Approve</b> to publish it, or <b>Request changes</b> with a comment saying what to fix. The owner then corrects and resubmits it.</>,
      ...(connected ? [
        <>To fix something yourself, use <b>Edit solution</b>. It works on other people's pending or published solutions; your own you withdraw and edit as their owner.</>,
        <>After editing, tell the owner what you changed and why: in the approval note for a pending solution, or with <b>Confirm changes</b> for a published one, which stays out of present mode until you confirm.</>,
        <>On a published solution, <b>Send back to owner</b> and <b>Retire from library</b> (in the ••• menu) take it out of the library. Use them only when the owner must act, or when it is obsolete.</>,
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
    ...(connected ? [{ question: "Why can't I edit my own solution from the review queue?", answer: <>A librarian edits other people's solutions and explains the change to them. Your own you edit as its owner: open it from My submissions, use <b>Withdraw &amp; edit</b> (or <b>Unpublish &amp; edit</b> if it is published), change it and resubmit it.</> }] : []),
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
      <ol className="mt-4 space-y-3">
        {role.steps.map((step, index) => <li key={index} className="flex items-start gap-3 text-[15px] leading-relaxed">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }} aria-hidden="true">{index + 1}</span>
          <span className="min-w-0">{step}</span>
        </li>)}
      </ol>
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
