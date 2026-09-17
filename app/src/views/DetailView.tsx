import type { AssetType, DemoAsset, Solution } from "../types";
import { AREAS } from "../data/solutions";
import { AreaTag, Chip, StatusPill } from "../components/Badges";
import { Icon } from "../components/Icon";
import { Poster } from "../components/Poster";
import { navigate } from "../lib/router";

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
      note: "Rendered in a sandboxed frame from the Dataverse File column.",
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

export function DetailView({ solution, present }: { solution: Solution; present: boolean }) {
  const area = AREAS[solution.specializationArea];
  const assets = [...solution.assets].sort((a, b) => a.sortOrder - b.sortOrder);
  const clientLine = present ? solution.clientContextRedacted : solution.clientContext;

  return (
    <div className="animate-rise mx-auto w-full max-w-[1340px] px-4 pt-8 pb-24 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex cursor-pointer items-center gap-1.5 text-[13.5px] font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--ink-2)" }}
      >
        <Icon name="chevronLeft" size={15} />
        Back to the library
      </button>

      <section className="glass glass-lite glass-sheen mt-4 overflow-hidden rounded-[26px]">
        <Poster
          id={solution.id}
          name={solution.name}
          area={solution.specializationArea}
          src={solution.thumbnail}
          className="h-40 sm:h-52"
        />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <AreaTag area={solution.specializationArea} size="md" />
            <StatusPill status={solution.status} />
            {!present && solution.shareable === "No – internal only" && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.1em] uppercase"
                style={{
                  color: "var(--proto)",
                  borderColor: "color-mix(in srgb, var(--proto) 40%, transparent)",
                  background: "color-mix(in srgb, var(--proto) 12%, transparent)",
                }}
              >
                <Icon name="shield" size={11} />
                Internal only
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
            className={`mt-3 max-w-[62ch] ${present ? "text-[20px]" : "text-[17.5px]"}`}
            style={{ color: "var(--ink-2)" }}
          >
            {solution.summary}
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          <Panel title="What it does">
            <p className={present ? "text-[17px]" : "text-[15.5px]"}>{solution.whatItDoes}</p>
          </Panel>
          <Panel title="Why it matters">
            <p className={present ? "text-[17px]" : "text-[15.5px]"}>{solution.businessValue}</p>
          </Panel>

          {solution.images && solution.images.length > 0 && (
            <Panel title={`Screenshots · ${solution.images.length}`}>
              <div className="grid gap-3 sm:grid-cols-2">
                {solution.images.map((img) => (
                  <figure key={img.id} className="m-0 overflow-hidden rounded-[14px] border" style={{ borderColor: "var(--glass-edge)" }}>
                    <img
                      src={img.src}
                      alt={img.caption ?? `${solution.name} screenshot`}
                      loading="lazy"
                      className="aspect-[16/10] w-full object-cover"
                    />
                    {img.caption && (
                      <figcaption className="px-3 py-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                        {img.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Demo assets">
            <ul className="flex flex-col gap-3">
              {assets.map((asset) => (
                <AssetRow key={asset.id} solution={solution} asset={asset} />
              ))}
            </ul>
          </Panel>

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
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Built on">
            <div className="flex flex-wrap gap-1.5">
              {solution.technologies.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          </Panel>

          <Panel title="At a glance">
            <dl className="flex flex-col gap-3 text-[14px]">
              <Row label="Built by">
                {present ? (
                  solution.builtBy.name
                ) : (
                  <a href={`mailto:${solution.builtBy.email}`} style={{ color: "var(--accent)" }}>
                    {solution.builtBy.name}
                  </a>
                )}
              </Row>
              <Row label="Area">{area.name}</Row>
              <Row label="Effort">{solution.effort}</Row>
              {clientLine && <Row label="Context">{clientLine}</Row>}
              <Row label="Sample data">{solution.sampleDataLevel}</Row>
              {!present && <Row label="Added">{solution.dateAdded}</Row>}
              <Row label="Industries">{solution.industries.join(" · ")}</Row>
            </dl>
          </Panel>

          {!present && solution.projects && solution.projects.length > 0 && (
            <Panel title={`Delivered for · ${solution.projects.length}`}>
              <ul className="flex flex-col gap-2.5 text-[14px]">
                {solution.projects.map((p) => (
                  <li key={p.id}>
                    <span className="block font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {p.projectName}
                    </span>
                    {p.projectOwner && (
                      <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                        Project owner · {p.projectOwner}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-3)" }}>
                Client engagements · hidden in present mode
              </p>
            </Panel>
          )}

          {!present && (
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
                  Notifies {solution.builtBy.name} in Teams
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass glass-lite glass-sheen rounded-[20px] p-6">
      <h2 className="eyebrow mb-3">{title}</h2>
      <div style={{ color: "var(--ink-2)" }}>{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 font-mono text-[10.5px] tracking-[0.1em] uppercase" style={{ color: "var(--ink-3)" }}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1" style={{ color: "var(--ink)" }}>
        {children}
      </dd>
    </div>
  );
}

function AssetRow({ solution, asset }: { solution: Solution; asset: DemoAsset }) {
  const behaviour = behaviourFor(asset);

  const act = () => {
    if (behaviour.mode === "viewer") {
      navigate(`/s/${solution.id}/demo/${asset.id}`);
    } else if (behaviour.mode === "external" && asset.externalUrl) {
      window.open(asset.externalUrl, "_blank", "noopener,noreferrer");
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
        <span className="block text-[14.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          {asset.name}
        </span>
        <span className="block text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          {asset.assetType}
          {behaviour.note ? ` · ${behaviour.note}` : ""}
        </span>
      </span>
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
        {behaviour.label}
      </button>
    </li>
  );
}
