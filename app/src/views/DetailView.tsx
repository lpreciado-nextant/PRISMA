import { useState } from "react";
import type { AssetType, DemoAsset, Solution } from "../types";
import { AreaTag, Chip, StatusPill } from "../components/Badges";
import { outlinedStatusButton, SubmissionStatusPanel } from "../components/SubmissionStatusPanel";
import { submissionState } from "../lib/submissionState";
import { assetPurpose, type AssetPurpose } from "../lib/assetPurpose";
import { Icon } from "../components/Icon";
import { Poster } from "../components/Poster";
import { navigate } from "../lib/router";
import { assetTypeLabel } from "../lib/linkedAssets";
import { DemoStage } from "../components/DemoStage";
import { solutionAreas } from "../lib/areas";
import { FavoriteButton } from "../components/FavoriteButton";
import { Lightbox } from "../components/Lightbox";

type Behaviour = {
  label: string;
  icon: "play" | "external" | "download" | "mail";
  mode: "viewer" | "external" | "download" | "request";
  note?: string;
};

/** Mirrors the asset-behaviour table in the end-to-end design. */
function behaviourFor(asset: DemoAsset): Behaviour {
  const map: Record<AssetType, Behaviour> = {
    "Self-contained HTML file": {
      label: "Open demo",
      icon: "play",
      mode: "viewer",
      note: "Rendered in a sandboxed frame from protected PRISMA storage.",
    },
    "Hosted web app (URL)": asset.allowsEmbedding
      ? { label: "Open demo", icon: "play", mode: "viewer", note: "Embedded live over the network." }
      : { label: "Open in new tab", icon: "external", mode: "external", note: "This app refuses to render in a frame." },
    "Power Apps": {
      label: "Open in new tab",
      icon: "external",
      mode: "external",
      note: "Power Apps sign-in stalls inside a frame, so this always pops out.",
    },
    "Power BI": {
      label: "Open in Power BI",
      icon: "external",
      mode: "external",
      note: "Deep-linked rather than embedded.",
    },
    "Video walkthrough only": {
      label: "Play walkthrough",
      icon: "play",
      mode: "viewer",
      note: "The universal fallback — plays inline.",
    },
    "Desktop app or script": {
      label: "Request a live demo",
      icon: "mail",
      mode: "request",
      note: "Not runnable in the browser.",
    },
    "Client-ready one-pager / slide": {
      label: "Download",
      icon: "download",
      mode: "download",
      note: "Client-safe collateral.",
    },
  };
  return map[asset.assetType];
}

