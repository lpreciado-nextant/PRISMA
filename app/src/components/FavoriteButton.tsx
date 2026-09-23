import { toggleFavorite, useFavorites } from "../lib/favorites";
import { Icon } from "./Icon";

/** Heart toggle for one solution. Personal, so callers hide it in present mode. */
export function FavoriteButton({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  const saved = useFavorites().includes(id);
  const label = saved ? `Remove ${name} from favorites` : `Save ${name} to favorites`;
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Remove from favorites" : "Save to favorites"}
      onClick={() => toggleFavorite(id)}
      className={`glass grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full transition-transform duration-200 hover:scale-105 ${className}`}
      style={{ color: saved ? "var(--favorite)" : "var(--ink-2)" }}
    >
      <Icon name="heart" size={17} filled={saved} />
    </button>
  );
}
