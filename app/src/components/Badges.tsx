import type { ReactNode } from "react";
import type { SolutionStatus, SpecializationArea } from "../types";
import { AREAS } from "../data/catalogueMetadata";

const STATUS_COLOR: Record<SolutionStatus, string> = {
  "Idea / concept": "var(--idea)",
  "Working prototype": "var(--proto)",
  "Client demo": "var(--accent)",
  "Live in production": "var(--live)",
  Retired: "var(--ink-3)",
};

export function StatusPill({ status }: { status: SolutionStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.1em] uppercase backdrop-blur-md"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

/** `short` shows the area initials (AI, DS, IBO) where space is tight; the full name stays in the tooltip and for screen readers. */
export function AreaTag({ area, size = "sm", short = false }: { area: SpecializationArea; size?: "2xs" | "xs" | "sm" | "md"; short?: boolean }) {
  const meta = AREAS[area];
  // 2xs is for tight rows (the Top 3 cards): one line, truncated, the full name on hover.
  const tiny = size === "2xs";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${
        size === "md" ? "gap-2 px-3.5 py-1.5 text-[13px]" : size === "xs" ? "gap-1.5 px-2 py-0.5 text-[10.5px]" : tiny ? "min-w-0 max-w-full gap-1 px-1.5 py-px text-[9.5px] leading-[1.35] whitespace-nowrap" : "gap-2 px-2.5 py-1 text-[11.5px]"
      }`}
      title={short || tiny ? meta.name : undefined}
      style={{
        fontFamily: "var(--font-display)",
        color: meta.cssVar,
        borderColor: `color-mix(in srgb, ${meta.cssVar} 32%, transparent)`,
        background: `color-mix(in srgb, ${meta.cssVar} 17%, transparent)`,
      }}
    >
      <span className={`${size === "xs" || tiny ? "h-1 w-1" : "h-1.5 w-1.5"} shrink-0 rounded-full`} style={{ background: meta.cssVar }} />
      {short ? <><span aria-hidden="true">{meta.short}</span><span className="sr-only">{meta.name}</span></> : tiny ? <span className="truncate">{meta.name}</span> : meta.name}
    </span>
  );
}

export function Chip({
  children,
  onClick,
  active = false,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const className =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors duration-200";
  const style = active
    ? {
        color: "var(--on-accent)",
        background: "var(--accent)",
        borderColor: "var(--accent)",
      }
    : {
        color: "var(--ink-2)",
        background: "color-mix(in srgb, var(--ink) 6%, transparent)",
        borderColor: "var(--glass-edge)",
      };

  if (!onClick) {
    return (
      <span className={className} style={style} title={title}>
        {children}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${className} cursor-pointer hover:brightness-110`} style={style} title={title}>
      {children}
    </button>
  );
}
