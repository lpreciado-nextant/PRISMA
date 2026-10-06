import type { CSSProperties, ReactNode } from "react";
import type { SolutionStatus, SpecializationArea } from "../types";
import { AREAS } from "../data/catalogueMetadata";
import type { SubmissionState } from "../lib/submissionState";
import { Icon } from "./Icon";

const STATUS_COLOR: Record<SolutionStatus, string> = {
  "Idea / concept": "var(--idea)",
  "Working prototype": "var(--proto)",
  "Client demo": "var(--accent)",
  "Live in production": "var(--live)",
  Retired: "var(--ink-3)",
};

export function StatusPill({ status }: { status: SolutionStatus }) {
  const color = STATUS_COLOR[status];
  // Opaque so the label stays legible on any thumbnail; the same pill is used everywhere for consistency.
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium tracking-[0.1em] uppercase"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, var(--ground))`,
        background: `color-mix(in srgb, ${color} 14%, var(--ground))`,
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.18)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

const SUBMISSION_COLOR: Record<SubmissionState, string> = {
  Draft: "var(--ink-3)",
  "Pending review": "var(--accent)",
  "Changes requested": "var(--proto)",
  Published: "var(--live)",
  Retired: "var(--ink-3)",
};

/** Review state of an owned submission; deliberately text-weight, separate from the maturity pill on the poster. */
export function SubmissionStatus({ state }: { state: SubmissionState }) {
  const color = SUBMISSION_COLOR[state];
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color }}>
      {state === "Changes requested" ? <Icon name="alert" size={14} /> : <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      {state}
    </span>
  );
}

/** `short` shows the area initials (AI, DS, IBO) where space is tight; the full name stays in the tooltip and for screen readers. */
export function AreaTag({ area, size = "sm", short = false }: { area: SpecializationArea; size?: "xs" | "sm" | "md"; short?: boolean }) {
  const meta = AREAS[area];
  return (
    <span
      className={`area-tag inline-flex items-center rounded-full border font-semibold ${
        size === "md" ? "gap-2 px-3.5 py-1.5 text-[13px]" : size === "xs" ? "gap-1.5 px-2 py-0.5 text-[10.5px]" : "gap-2 px-2.5 py-1 text-[11.5px]"
      }`}
      title={short ? meta.name : undefined}
      style={{ fontFamily: "var(--font-display)", "--tag": meta.cssVar } as CSSProperties}
    >
      <span className={`${size === "xs" ? "h-1 w-1" : "h-1.5 w-1.5"} rounded-full`} style={{ background: meta.cssVar }} />
      {short ? <><span aria-hidden="true">{meta.short}</span><span className="sr-only">{meta.name}</span></> : meta.name}
    </span>
  );
}

export function Chip({
  children,
  onClick,
  active = false,
  title,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  /** Exposes a toggle state for filter chips; removable chips leave it unset. */
  pressed?: boolean;
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
    <button type="button" onClick={onClick} aria-pressed={pressed} className={`${className} cursor-pointer hover:brightness-110`} style={style} title={title}>
      {children}
    </button>
  );
}
