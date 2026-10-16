import { useId } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * What a librarian needs to know before editing someone else's solution (ADR-0013), as an informational card in the
 * owner status panel's idiom: accent tint, icon, heading and one short line per rule. Published edits add the
 * present-mode rule in the warning tone, because it is the one with a visible consequence.
 */
export function LibrarianEditNotice({ published }: { published: boolean }) {
  const heading = useId();
  const rules: { icon: IconName; text: string; tone?: string }[] = [
    { icon: "clock", text: published ? "It stays published while you edit." : "It stays in Pending review while you edit." },
    { icon: "users", text: "Contributors stay with the owner; everything else is yours to correct." },
    { icon: "message", text: "When you save, you go back to the review to tell the owner what you changed and why." },
    ...(published ? [{ icon: "eyeOff" as const, text: "Until you confirm the changes there, it is left out of present mode.", tone: "var(--proto)" }] : []),
  ];
  return <section role="note" aria-labelledby={heading} className="mt-5 rounded-[18px] border px-4 py-3.5 sm:px-5"
    style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}><Icon name="info" size={16} /></span>
      <div className="min-w-0">
        <h2 id={heading} className="text-[15.5px] leading-tight font-semibold" style={{ color: "var(--accent)" }}>You're editing as librarian</h2>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-(--ink-2)">
          {rules.map(rule => <li key={rule.text} className="flex items-start gap-2" style={rule.tone ? { color: rule.tone } : undefined}>
            <Icon name={rule.icon} size={14} className="mt-0.5 shrink-0" />{rule.text}
          </li>)}
        </ul>
      </div>
    </div>
  </section>;
}
