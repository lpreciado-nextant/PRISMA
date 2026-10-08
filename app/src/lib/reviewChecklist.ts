/** Facts each adapter derives from its own record shape; the panel only renders them. */
export type ReviewFacts = {
  summary: boolean;
  /** What it does and business value: both required (`nx_whatitdoes`, `nx_businessvalue` are Business Required). */
  story: boolean;
  capability: boolean;
  contributors: boolean;
  images: number;
  uploadsComplete: boolean;
  safety: boolean;
  /** No named client, or a named client with anonymous presentation context. */
  anonymized: boolean;
};

export type ReviewCheck = { label: string; done: boolean };

/** The publication requirements, in the order a reviewer reads them. Informational: the server still decides. */
export function reviewChecklist(facts: ReviewFacts): ReviewCheck[] {
  return [
    { label: "Summary and capability", done: facts.summary && facts.capability },
    { label: "What it does and business value", done: facts.story },
    { label: "Contributors with complete effort", done: facts.contributors },
    { label: "Detail images (1 to 6)", done: facts.images >= 1 && facts.images <= 6 },
    { label: "All uploads finished", done: facts.uploadsComplete },
    { label: "Client context anonymized", done: facts.anonymized },
    { label: "Contributor safety acknowledgment", done: facts.safety },
  ];
}