export function DetailView({ solution, present, onEdit, onBack, backLabel, actions, reviewActions, assetBasePath, catalogueOnly = false, connected = false, effort, gallery, imageCount, onAssetOpen, poster, favoritable = false, favorite, panels, aside, capabilityOwner, assetNewTabUrl }: {
  /** "Open in new tab" for demos shown in the viewer (connected: the focused viewer in another browser tab). */
  assetNewTabUrl?: (asset: DemoAsset) => string | undefined;
  /** The capability's owner (`nx_capability.nx_capabilityowner`): `null` shows "Not assigned", omitted hides the row. Never in present mode. */
  capabilityOwner?: { name: string; email?: string } | null;
  solution: Solution; present: boolean; favoritable?: boolean; onEdit?: () => void; onBack?: () => void;
  backLabel?: string; actions?: React.ReactNode; reviewActions?: React.ReactNode; assetBasePath?: string;
  /** Extra internal panels in the main column (connected: suggestions). Never rendered in present mode. */
  panels?: React.ReactNode;
  /** Extra internal block at the end of the side column (connected: Suggest a change). Never rendered in present mode. */
  aside?: React.ReactNode;
  catalogueOnly?: boolean;
  connected?: boolean;
  /** Connected: contributor credit read from Dataverse. Effort itself is on the solution (estimate and complexity). */
  effort?: { contributors: { name: string; email?: string; level?: string }[] };
  gallery?: React.ReactNode;
  poster?: React.ReactNode;
  imageCount?: number;
  onAssetOpen?: (asset: DemoAsset) => void;
  /** Controls the favorite heart instead of the PoC's local browser-only store. */
  favorite?: { saved: boolean; pending?: boolean; onToggle: () => void; saves?: number };
}) {
  const areas = solutionAreas(solution);
  const assets = [...solution.assets].sort((a, b) => a.sortOrder - b.sortOrder);
  // The main demo, shown above the fold, is the first demo video, else the first interactive demo (ADR-0011); the
  // sections below hold the rest. Connected mode (onAssetOpen) loads asset content on demand, so it lists every asset.
  const mainDemo = catalogueOnly || onAssetOpen ? undefined
    : assets.find((asset) => assetPurpose(asset) === "Demo video") ?? assets.find((asset) => assetPurpose(asset) === "Interactive demo");
  const inlineDemo = mainDemo && behaviourFor(mainDemo).mode === "viewer" ? mainDemo : undefined;
  const assetSections = ASSET_SECTIONS.map((section) => ({ ...section, items: assets.filter((asset) => asset !== mainDemo && assetPurpose(asset) === section.purpose) })).filter((section) => section.items.length > 0);
  const clientLine = present ? solution.clientContextRedacted : solution.clientContext;
  // Everyone who contributed, CSMs included, with their directory level (`cr6b0_consultantlevel`; there is no
  // per-solution contributor role). Effort is estimated for the whole solution, not per person (ADR-0014).
  const people = effort ? effort.contributors : solution.contributors.map((contributor) => ({ name: contributor.builtBy.name, email: contributor.builtBy.email, level: contributor.builtBy.level }));

  return (
    <div className="animate-rise mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6 [overflow-wrap:anywhere]">
      <button
        type="button"
        onClick={() => onBack ? onBack() : navigate(onEdit ? "/my-submissions" : "/")}
        className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}
      >
        <Icon name="chevronLeft" size={15} />
        {backLabel ?? (onEdit ? "My submissions" : "Back to the library")}
      </button>
      {onEdit && <SubmissionStatusPanel state={submissionState(solution)} feedback={solution.reviewComments || undefined} local={!connected}
        actions={<button type="button" className={outlinedStatusButton} onClick={onEdit}><Icon name="edit" size={16} />Edit submission</button>} />}
      {reviewActions}
      {catalogueOnly && <p className="mt-4 text-[14px]" role="status" style={{ color: "var(--ink-2)" }}>Contributor details, media and delivery history are not loaded.</p>}

      {/* Title and summary beside the whole 16:9 thumbnail (the frame chosen at submission); stacked on small screens. */}
      <section className="glass glass-lite glass-sheen mt-4 grid overflow-hidden rounded-[26px] lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)] lg:items-center">
        <div className="p-4 pb-0 lg:order-last lg:p-6 lg:pl-0">
          <div className="aspect-[16/9] overflow-hidden rounded-[18px]" style={{ boxShadow: "0 0 0 1px var(--glass-edge), 0 22px 50px -28px rgba(0, 0, 0, 0.6)" }}>
            {poster ?? <Poster
              id={solution.id}
              name={solution.name}
              area={solution.specializationArea}
              src={solution.thumbnail}
              className="h-full w-full"
            />}
          </div>
        </div>
        <div className="p-6 sm:p-8 lg:flex lg:flex-col lg:self-stretch lg:pt-6">
          {((favoritable && !present) || actions) && <div className="mb-4 flex flex-wrap items-center gap-2">
            {favoritable && !present && <FavoriteButton id={solution.id} name={solution.name} saved={favorite?.saved} pending={favorite?.pending} onToggle={favorite?.onToggle} count={favorite?.saves} />}
            {actions}
          </div>}
          <div className="flex flex-wrap items-center gap-2.5 lg:mt-auto">
            {areas.map((area) => <AreaTag key={area} area={area} size="md" />)}
            <StatusPill status={solution.status} />
            {!present && !solution.clientSafeReviewed && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.1em] uppercase"
                style={{
                  color: "var(--proto)",
                  borderColor: "color-mix(in srgb, var(--proto) 40%, transparent)",
                  background: "color-mix(in srgb, var(--proto) 12%, transparent)",
                }}
              >
                <Icon name="shield" size={11} />
                Not cleared for presentation
              </span>
            )}
          </div>

          <h1
            className={`mt-4 font-bold ${present ? "text-[clamp(2.4rem,4.4vw,3.4rem)]" : "text-[clamp(1.9rem,3.6vw,2.7rem)]"}`}
            style={{ letterSpacing: "-0.034em", lineHeight: 1.05 }}
          >
            {solution.name}
          </h1>
          <p
            className={`mt-3 max-w-[62ch] lg:mb-auto ${present ? "text-[20px]" : "text-[17.5px]"}`}
            style={{ color: "var(--ink-2)" }}
          >
            {solution.summary}
          </p>
        </div>
      </section>

      <div className="mt-6">
        <Panel title="What the solution does">
          <p className={present ? "text-[17px]" : "text-[15.5px]"}>{solution.whatItDoes}</p>
        </Panel>
      </div>

      {inlineDemo ? (
        <section aria-label={`${inlineDemo.name} — main demo`} className="glass glass-lite glass-sheen mt-6 overflow-hidden rounded-[20px]">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--glass-edge)" }}>
            <h2 className="eyebrow min-w-0 flex-1 break-words">Main demo · {inlineDemo.name}</h2>
            <button
              type="button"
              onClick={() => navigate(`${assetBasePath ?? `/s/${solution.id}`}/demo/${inlineDemo.id}`)}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
              style={{ borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}
            >
              Full screen
              <Icon name="external" size={13} />
            </button>
          </div>
          <div className="demo-stage-169">
            <DemoStage solution={solution} asset={inlineDemo} />
          </div>
        </section>
      ) : mainDemo && (
        <div className="mt-6">
          <Panel title="Main demo">
            <ul><AssetRow solution={solution} asset={mainDemo} basePath={assetBasePath} onOpen={onAssetOpen} newTabUrl={assetNewTabUrl?.(mainDemo)} /></ul>
          </Panel>
        </div>
      )}

      <div className="mt-6">
        <Panel title="Business value">
          <p className={present ? "text-[17px]" : "text-[15.5px]"}>{solution.businessValue}</p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {(gallery || (solution.images && solution.images.length > 0)) && (
            <Panel title={`Screenshots · ${imageCount ?? solution.images?.length ?? 0}`}>
              {gallery ?? <ImageGallery solution={solution} />}
            </Panel>
          )}

          {!catalogueOnly && assetSections.map((section) => <Panel key={section.purpose} title={`${mainDemo && assetPurpose(mainDemo) === section.purpose ? `More ${section.title.toLowerCase()}` : section.title} · ${section.items.length}`}>
            <ul className="flex flex-col gap-3">
              {section.items.map((asset) => (
                <AssetRow key={asset.id} solution={solution} asset={asset} basePath={assetBasePath} onOpen={onAssetOpen} newTabUrl={assetNewTabUrl?.(asset)} />
              ))}
            </ul>
          </Panel>)}

          {!present && (solution.challenges || solution.lessonsLearned) && (
            <Panel title="Challenges & lessons learned · internal only">
              <dl className="flex flex-col gap-4 text-[15px]">
                {solution.challenges && <div><dt className="eyebrow mb-1">Challenges</dt><dd className="whitespace-pre-wrap break-words">{solution.challenges}</dd></div>}
                {solution.lessonsLearned && <div><dt className="eyebrow mb-1">Lessons learned</dt><dd className="whitespace-pre-wrap break-words">{solution.lessonsLearned}</dd></div>}
              </dl>
            </Panel>
          )}

          {!present && solution.libraryNotes && (
            <div
              className="glass glass-lite rounded-[20px] p-5"
              style={{
                borderColor: "color-mix(in srgb, var(--proto) 35%, transparent)",
                background: "color-mix(in srgb, var(--proto) 9%, transparent)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon name="shield" size={14} />
                <span className="eyebrow">Library notes · internal only</span>
              </div>
              <p className="text-[14.5px]" style={{ color: "var(--ink-2)" }}>
                {solution.libraryNotes}
              </p>
              <p className="mt-2 font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-3)" }}>
                Field-level security · hidden in present mode
              </p>
            </div>
          )}

          {!present && panels}
        </div>

        {/* Side column. Client-facing facts first (overview, business context, technologies), then internal-only
            sections, which present mode drops entirely rather than leaving empty headings. */}
        <div className="flex flex-col gap-6">
          <section className="glass glass-lite glass-sheen rounded-[20px] px-6 py-5" aria-label="Solution details">
            <SideSection title="Solution overview" first>
              <dl className="flex flex-col gap-3 text-[14px]">
                <Field label={areas.length > 1 ? "Specialization areas" : "Specialization area"}>
                  <span className="flex flex-wrap gap-1.5">{areas.map((area) => <AreaTag key={area} area={area} size="xs" />)}</span>
                </Field>
                {solution.capabilities[0] && <Field label="Capability"><span className="font-semibold">{solution.capabilities[0]}</span></Field>}
                {/* The capability's owner, never the submitter or a contributor; internal, so never in present mode. */}
                {!present && capabilityOwner !== undefined && <Field label="Capability owner">
                  {capabilityOwner ? <Person name={capabilityOwner.name} email={capabilityOwner.email} /> : <span style={{ color: "var(--ink-3)" }}>Not assigned</span>}
                </Field>}
                {!present && solution.dateAdded && <Field label="Added">{solution.dateAdded}</Field>}
              </dl>
            </SideSection>

            {(solution.clientRole || solution.industries.length > 0 || clientLine) && <SideSection title="Business context">
              <dl className="flex flex-col gap-3 text-[14px]">
                {solution.clientRole && <Field label="Target role">{solution.clientRole}</Field>}
                {solution.industries.length > 0 && <Field label={solution.industries.length > 1 ? "Industries" : "Industry"}>
                  <span className="flex flex-wrap gap-1.5">{solution.industries.map((industry) => <Chip key={industry}>{industry}</Chip>)}</span>
                </Field>}
                {/* nx_clientcontext is the internal client name; present mode shows only the approved client-facing wording. */}
                {!present && solution.clientContext && <Field label="Client (internal)">{solution.clientContext}</Field>}
                {(present || solution.clientContext) && solution.clientContextRedacted && <Field label={present ? "Client context" : "Shown to clients as"}>{solution.clientContextRedacted}</Field>}
              </dl>
            </SideSection>}

            {solution.technologies.length > 0 && <SideSection title="Technologies used">
              <div className="flex flex-wrap gap-1.5">{solution.technologies.map((technology) => <Chip key={technology}>{technology}</Chip>)}</div>
            </SideSection>}
          </section>

          {!present && (!catalogueOnly || (solution.projects?.length ?? 0) > 0 || solution.estimatedCost !== undefined) && (
            <section className="glass glass-lite glass-sheen rounded-[20px] px-6 py-5" aria-label="Internal details">
              {!catalogueOnly && <SideSection title="Contributors & development effort" first>
                <ExpandableList limit={4} label="contributors" items={people.map((person, index) => (
                  <li key={index} className="flex items-start justify-between gap-3 text-[14px]">
                    <span className="min-w-0">
                      <span className="block font-semibold" style={{ color: "var(--ink)" }}>{person.email && /^[^\s@]+@[^\s@]+$/.test(person.email) ? <a href={`mailto:${encodeURIComponent(person.email)}`} style={{ color: "var(--accent)" }}>{person.name}</a> : person.name}</span>
                      {person.level && <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>{person.level}</span>}
                    </span>
                  </li>
                ))} />
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-(--glass-edge) pt-3">
                  <div className="min-w-0">
                    <dt className="font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-2)" }}>Complexity</dt>
                    <dd className="mt-1 font-mono text-[16px]" style={{ color: solution.complexity ? "var(--accent)" : "var(--ink-3)" }}>{solution.complexity ?? "Not set"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-2)" }}>Estimated minimum hours</dt>
                    <dd className="mt-1 font-mono text-[16px]" style={{ color: solution.estimatedMinimumHours === undefined ? "var(--ink-3)" : "var(--accent)" }}>{solution.estimatedMinimumHours === undefined ? "Not estimated" : `~${solution.estimatedMinimumHours.toLocaleString("en-US")} h`}</dd>
                  </div>
                </dl>
                <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>Estimated development effort for the whole solution{solution.status === "Client demo" ? "; demo effort only, production delivery may take longer." : "."}</p>
                {solution.estimatedCost !== undefined && <dl className="mt-3 text-[14px]"><Field label="Estimated cost">{solution.estimatedCost.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</Field></dl>}
              </SideSection>}

              {solution.projects && solution.projects.length > 0 && <SideSection title={`Associated projects · ${solution.projects.length}`} first={catalogueOnly}>
                <ExpandableList limit={4} label="projects" items={solution.projects.map((project) => (
                  <li key={project.id} className="text-[14px]">
                    <span className="block font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>{project.projectName}</span>
                    {project.projectOwner && <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>Project owner · {project.projectOwner}</span>}
                  </li>
                ))} />
              </SideSection>}
            </section>
          )}

          {!present && !catalogueOnly && !connected && (
            <button
              type="button"
              className="glass glass-sheen lift flex cursor-pointer items-center gap-3 rounded-[20px] p-5 text-left"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}
              >
                <Icon name="mail" size={18} />
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                  Request a live demo
                </span>
                <span className="block text-[13px]" style={{ color: "var(--ink-3)" }}>
                  Notifies {solution.contributors.map((contributor) => contributor.builtBy.name).join(", ")} in Teams
                </span>
              </span>
            </button>
          )}

          {!present && aside}
        </div>
      </div>
    </div>
  );
}

