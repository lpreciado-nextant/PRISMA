import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Form guidance, styled as information rather than a control: an accent line on the left only, a faint tint, an icon and the heading run into one short line. */
export function Notice({ icon, tone, title, children }: { icon: IconName; tone: string; title: string; children: ReactNode }) {
  return <div className="flex items-start gap-2.5 rounded-r-md border-l-[3px] py-1.5 pr-3 pl-3" style={{ borderColor: tone, background: `color-mix(in srgb, ${tone} 5%, transparent)` }}>
    <span className="mt-px shrink-0" style={{ color: tone }}><Icon name={icon} size={14} /></span>
    <p className="min-w-0 text-[12.5px] leading-snug text-(--ink-2)"><span className="font-semibold text-(--ink-2)">{title}</span> · {children}</p>
  </div>;
}
