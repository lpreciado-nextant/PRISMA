import { useState } from "react";
import { Icon } from "../components/Icon";
import { DuplicateTechnologies, type DuplicateDecision } from "../components/DuplicateTechnologies";
import { ReviewPanel, ReviewQueue } from "../components/ReviewQueue";
import { newTechnologies } from "../lib/technologyName";
import type { Solution } from "../types";
import { submissionFacts, type SubmissionEntry } from "../lib/submissions";
import { reviewChecklist } from "../lib/reviewChecklist";
import { navigate } from "../lib/router";
import { DetailView } from "./DetailView";
import { CAPABILITIES } from "../data/catalogueMetadata";

export function ReviewView({ entries, selectedId, onDecision, published = [], onReplaceTechnology }: {
  entries: SubmissionEntry[];
  selectedId?: string;
  onDecision: (id: string, decision: "publish" | "return", comments: string, clientSafe: boolean) => Promise<void>;
  /** The local library, for possible duplicate technologies: what other published solutions use, and every known name. */
  published?: Solution[];
  /** "Use existing": swap the submitted technology for the existing one on this browser's submission. */
  onReplaceTechnology?: (id: string, submitted: string, existing: string) => Promise<void>;
}) {
  const [comments, setComments] = useState("");
  const [clientSafe, setClientSafe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [duplicates, setDuplicates] = useState<Record<string, DuplicateDecision>>({});
  const [duplicateBusy, setDuplicateBusy] = useState<string>();
  const [duplicateError, setDuplicateError] = useState<{ name: string; message: string }>();
  const selected = entries.find((entry) => entry.solution.id === selectedId);
  const decide = async (decision: "publish" | "return") => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await onDecision(selected.solution.id, decision, comments, clientSafe);
      setNotice(decision === "publish" ? "Published in the local library." : "Returned to the contributor with your comments.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the review. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const replaceWithExisting = async (name: string, existing: string) => {
    if (!selected || !onReplaceTechnology || duplicateBusy) return;
    setDuplicateBusy(name);
    setDuplicateError(undefined);
    try {
      await onReplaceTechnology(selected.solution.id, name, existing);
      setDuplicates(current => ({ ...current, [name]: { kind: "existing", existing } }));
    } catch {
      setDuplicateError({ name, message: "The technology was not replaced. Try again." });
    } finally { setDuplicateBusy(undefined); }
  };
  const keep = (name: string, kept: boolean) => setDuplicates(current => {
    const next = { ...current };
    if (kept) next[name] = { kind: "kept" }; else delete next[name];
    return next;
  });

  if (selectedId) {
    // A returned record opens in the review panel ("Waiting for corrections"); a plain draft is not the librarian's to see.
    if (!selected || (selected.solution.publicationStatus === "Draft" && selected.solution.reviewOutcome !== "Changes requested")) return <div className="mx-auto max-w-[1340px] px-6 py-10">
      <button type="button" onClick={() => navigate("/review")} className="inline-flex cursor-pointer items-center gap-2 text-[14px]"><Icon name="chevronLeft" />Review queue</button>
      <h1 className="mt-6 text-[26px]">{selected ? "Draft" : "Submission unavailable"}</h1>
      <p role="status" className="mt-3">{selected ? "This submission is with its contributor for editing." : "This submission is no longer available for review."}</p>
    </div>;

    return <DetailView solution={selected.solution} present={false} onBack={() => navigate("/review")} backLabel="Review queue" assetBasePath={`/review/${selected.solution.id}`} reviewActions={
      <ReviewPanel local status={selected.solution.publicationStatus} owner={selected.owner} client={selected.solution.clientContext} context={selected.solution.clientContextRedacted} feedback={selected.solution.reviewComments}
        solution={selected.solution} checks={reviewChecklist(submissionFacts(selected.solution))}
        comments={comments} onComments={setComments} cleared={clientSafe} onCleared={setClientSafe} busy={saving} notice={notice} error={error} onReturn={() => void decide("return")} onApprove={() => void decide("publish")}>
        <DuplicateTechnologies technologies={selected.solution.technologies} decisions={duplicates} busy={duplicateBusy} error={duplicateError}
          suspects={newTechnologies(selected.solution.technologies, new Set(published.filter(other => other.id !== selected.solution.id).flatMap(other => other.technologies)), [...new Set(published.flatMap(other => other.technologies))])}
          editable={!!onReplaceTechnology && !saving && (selected.solution.publicationStatus === "Pending review" || selected.solution.publicationStatus === "Published")}
          onUseExisting={(name, existing) => void replaceWithExisting(name, existing)} onKeep={name => keep(name, true)} onUndoKeep={name => keep(name, false)} />
      </ReviewPanel>
    } />;
  }

  return <ReviewQueue entries={entries} capabilityAreas={Object.fromEntries(CAPABILITIES.map(({ name, area }) => [name, area]))} />;
}