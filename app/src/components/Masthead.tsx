import { Icon } from "./Icon";
import { initials, type AppUser } from "../lib/powerContext";
import type { Theme } from "../lib/theme";
import { navigate } from "../lib/router";

export function Masthead({
  user,
  theme,
  onToggleTheme,
  present,
  onTogglePresent,
}: {
  user: AppUser;
  theme: Theme;
  onToggleTheme: () => void;
  present: boolean;
  onTogglePresent: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="glass glass-sheen mx-auto flex min-h-16 w-full max-w-[1340px] flex-wrap items-center gap-2 rounded-[20px] px-3 py-2 sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-5 sm:py-0">
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
          <span className="flex flex-col items-start gap-0.5 lg:flex-row lg:items-center lg:gap-3">
            <span className="prisma-wordmark text-[21px] leading-none">PRISMA</span>
            <span
              className="hidden h-5 w-px lg:block"
              style={{ background: "var(--glass-edge-hi)" }}
              aria-hidden="true"
            />
            <span className="flex items-center gap-1.5">
              <span className="eyebrow text-[9px] normal-case">by</span>
              <img
                src={`./nextant-logo-${theme}.png`}
                alt="Nextant"
                className="h-[13px] w-auto lg:h-[15px]"
                style={{ transition: "opacity 0.4s ease" }}
              />
            </span>
          </span>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {!present && <button type="button" onClick={() => navigate("/my-submissions")} title="My submissions" aria-label="My submissions" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13.5px] font-semibold" style={{ borderColor: "var(--glass-edge)", color: "var(--ink-2)" }}>
            <Icon name="file" size={15} /><span className="hidden whitespace-nowrap md:inline">My submissions</span>
          </button>}
          {!present && (
            <button
              type="button"
              title="Submit a solution"
              aria-label="Submit a solution"
              onClick={() => navigate("/submit")}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13.5px] font-semibold transition-colors duration-200"
              style={{
                fontFamily: "var(--font-display)",
                borderColor: "var(--glass-edge)",
                background: "color-mix(in srgb, var(--ink) 6%, transparent)",
                color: "var(--ink-2)",
              }}
            >
              <Icon name="plus" size={15} />
              <span className="hidden whitespace-nowrap md:inline">Submit a solution</span>
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
              className="hidden items-center gap-2.5 rounded-xl border py-1.5 pr-3.5 pl-1.5 lg:flex"
              style={{
                borderColor: "var(--glass-edge)",
                background: "color-mix(in srgb, var(--ink) 6%, transparent)",
              }}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-medium"
                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
              >
                {initials(user.fullName)}
              </span>
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
  );
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
      <span className="hidden whitespace-nowrap sm:inline">
        {present ? "Present mode on" : "Present mode"}
      </span>
      <span
        className="relative hidden h-4 w-7 rounded-full transition-colors duration-300 sm:block"
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
