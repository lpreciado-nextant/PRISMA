import type { Solution } from "../types";
import { AreaTag, Chip, StatusPill } from "./Badges";
import { Icon } from "./Icon";
import { Poster } from "./Poster";
import { navigate } from "../lib/router";
import { initials } from "../lib/powerContext";

export function SolutionCard({
  solution,
  present,
  index,
}: {
  solution: Solution;
  present: boolean;
  index: number;
}) {
  const clientLine = present ? solution.clientContextRedacted : solution.clientContext;
  const builderNames = solution.contributors.map((contributor) => contributor.builtBy.name).join(", ");

  return (
    <article
      className="glass glass-lite glass-sheen lift animate-rise group flex cursor-pointer flex-col overflow-hidden rounded-[22px]"
      style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}
      onClick={() => navigate(`/s/${solution.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/s/${solution.id}`);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${solution.name} — ${solution.summary}`}
    >
      <div className="relative">
        <Poster
          id={solution.id}
          name={solution.name}
          area={solution.specializationArea}
          src={solution.thumbnail}
          className="h-36"
        />
        <div className="absolute top-3 left-3">
          <StatusPill status={solution.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <AreaTag area={solution.specializationArea} />

        <h3 className="text-[19px] leading-snug font-semibold" style={{ color: "var(--ink)" }}>
          {solution.name}
        </h3>

        <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {solution.summary}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {solution.capabilities.slice(0, 2).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          {solution.technologies.slice(0, 1).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-5 py-3.5"
        style={{
          borderTop: "1px solid var(--glass-edge)",
          background: "color-mix(in srgb, var(--ink) 4%, transparent)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-medium"
            style={{
              background: "color-mix(in srgb, var(--accent) 22%, transparent)",
              color: "var(--accent)",
            }}
          >
            {solution.contributors.length > 1 ? solution.contributors.length : initials(builderNames)}
          </span>
          <span className="truncate text-[13px]" title={builderNames} style={{ color: "var(--ink-3)" }}>
            {clientLine ?? (builderNames || "Contributors pending")}
          </span>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ fontFamily: "var(--font-display)", color: "var(--accent)" }}
        >
          Open
          <Icon name="arrowRight" size={14} />
        </span>
      </div>
    </article>
  );
}
