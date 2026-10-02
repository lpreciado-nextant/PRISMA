/** The form's single required marker: an amber asterisk that screen readers announce as "required". */
export function RequiredMark() {
  return <><span aria-hidden="true" style={{ color: "var(--proto)" }}> *</span><span className="sr-only"> (required)</span></>;
}

/** Spelled out beside fields a submission can leave empty, so nothing is left to guess. */
export function OptionalMark() {
  return <span className="ml-1 text-[12px] font-normal text-(--ink-3)">(optional)</span>;
}

/** Explains the asterisk once per step; drafts need only a name, submission needs every marked field. */
export function RequiredLegend() {
  return <p className="text-[12.5px] text-(--ink-3)"><span aria-hidden="true" style={{ color: "var(--proto)" }}>*</span> Required to submit for review. To save a draft, only the solution name is needed.</p>;
}
