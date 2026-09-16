import { Icon } from "./Icon";

export function PresentBanner({ onExit, hidden }: { onExit: () => void; hidden: number }) {
  return (
    <div
      className="animate-scale-in glass sticky top-24 z-30 mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-[1340px] items-center gap-3 rounded-[16px] px-4 py-2.5 sm:w-[calc(100%-3rem)]"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
        background: "color-mix(in srgb, var(--accent) 16%, transparent)",
      }}
      role="status"
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
      >
        <Icon name="shield" size={15} />
      </span>
      <p className="text-[13.5px] leading-snug" style={{ color: "var(--ink)" }}>
        <b style={{ fontFamily: "var(--font-display)" }}>Present mode is on.</b>{" "}
        <span style={{ color: "var(--ink-2)" }}>
          Client names are redacted, internal notes are hidden, and {hidden}{" "}
          {hidden === 1 ? "solution is" : "solutions are"} filtered out of the catalogue.
        </span>
      </p>
      <button
        type="button"
        onClick={onExit}
        className="ml-auto shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
          color: "var(--ink)",
        }}
      >
        Exit
      </button>
    </div>
  );
}
