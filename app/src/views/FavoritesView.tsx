import type { Solution } from "../types";
import { SolutionCard } from "../components/SolutionCard";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/router";
import { useFavorites } from "../lib/favorites";
import { presentable } from "../lib/catalogue";

/** "My favorites": saved solutions, newest first. Unavailable ones (withdrawn, retired) are simply not listed. */
export function FavoritesView({ catalogue }: { catalogue: Solution[] }) {
  const ids = useFavorites();
  const saved = ids.map((id) => catalogue.find((solution) => solution.id === id)).filter((solution): solution is Solution => Boolean(solution));

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
      {/* Same header position as the other sections: the tabs above already lead back to the library. */}
      <div className="border-b pb-5" style={{ borderColor: "var(--glass-edge)" }}>
        <h1 className="text-[26px]">My favorites</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>
          Saved in this browser only; no Dataverse records.
        </p>
        <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>In present mode, the ones cleared for clients show as <b className="font-semibold" style={{ color: "var(--ink)" }}>Selected for you</b>.</p>
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
              <SolutionCard solution={solution} present={false} index={index} favoritable />
              {!presentable(solution) && <p className="flex items-center gap-1.5 px-1 text-[12.5px]" style={{ color: "var(--ink-3)" }}><Icon name="eyeOff" size={13} />Not cleared for clients: hidden in present mode</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