/** The PoC's bundled screenshots; the connected app passes its protected gallery instead. */
function ImageGallery({ solution }: { solution: Solution }) {
  const [open, setOpen] = useState<number | null>(null);
  const images = solution.images ?? [];
  const alt = (caption?: string) => caption ?? `${solution.name} screenshot`;
  return <>
    <div className="grid gap-3 sm:grid-cols-2">
      {images.map((img, index) => (
        <GalleryFigure key={img.id} caption={img.caption}>
          <button type="button" onClick={() => setOpen(index)} aria-label={`View ${alt(img.caption)} larger`} className="group block w-full cursor-zoom-in overflow-hidden">
            <img src={img.src} alt={alt(img.caption)} loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </button>
        </GalleryFigure>
      ))}
    </div>
    {open !== null && <Lightbox start={open} onClose={() => setOpen(null)} items={images.map((img) => ({
      id: img.id, caption: img.caption, label: alt(img.caption),
      content: <img src={img.src} alt={alt(img.caption)} className="max-h-full max-w-full object-contain" />,
      thumb: <img src={img.src} alt="" />,
    }))} />}
  </>;
}

export function GalleryFigure({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return <figure className="m-0 min-w-0 overflow-hidden rounded-[14px] border border-(--glass-edge)">{children}{caption && <figcaption className="break-words px-3 py-2 text-[12.5px] text-(--ink-3)">{caption}</figcaption>}</figure>;
}

/** One titled group inside a side-column card; groups after the first are set off by a hairline divider. */
function SideSection({ title, first = false, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section className={first ? "pt-1" : "mt-5 border-t border-(--glass-edge) pt-5"}>
      {/* The page's panel heading style, at full ink contrast so each group stands out in the dense side column. */}
      <h2 className="eyebrow mb-3" style={{ color: "var(--ink)" }}>{title}</h2>
      <div style={{ color: "var(--ink-2)" }}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-2)" }}>{label}</dt>
      <dd className="mt-1 break-words" style={{ color: "var(--ink)" }}>{children}</dd>
    </div>
  );
}

