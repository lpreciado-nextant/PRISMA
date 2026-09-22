import { useId } from "react";

export function ProgressRail({ label, value, valueText }: { label: string; value?: number; valueText?: string }) {
  const percent = value !== undefined && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
  return <div className="loading-rail" data-indeterminate={percent === undefined} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={valueText}>
    <span style={percent === undefined ? undefined : { width: `${percent}%` }} />
  </div>;
}

export function LoadingState({ label, variant = "inline", progress, className = "" }: {
  label: string; variant?: "page" | "media" | "inline"; progress?: number; className?: string;
}) {
  const headingId = useId();
  const Container = variant === "page" ? "section" : "div";
  const Heading = variant === "page" ? "h1" : "p";
  return <Container className={`loading-state loading-state--${variant} ${className}`} aria-labelledby={variant === "page" ? headingId : undefined}>
    {variant !== "inline" && <div className="loading-emblem" aria-hidden="true">
      {variant === "page" && <><div className="loading-facet loading-facet--back glass" /><div className="loading-facet loading-facet--front glass" /></>}
      <img src="./prisma-mark-v2.svg" alt="" width={variant === "page" ? 72 : 32} height={variant === "page" ? 72 : 32} />
    </div>}
    <Heading id={headingId} className="loading-label"><span role="status" aria-live="polite" aria-atomic="true">{label}</span></Heading>
    {progress === undefined ? <div className="loading-rail" data-indeterminate="true" aria-hidden="true"><span /></div>
      : <ProgressRail label={label} value={progress} />}
  </Container>;
}