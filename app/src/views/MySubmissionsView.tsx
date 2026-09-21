import type { Solution } from "../types";
import { SolutionCard } from "../components/SolutionCard";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/router";

export function MySubmissionsView({ solutions }: { solutions: Solution[] }) {
  return <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5" style={{ borderColor: "var(--glass-edge)" }}>
      <div>
        <p className="eyebrow">Contributor workspace</p>
        <h1 className="mt-2 text-[26px]">My submissions</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>Local preview. Submissions and media last until reload; nothing is published or sent to Dataverse.</p>
      </div>
      <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }} onClick={() => navigate("/submit")}><Icon name="plus" />New submission</button>
    </div>
    {!solutions.length ? <div className="py-20 text-center">
      <h2 className="text-[20px]">No submissions yet</h2>
      <p className="mt-2" style={{ color: "var(--ink-2)" }}>Your submitted solutions will appear here.</p>
    </div> : <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {solutions.map((solution, index) => <article key={solution.id} className="min-w-0">
        <SolutionCard solution={solution} present={false} index={index} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px]" style={{ color: "var(--proto)" }}>{solution.publicationStatus}</span>
          <button className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold" style={{ borderColor: "var(--glass-edge)" }} onClick={() => navigate(`/submit/${solution.id}`)}><Icon name="file" />Edit submission</button>
        </div>
      </article>)}
    </div>}
  </div>;
}