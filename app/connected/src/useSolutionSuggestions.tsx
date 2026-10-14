import { useEffect, useState, type ReactNode } from "react";
import { loadSuggestions, type SuggestionApi, type SuggestionList } from "./suggestions";
import { SuggestCard, SuggestForm, SuggestionsPanel } from "./SolutionSuggestions";

/**
 * Private suggestions on a published solution. Everyone gets "Suggest a change"; the owner, contributors and the
 * PRISMA Librarian also get the "Suggestions" panel. The server decides who may read. Nothing here runs in present
 * mode: the caller passes `enabled={false}` and gets no action and no panel.
 */
export function useSolutionSuggestions(api: SuggestionApi | undefined, solutionId: string, enabled: boolean): { action: ReactNode; panel: ReactNode } {
  const [list, setList] = useState<SuggestionList | null>(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  // After the form closes (sent or cancelled), the card that replaces it takes focus back.
  const [returned, setReturned] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!api || !enabled) return;
    const controller = new AbortController();
    // A failed read only hides the panel; sending still works.
    void loadSuggestions(api, solutionId, controller.signal).then(setList).catch(() => undefined);
    return () => controller.abort();
  }, [api, solutionId, enabled, version]);
  if (!api || !enabled) return { action: null, panel: null };
  // A card in the side column that opens its form in place; the readers' list stays in the main column.
  const action = open ? <SuggestForm api={api} solutionId={solutionId} onClose={() => { setOpen(false); setReturned(true); }} onSent={() => { setOpen(false); setReturned(true); setSent(true); setVersion(current => current + 1); }} />
    : <SuggestCard sent={sent} focus={returned} onOpen={() => { setOpen(true); setSent(false); }} />;
  return { action, panel: list?.canRead ? <SuggestionsPanel list={list} /> : null };
}
