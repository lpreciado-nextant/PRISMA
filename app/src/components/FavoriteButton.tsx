import { toggleFavorite, useFavorites } from "../lib/favorites";
import { Icon } from "./Icon";

/**
 * Heart toggle for one solution. Personal, so callers hide it in present mode.
 * Uncontrolled by default (the PoC's local browser-only favorites). Pass `saved` + `onToggle`
 * to control it instead — the connected app does this to persist through `nx_solutionfavorite`.
 */
export function FavoriteButton({ id, name, className = "", saved: controlledSaved, onToggle, pending = false, count }: {
  id: string; name: string; className?: string; saved?: boolean; onToggle?: () => void; pending?: boolean;
  /** How many people saved it; turns the round heart into a heart + count chip. */
  count?: number;
}) {
  const localSaved = useFavorites().includes(id);
  const saved = controlledSaved ?? localSaved;
  const savedBy = count === undefined ? "" : `, saved by ${count} ${count === 1 ? "person" : "people"}`;
  const label = (saved ? `Remove ${name} from favorites` : `Save ${name} to favorites`) + savedBy;
  const shape = count === undefined ? "grid w-9 place-items-center" : "inline-flex items-center gap-2 px-3.5 text-[13px] font-semibold tabular-nums";
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={(saved ? "Remove from favorites" : "Save to favorites") + savedBy}
      disabled={pending}
      onClick={() => onToggle ? onToggle() : toggleFavorite(id)}
      className={`glass h-9 shrink-0 cursor-pointer rounded-full transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${shape} ${className}`}
      style={{ color: saved ? "var(--favorite)" : "var(--ink-2)", fontFamily: count === undefined ? undefined : "var(--font-display)" }}
    >
      <Icon name="heart" size={count === undefined ? 17 : 15} filled={saved} />
      {count}
    </button>
  );
}
