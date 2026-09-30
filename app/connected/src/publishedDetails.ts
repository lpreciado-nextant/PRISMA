import { parsePublished, type PublishedDetail } from "./workflow.ts";

type Entry = { at: number; promise: Promise<PublishedDetail>; value?: PublishedDetail };

/**
 * One `nx_GetPublishedDetail` read per solution and projection, shared by cards, Top 10 tiles and the detail page.
 * Cards reuse a recent read; the detail page accepts only one started seconds earlier (a hover prefetch), so a
 * withdrawal or revoked access still shows there.
 */
export function createPublishedDetails(read: (id: string, present: boolean) => Promise<unknown>, maxAge = 5 * 60_000, limit = 200, now = () => Date.now()) {
  const entries = new Map<string, Entry>();
  const key = (id: string, present: boolean) => `${id}:${present}`;
  const refresh = (id: string, present: boolean): Promise<PublishedDetail> => {
    const name = key(id, present);
    const entry: Entry = { at: now(), promise: read(id, present).then(result => parsePublished(result, id, present)) };
    entries.delete(name);
    entries.set(name, entry);
    while (entries.size > limit) entries.delete(entries.keys().next().value!);
    // A failed read is forgotten, so nothing keeps serving a solution that became unavailable.
    entry.promise.then(value => { if (entries.get(name) === entry) entry.value = value; }, () => { if (entries.get(name) === entry) entries.delete(name); });
    return entry.promise;
  };
  return {
    load(id: string, present: boolean, age = maxAge): Promise<PublishedDetail> {
      const entry = entries.get(key(id, present));
      return entry && now() - entry.at < age ? entry.promise : refresh(id, present);
    },
    refresh,
    /** The last confirmed detail, for an immediate render while a read is in flight. */
    peek(id: string, present: boolean): PublishedDetail | undefined {
      return entries.get(key(id, present))?.value;
    },
  };
}
