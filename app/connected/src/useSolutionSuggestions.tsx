import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../src/components/Icon";
import { loadSuggestions, type SuggestionApi, type SuggestionList } from "./suggestions";
import { SuggestForm, SuggestionsPanel, suggestionButton } from "./SolutionSuggestions";

/**
 * Private suggestions on a published solution. Everyone gets "Suggest a change"; the owner, contributors and the
 * PRISMA Librarian also get the "Suggestions" panel. The server decides who may read. Nothing here runs in present
 * mode: the caller passes `enabled={false}` and gets no action and no panel.
 */
export function useSolutionSuggestions(api: SuggestionApi | undefined, solutionId: string, enabled: boolean): { action: ReactNode; panel: ReactNode } {
  const [list, setList] = useState<SuggestionList | null>(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!api || !enabled) return;
    const controller = new AbortController();
    // A failed read only hides the panel; sending still works.
    void loadSuggestions(api, solutionId, controller.signal).then(setList).catch(() => undefined);
    return () => controller.abort();
  }, [api, solutionId, enabled, version]);
  if (!api || !enabled) return { action: null, panel: null };
  const form = open ? <SuggestForm api={api} solutionId={solutionId} onClose={() => setOpen(false)} onSent={() => { setOpen(false); setSent(true); setVersion(current => current + 1); }} />
    : sent ? <p role="status" className="text-[14px] text-(--ink-2)">Thanks. Your suggestion was sent to the owner, the contributors and the librarian.</p> : null;
  return {
    action: <button type="button" className={suggestionButton} disabled={open} onClick={() => { setOpen(true); setSent(false); }}><Icon name="edit" size={16} />Suggest a change</button>,
    panel: form || list?.canRead ? <>{form}{list?.canRead && <SuggestionsPanel list={list} />}</> : null,
  };
}
