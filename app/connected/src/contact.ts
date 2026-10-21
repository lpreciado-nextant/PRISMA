/** The PRISMA team: who answers questions and reports of anything that looks wrong. Change the list here only; the help page never names them. */
export const PRISMA_CONTACTS = [
  { name: "Luis", email: "lpreciado@nextant.com" },
  { name: "Juliana", email: "jcastelblanco@nextant.com" },
] as const;

export type Contact = { name: string; email: string };

/**
 * A Teams group chat and an email to every contact, both prefilled. `page` is a play link (or route) to where the
 * person was before opening help, so a reported inconsistency arrives with its place.
 */
export function contactLinks(contacts: readonly Contact[], page?: string): { teams: string; email: string } {
  const emails = contacts.map(contact => contact.email);
  const where = page ? `\nPage: ${page}` : "";
  const teams = new URL("https://teams.microsoft.com/l/chat/0/0");
  teams.searchParams.set("users", emails.join(","));
  teams.searchParams.set("topicName", "PRISMA question");
  teams.searchParams.set("message", `Hi! I have a question about PRISMA.${where}`);
  const subject = encodeURIComponent("PRISMA: question or something looks wrong");
  const body = encodeURIComponent(`What happened or what is your question?\n\n\nWhat did you expect?\n\n${where.trim()}`.trimEnd() + "\n");
  return { teams: teams.toString(), email: `mailto:${emails.join(",")}?subject=${subject}&body=${body}` };
}
