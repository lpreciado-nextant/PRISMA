import type { SpecializationArea } from "../types";
import { AREAS } from "../data/solutions";

/**
 * Stands in for the Dataverse Thumbnail image column: renders the uploaded
 * image when there is one, otherwise a deterministic generated placeholder.
 */
export function Poster({
  id,
  name,
  area,
  src,
  className = "",
}: {
  id: string;
  name: string;
  area: SpecializationArea;
  src?: string;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{
            background:
              "linear-gradient(to top, color-mix(in srgb, var(--ground) 55%, transparent), transparent)",
          }}
        />
      </div>
    );
  }

  return <GeneratedPoster id={id} name={name} area={area} className={className} />;
}

function GeneratedPoster({
  id,
  name,
  area,
  className = "",
}: {
  id: string;
  name: string;
  area: SpecializationArea;
  className?: string;
}) {
  const accent = AREAS[area].cssVar;
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = 120 + (seed % 7) * 22;
  const x = 20 + (seed % 5) * 14;
  const y = 18 + (seed % 3) * 22;

  const monogram = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(${angle}deg, color-mix(in srgb, ${accent} 34%, transparent), transparent 62%), radial-gradient(70% 90% at ${x}% ${y}%, color-mix(in srgb, ${accent} 30%, transparent), transparent 70%), color-mix(in srgb, var(--ground-2) 78%, transparent)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `repeating-linear-gradient(${angle}deg, color-mix(in srgb, var(--ink) 16%, transparent) 0 1px, transparent 1px 13px)`,
        }}
      />
      <span
        className="absolute -right-3 -bottom-7 font-black select-none"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "5.4rem",
          letterSpacing: "-0.06em",
          color: `color-mix(in srgb, ${accent} 30%, transparent)`,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {monogram}
      </span>
      <div
        className="absolute inset-x-0 bottom-0 h-16"
        style={{
          background: "linear-gradient(to top, color-mix(in srgb, var(--ground) 55%, transparent), transparent)",
        }}
      />
    </div>
  );
}
