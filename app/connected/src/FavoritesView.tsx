import { Icon } from "../../src/components/Icon";
import { navigate } from "../../src/lib/router";
import { ConnectedSolutionCard } from "./ConnectedSolutionCard";
import type { CatalogueSolution } from "./catalogue";
import { presentable } from "../../src/lib/catalogue";

/** "My favorites": saved solutions, newest first. Unavailable ones (withdrawn, retired) are simply not listed. */
export function FavoritesView({ catalogue, ids, pending, onToggle, onPresent }: {
  catalogue: CatalogueSolution[]; ids: Set<string>; pending: Set<string>; onToggle: (id: string) => void; onPresent?: () => void;
}) {
  const saved = [...ids].map(id => catalogue.find(solution => solution.id === id)).filter((solution): solution is CatalogueSolution => Boolean(solution));
  const ready = saved.filter(presentable).length;

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
      {/* Same header position as the other sections: the tabs above already lead back to the library. */}
      <div className="border-b pb-5" style={{ borderColor: "var(--glass-edge)" }}>
        <h1 className="text-[26px]">My favorites</h1>
        {/* Prepare a client meeting: present only the saved solutions that are cleared for clients. */}
        {saved.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" disabled={!ready || !onPresent} onClick={onPresent} className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: "var(--font-display)", background: "var(--accent)", color: "var(--on-accent)" }}>
            <Icon name="present" size={16} />Present these solutions{ready > 0 && ` (${ready})`}
          </button>
          <p className="text-[13.5px]" style={{ color: "var(--ink-2)" }}>{ready ? `Opens present mode with only the ${ready === 1 ? "one" : ready} cleared for clients.` : "None of these is cleared for clients yet."}</p>
        </div>}
      </div>
      {saved.length === 0 ? (
        <div className="py-20 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--favorite) 14%, transparent)", color: "var(--favorite)" }}>
            <Icon name="heart" size={24} />
          </span>
          <h2 className="mt-5 text-[20px]">No favorites yet</h2>
          <p className="mt-2" style={{ color: "var(--ink-2)" }}>Tap the heart on any solution to keep it here.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 cursor-pointer rounded-xl px-4 py-2.5 text-[14px] font-semibold"
            style={{ fontFamily: "var(--font-display)", background: "var(--accent)", color: "var(--on-accent)" }}
          >
            Browse the library
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((solution, index) => (
            <div key={solution.id} className="grid min-w-0 content-start gap-2">
              <ConnectedSolutionCard solution={solution} present={false} index={index} thumbnail={solution.cardThumbnail}
                favorite={{ saved: true, pending: pending.has(solution.id), onToggle: () => onToggle(solution.id) }} />
              {!presentable(solution) && <p className="flex items-center gap-1.5 px-1 text-[12.5px]" style={{ color: "var(--ink-3)" }}><Icon name="eyeOff" size={13} />Not cleared for clients: hidden in present mode</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