/** A compact person: initials, then the name (a mail link when the email is valid). */
function Person({ name, email }: { name: string; email?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}>{initials}</span>
      <span className="min-w-0 font-semibold" style={{ color: "var(--ink)" }}>
        {email && /^[^\s@]+@[^\s@]+$/.test(email) ? <a href={`mailto:${encodeURIComponent(email)}`} style={{ color: "var(--accent)" }}>{name}</a> : name}
      </span>
    </span>
  );
}

/** A list that shows its first `limit` items and folds the rest behind "Show N more". */
function ExpandableList({ items, limit, label }: { items: React.ReactNode[]; limit: number; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const hidden = items.length - limit;
  return (
    <>
      <ul className="flex flex-col gap-3">{expanded ? items : items.slice(0, limit)}</ul>
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="mt-2 cursor-pointer text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
          {expanded ? "Show fewer" : `Show ${hidden} more ${label}`}
        </button>
      )}
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass glass-lite glass-sheen rounded-[20px] p-6">
      <h2 className="eyebrow mb-3" style={{ color: "var(--ink)" }}>{title}</h2>
      <div style={{ color: "var(--ink-2)" }}>{children}</div>
    </section>
  );
}


const ASSET_SECTIONS: { purpose: AssetPurpose; title: string }[] = [
  { purpose: "Demo video", title: "Demo videos" },
  { purpose: "Interactive demo", title: "Interactive demos" },
  { purpose: "Supporting material", title: "Supporting material" },
];

