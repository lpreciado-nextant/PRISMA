/**
 * Whether present mode should open on the viewer's saved solutions ("Present these solutions" in Saved solutions)
 * rather than the whole client-safe catalogue. Per tab and per session; the masthead's present switch clears it.
 */
const KEY = "prisma.present.selection";

export function presentingSelection(): boolean {
  try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setPresentingSelection(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch { void 0; }
}
