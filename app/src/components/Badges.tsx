import type { ReactNode } from "react";
import type { SolutionStatus, SpecializationArea } from "../types";
import { AREAS } from "../data/solutions";

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

export function AreaTag({ area, size = "sm" }: { area: SpecializationArea; size?: "sm" | "md" }) {
  const meta = AREAS[area];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${
        size === "md" ? "px-3.5 py-1.5 text-[13px]" : "px-2.5 py-1 text-[11.5px]"
      }`}
      style={{
        fontFamily: "var(--font-display)",
        color: meta.cssVar,
        borderColor: `color-mix(in srgb, ${meta.cssVar} 32%, transparent)`,
        background: `color-mix(in srgb, ${meta.cssVar} 11%, transparent)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.cssVar }} />
      {meta.name}
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