function AssetRow({ solution, asset, basePath, onOpen, newTabUrl }: { solution: Solution; asset: DemoAsset; basePath?: string; onOpen?: (asset: DemoAsset) => void; newTabUrl?: string }) {
  const behaviour = behaviourFor(asset);

  const act = () => {
    if (onOpen) { onOpen(asset); return; }
    if (behaviour.mode === "viewer") {
      navigate(`${basePath ?? `/s/${solution.id}`}/demo/${asset.id}`);
    } else if (behaviour.mode === "external" && asset.externalUrl) {
      window.open(asset.externalUrl, "_blank", "noopener,noreferrer");
    } else if (behaviour.mode === "download" && asset.fileData) {
      const link = document.createElement("a");
      link.href = asset.fileData;
      link.download = asset.name;
      link.click();
    }
  };

  return (
    <li
      className="flex flex-wrap items-center gap-4 rounded-[16px] border p-4"
      style={{
        borderColor: "var(--glass-edge)",
        background: "color-mix(in srgb, var(--ink) 4%, transparent)",
      }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{
          background: "color-mix(in srgb, var(--accent) 16%, transparent)",
          color: "var(--accent)",
        }}
      >
        <Icon name={behaviour.icon === "play" ? "play" : behaviour.icon === "download" ? "download" : behaviour.icon === "mail" ? "mail" : "external"} size={17} />
      </span>
      <span className="min-w-[12rem] flex-1">
        <span className="block break-words text-[14.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          {asset.name}
        </span>
        <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {assetTypeLabel(asset.assetType)}
          {behaviour.note ? ` · ${behaviour.note}` : ""}
        </span>
      </span>
      {/* A demo shown in the viewer can also open on its own in another tab; the main action stays the in-app viewer. */}
      {newTabUrl && behaviour.mode === "viewer" && <a href={newTabUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${asset.name} in a new tab`} title="Open in new tab"
        className="grid size-9 shrink-0 place-items-center rounded-xl border" style={{ borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}><Icon name="external" size={15} /></a>}
      <button
        type="button"
        onClick={act}
        className="shrink-0 cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-semibold"
        style={{
          fontFamily: "var(--font-display)",
          background: "var(--accent)",
          color: "var(--on-accent)",
        }}
      >
        {onOpen && asset.assetType === "Desktop app or script" ? "Demo arrangements" : behaviour.label}
      </button>
    </li>
  );
}
