import { useState } from "react";
import { Icon } from "../components/Icon";
import { ReviewPanel, ReviewQueue } from "../components/ReviewQueue";
import type { SubmissionEntry } from "../lib/submissions";
import { navigate } from "../lib/router";
import { DetailView } from "./DetailView";

export function ReviewView({ entries, selectedId, onDecision }: {
  entries: SubmissionEntry[];
  selectedId?: string;
  onDecision: (id: string, decision: "publish" | "return", comments: string, clientSafe: boolean) => Promise<void>;
}) {
  const [comments, setComments] = useState("");
  const [clientSafe, setClientSafe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

  if (selectedId) {
    if (!selected || selected.solution.publicationStatus === "Draft") return <div className="mx-auto max-w-[1340px] px-6 py-10">
      <button type="button" onClick={() => navigate("/review")} className="inline-flex cursor-pointer items-center gap-2 text-[14px]"><Icon name="chevronLeft" />Review queue</button>
      <h1 className="mt-6 text-[26px]">{selected ? selected.solution.reviewOutcome === "Changes requested" ? "Changes requested" : "Draft" : "Submission unavailable"}</h1>
      <p role="status" className="mt-3">{selected ? "This submission is with its contributor for editing." : "This submission is no longer available for review."}</p>
      {selected?.solution.reviewComments && <p className="mt-4 whitespace-pre-wrap break-words border-l-2 pl-4" style={{ borderColor: "var(--proto)" }}>{selected.solution.reviewComments}</p>}
    </div>;

    return <DetailView solution={selected.solution} present={false} onBack={() => navigate("/review")} backLabel="Review queue" assetBasePath={`/review/${selected.solution.id}`} reviewActions={
      <ReviewPanel local status={selected.solution.publicationStatus} owner={selected.owner} client={selected.solution.clientContext} context={selected.solution.clientContextRedacted} feedback={selected.solution.reviewComments}
        comments={comments} onComments={setComments} cleared={clientSafe} onCleared={setClientSafe} busy={saving} notice={notice} error={error} onReturn={() => void decide("return")} onApprove={() => void decide("publish")} />
    } />;
  }

  return <ReviewQueue entries={entries} />;
}