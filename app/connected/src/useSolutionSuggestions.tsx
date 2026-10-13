import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../src/components/Icon";
import { loadSuggestions, type SuggestionApi, type SuggestionList } from "./suggestions";
import { SuggestForm, SuggestionsPanel, suggestionButton } from "./SolutionSuggestions";

/**
 * Private suggestions on a published solution. The owner, contributors and the PRISMA Librarian get a
 * "Suggestions" panel; everyone else gets "Suggest a change". The server decides who is who. Nothing here
 * runs in present mode: the caller passes `enabled={false}` and gets no action and no panel.
 */
export function useSolutionSuggestions(api: SuggestionApi | undefined, solutionId: string, enabled: boolean): { action: ReactNode; panel: ReactNode } {
  const [list, setList] = useState<SuggestionList | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!api || !enabled) return;
    const controller = new AbortController();
    void loadSuggestions(api, solutionId, controller.signal).then(setList).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [api, solutionId, enabled]);
  if (!api || !enabled) return { action: null, panel: null };
  if (failed) return { action: null, panel: null };
  if (!list) return { action: null, panel: null };
  if (list.canRead) return { action: null, panel: <SuggestionsPanel list={list} /> };
  return {
    action: <button type="button" className={suggestionButton} disabled={open} onClick={() => { setOpen(true); setSent(false); }}><Icon name="edit" size={16} />Suggest a change</button>,
    panel: open ? <SuggestForm api={api} solutionId={solutionId} onClose={() => setOpen(false)} onSent={() => { setOpen(false); setSent(true); }} />
      : sent ? <p role="status" className="text-[14px] text-(--ink-2)">Thanks. Your suggestion was sent to the owner, the contributors and the librarian.</p> : null,
  };
}

