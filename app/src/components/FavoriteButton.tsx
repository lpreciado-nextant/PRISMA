import { toggleFavorite, useFavorites } from "../lib/favorites";
import { Icon } from "./Icon";

/**
 * Heart toggle for one solution. Personal, so callers hide it in present mode.
 * Uncontrolled by default (the PoC's local browser-only favorites). Pass `saved` + `onToggle`
 * to control it instead — the connected app does this to persist through `nx_solutionfavorite`.
 */
export function FavoriteButton({ id, name, className = "", saved: controlledSaved, onToggle, pending = false }: {
  id: string; name: string; className?: string; saved?: boolean; onToggle?: () => void; pending?: boolean;
}) {
  const localSaved = useFavorites().includes(id);
  const saved = controlledSaved ?? localSaved;
  const label = saved ? `Remove ${name} from favorites` : `Save ${name} to favorites`;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Remove from favorites" : "Save to favorites"}
      disabled={pending}
      onClick={() => onToggle ? onToggle() : toggleFavorite(id)}
      className={`glass grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{ color: saved ? "var(--favorite)" : "var(--ink-2)" }}
    >
      <Icon name="heart" size={17} filled={saved} />
    </button>
  );
}
