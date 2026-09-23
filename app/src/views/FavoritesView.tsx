import type { Solution } from "../types";
import { SolutionCard } from "../components/SolutionCard";
import { Icon } from "../components/Icon";
import { navigate } from "../lib/router";
import { useFavorites } from "../lib/favorites";

/** "My favorites": saved solutions, newest first. Unavailable ones (withdrawn, retired) are simply not listed. */
export function FavoritesView({ catalogue }: { catalogue: Solution[] }) {
  const ids = useFavorites();
  const saved = ids.map((id) => catalogue.find((solution) => solution.id === id)).filter((solution): solution is Solution => Boolean(solution));

  return (
    <div className="mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}
      >
        <Icon name="chevronLeft" size={15} />
        Back to the library
      </button>
      <div className="mt-4 border-b pb-5" style={{ borderColor: "var(--glass-edge)" }}>
        <p className="eyebrow">Your shortlist</p>
        <h1 className="mt-2 text-[26px]">My favorites</h1>
        <p className="mt-2 text-[14px]" style={{ color: "var(--ink-2)" }}>
          Only you see this list. Saved in this browser only; no Dataverse records.
        </p>
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
            <SolutionCard key={solution.id} solution={solution} present={false} index={index} favoritable />
          ))}
        </div>
      )}
    </div>
  );
}
