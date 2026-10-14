import { readAll, type ReadRows } from "./catalogue.ts";

/** The consultant who owns a capability (`nx_capability.nx_capabilityowner` → `cr6b0_consultant`). */
export interface CapabilityOwner { name: string; email?: string }

const guid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
let owners: Promise<Map<string, string | null>> | undefined;

/**
 * Capability name → owner consultant id (`null` when none is assigned). Read once per session; capability names are
 * unique. The shared read has its own signal: a caller that unmounts (React StrictMode mounts effects twice) must not
 * cancel it for the caller that is still waiting.
 */
function ownerIds(read: ReadRows): Promise<Map<string, string | null>> {
  owners ??= readAll(read, "capabilities", { select: ["nx_capabilityname", "_nx_capabilityowner_value"], filter: "statecode eq 0" }, new AbortController().signal).then(rows => new Map(rows.flatMap(row => {
    const values = row as Record<string, unknown>;
    if (typeof values.nx_capabilityname !== "string") return [];
    const owner = values._nx_capabilityowner_value;
    return [[values.nx_capabilityname, typeof owner === "string" && guid.test(owner) ? owner : null] as const];
  }))).catch(error => { owners = undefined; throw error; });
  return owners;
}

/**
 * The owner of the named capability: `null` when the capability names none; `undefined` when it cannot be known (the
 * capability is not listed, or the owner is not an active consultant). Never substitutes a submitter or contributor.
 */
export async function loadCapabilityOwner(read: ReadRows, capability: string, signal: AbortSignal): Promise<CapabilityOwner | null | undefined> {
  const ids = await ownerIds(read);
  signal.throwIfAborted();
  if (!ids.has(capability)) return undefined;
  const id = ids.get(capability);
  if (!id) return null;
  const [person] = await readAll(read, "people", { select: ["cr6b0_consultantname", "cr6b0_email"], filter: `cr6b0_consultantid eq ${id} and statecode eq 0` }, signal) as Record<string, unknown>[];
  if (!person || typeof person.cr6b0_consultantname !== "string" || !person.cr6b0_consultantname.trim()) return undefined;
  return { name: person.cr6b0_consultantname.trim(), ...(typeof person.cr6b0_email === "string" && person.cr6b0_email.trim() ? { email: person.cr6b0_email.trim() } : {}) };
}

/** Test seam: forget the cached capability list. */
export function resetCapabilityOwners() { owners = undefined; }
