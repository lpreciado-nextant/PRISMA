import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { OverflowMenu } from "./OverflowMenu";
import { openFeedbackCount, useFeedbackSeen } from "../lib/feedbackSeen";
import { initials, type AppUser } from "../lib/powerContext";
import type { Theme } from "../lib/theme";
import { navigate, useRoute } from "../lib/router";

export function Masthead({
  user,
  theme,
  onToggleTheme,
  present,
  onTogglePresent,
  readOnly = false,
  draftOnly = false,
  reviewAvailable = !draftOnly,
  favoriteCount,
  reviewCount,
}: {
  user: AppUser;
  theme: Theme;
  onToggleTheme: () => void;
  present: boolean;
  onTogglePresent: () => void;
  readOnly?: boolean;
  draftOnly?: boolean;
  reviewAvailable?: boolean;
  /** When set, shows Saved solutions with this count in the section navigation (hidden in present mode). */
  favoriteCount?: number;
  /** Submissions awaiting review, shown on the Review queue tab (librarians only; hidden at zero or when unknown). */
  reviewCount?: number;
}) {
  const route = useRoute();
  const showNav = !present && !readOnly;
  return (
    <>
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      {/* A slim glass bar: branding, the primary action and utilities. The section tabs sit below it, on the page. */}
      <div className="glass glass-gloss @container mx-auto flex min-h-16 w-full max-w-[1340px] flex-wrap items-center gap-2 rounded-[20px] px-3 py-2 sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-0">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex shrink-0 cursor-pointer items-center gap-3 rounded-xl px-1.5 py-1"
          aria-label="PRISMA — back to the library"
        >
          <img
            src="./prisma-mark-v2.svg"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 -mr-1.5 translate-y-[1px]"
          />
          <span className="flex flex-col items-start gap-0.5 @[1240px]:flex-row @[1240px]:items-center @[1240px]:gap-3">
            <span className="prisma-wordmark text-[21px] leading-none">PRISMA</span>
            <span
              className="hidden h-5 w-px @[1240px]:block"
              style={{ background: "var(--glass-edge-hi)" }}
              aria-hidden="true"
            />
            <span className="flex items-center gap-1.5">
              <span className="eyebrow text-[9px] normal-case">by</span>
              <img
                src={`./nextant-logo-${theme}.png`}
                alt="Nextant"
                className="h-[13px] w-auto @[1240px]:h-[15px]"
                style={{ transition: "opacity 0.4s ease" }}
              />
            </span>
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {!present && !readOnly && (
            <button
              type="button"
              title={draftOnly ? "New draft" : "Submit a solution"}
              aria-label={draftOnly ? "New draft" : "Submit a solution"}
              onClick={() => navigate("/submit")}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-[13.5px] font-semibold transition-[filter] duration-200 hover:brightness-110"
              style={{ fontFamily: "var(--font-display)", background: "var(--accent)", color: "var(--on-accent)" }}
            >
              <Icon name="plus" size={15} />
              <span className="hidden whitespace-nowrap @[720px]:inline">{draftOnly ? "New draft" : "Submit a solution"}</span>
            </button>
          )}

          <PresentToggle present={present} onToggle={onTogglePresent} />

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border transition-colors duration-200"
            style={{
              borderColor: "var(--glass-edge)",
              background: "color-mix(in srgb, var(--ink) 6%, transparent)",
              color: "var(--ink-2)",
            }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>

          {!present && (
            <div
              className="hidden items-center gap-2.5 rounded-xl border py-1.5 pr-3.5 pl-1.5 @[880px]:flex"
              style={{
                borderColor: "var(--glass-edge)",
                background: "color-mix(in srgb, var(--ink) 6%, transparent)",
              }}
            >
              <UserAvatar key={`${user.userPrincipalName}:${user.photoUrl ?? ""}`} user={user} />
              <span className="leading-tight">
                <span
                  className="block max-w-[160px] truncate text-[13px] font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  {user.fullName}
                </span>
                <span
                  className="block font-mono text-[9.5px] tracking-[0.12em] whitespace-nowrap uppercase"
                  style={{ color: "var(--ink-3)" }}
                >
                  {user.live ? "Entra ID · signed in" : "Local preview"}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
    {showNav && <SectionNav path={route.path} favoriteCount={favoriteCount} reviewCount={reviewCount} draftOnly={draftOnly} reviewAvailable={reviewAvailable} />}
    </>
  );
}

type NavItem = { path: string; label: string; icon: IconName; active: boolean; count?: number; pending?: number; alert?: boolean };

/**
 * Section tabs under the header bar, on the page itself (they scroll with it): Library, Saved solutions (with its
 * count), My submissions, and Review queue only for librarians (the caller's existing role check; the server still
 * enforces it). An accent underline marks the current section. Below `sm`, Library and Saved solutions stay visible
 * and the rest move into a "More" menu.
 */
function SectionNav({ path, favoriteCount, reviewCount, draftOnly, reviewAvailable }: { path: string; favoriteCount?: number; reviewCount?: number; draftOnly: boolean; reviewAvailable: boolean }) {
  // A dot on My submissions while any feedback item is still open (no count: it invites a visit).
  useFeedbackSeen();
  const feedbackWaiting = openFeedbackCount() > 0;
  const items: NavItem[] = [
    { path: "/", label: "Library", icon: "grid", active: path === "/" || path.startsWith("/s/") },
    ...(favoriteCount !== undefined ? [{ path: "/favorites", label: "Saved solutions", icon: "heart" as const, active: path === "/favorites", count: favoriteCount }] : []),
    { path: "/my-submissions", label: draftOnly ? "My drafts" : "My submissions", icon: "folderOpen", active: path === "/my-submissions" || path.startsWith("/submission/") || path.startsWith("/submit"), alert: feedbackWaiting || undefined },
    ...(reviewAvailable ? [{ path: "/review", label: "Review queue", icon: "clipboardCheck" as const, active: path === "/review" || path.startsWith("/review/"), pending: reviewCount || undefined }] : []),
  ];
  const primary = items.slice(0, favoriteCount !== undefined ? 2 : 1);
  const rest = items.slice(primary.length);
  return (
    <nav aria-label="Sections" className="mx-auto mt-3 w-full max-w-[1340px] px-4 sm:px-6">
      <div className="flex h-11 items-stretch gap-1 border-b border-(--glass-edge) sm:gap-2">
        {items.map((item, index) => <NavLink key={item.path} item={item} className={index >= primary.length ? "hidden sm:inline-flex" : "inline-flex"} />)}
        {rest.length > 0 && <div className="ml-auto flex items-center sm:hidden">
          <OverflowMenu label="More sections" items={rest.map(item => ({ label: item.label, icon: item.icon, onSelect: () => navigate(item.path) }))} />
        </div>}
      </div>
    </nav>
  );
}

function NavLink({ item, className }: { item: NavItem; className: string }) {
  return (
    <a
      href={`#${item.path}`}
      onClick={(event) => { event.preventDefault(); navigate(item.path); }}
      aria-current={item.active ? "page" : undefined}
      className={`section-nav-link ${className} relative items-center gap-2 text-[15px] whitespace-nowrap`}
    >
      <Icon name={item.icon} size={18} filled={item.icon === "heart" && !!item.count} className={item.icon === "heart" && item.count ? "nav-heart-saved" : undefined} />
      {item.label}
      {item.count !== undefined && <span className="section-nav-count" aria-label={`${item.count} saved`}>{item.count}</span>}
      {item.alert && <span className="nav-alert-dot" role="img" aria-label="New feedback to review" />}
      {item.pending !== undefined && <span className="section-nav-count section-nav-count--pending" aria-label={`${item.pending} awaiting review`}>{item.pending}</span>}
    </a>
  );
}
function UserAvatar({ user }: { user: AppUser }) {
  const [failed, setFailed] = useState(false);
  return <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg font-mono text-[10px] font-medium"
    style={{ background: "var(--accent)", color: "var(--on-accent)" }} aria-hidden="true">
    {initials(user.fullName)}
    {user.photoUrl && !failed && <img src={user.photoUrl} alt="" width={28} height={28}
      className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />}
  </span>;
}

function PresentToggle({ present, onToggle }: { present: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Present mode"
      title="Present mode"
      aria-pressed={present}
      className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-[13.5px] font-semibold transition-all duration-300"
      style={{
        fontFamily: "var(--font-display)",
        borderColor: present ? "var(--accent)" : "var(--glass-edge)",
        background: present ? "var(--accent)" : "color-mix(in srgb, var(--ink) 6%, transparent)",
        color: present ? "var(--on-accent)" : "var(--ink-2)",
      }}
    >
      <Icon name="present" size={16} />
      <span className="hidden whitespace-nowrap @[560px]:inline">
        {present ? "Present mode on" : "Present mode"}
      </span>
      <span
        className="relative hidden h-4 w-7 rounded-full transition-colors duration-300 @[560px]:block"
        style={{
          background: present
            ? "color-mix(in srgb, var(--on-accent) 45%, transparent)"
            : "color-mix(in srgb, var(--ink) 16%, transparent)",
        }}
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full transition-all duration-300"
          style={{
            left: present ? "14px" : "2px",
            background: present ? "var(--on-accent)" : "var(--ink-2)",
          }}
        />
      </span>
    </button>
  );
}
