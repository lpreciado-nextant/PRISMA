/** PRISMA, spelled out: Prototypes, References, Interactive Solutions, Models, Automations. */
const PRISMA_WORDS = ["Prototypes", "References", "Interactive Solutions", "Models", "Automations"];

/** The name's meaning under the wordmark; each word's initial carries the brand lavender, spelling PRISMA. */
export function PrismaAcronym({ className = "" }: { className?: string }) {
  return (
    <p className={`prisma-acronym ${className}`}>
      <span className="sr-only">{PRISMA_WORDS.join(", ")}</span>
      {PRISMA_WORDS.map((word, index) => (
        <span key={word} aria-hidden="true">
          {index > 0 && <span className="prisma-acronym-dot">·</span>}
          {word.split(" ").map((part, position) => <span key={part}>{position > 0 && " "}<b>{part[0]}</b>{part.slice(1)}</span>)}
        </span>
      ))}
    </p>
  );
}
