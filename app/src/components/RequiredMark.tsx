import { Icon } from "./Icon";

/** The form's single required marker: an amber asterisk that screen readers announce as "required". */
export function RequiredMark() {
  return <><span aria-hidden="true" style={{ color: "var(--proto)" }}> *</span><span className="sr-only"> (required)</span></>;
}

/** Spelled out beside fields a submission can leave empty, so nothing is left to guess. */
export function OptionalMark() {
  return <span className="ml-1 text-[12px] font-normal text-(--ink-3)">(optional)</span>;
}

/** One discreet line per step, under the introduction: drafts need only a name (left), the asterisk means required for review (right). */
export function RequiredLegend() {
  return <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <p className="flex items-center gap-2 border-l-2 pl-3 text-[12.5px] text-(--ink-2)" style={{ borderColor: "var(--accent)" }}><span className="shrink-0" style={{ color: "var(--accent)" }}><Icon name="info" size={14} /></span>Only the solution name is needed to save a draft.</p>
    <p className="ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ color: "var(--proto)", borderColor: "color-mix(in srgb, var(--proto) 35%, var(--glass-edge))", background: "color-mix(in srgb, var(--proto) 10%, transparent)" }}><span aria-hidden="true">*</span> Required for review</p>
  </div>;
}
