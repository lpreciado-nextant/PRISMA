import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Solution } from "../../src/types";
import type { AppUser } from "../../src/lib/powerContext";
import { Background } from "../../src/components/Background";
import { Masthead } from "../../src/components/Masthead";
import { PresentBanner } from "../../src/components/PresentBanner";
import { Icon } from "../../src/components/Icon";
import { LibraryView } from "../../src/views/LibraryView";
import { navigate, replaceQuery, useRoute } from "../../src/lib/router";
import { filtersFromQuery, filtersToQuery } from "../../src/lib/search";
import { useTheme } from "../../src/lib/theme";
import { loadCatalogue } from "./catalogue";
import { getSignedInUser, getUserPhoto, readRows, workflowApi, favoriteApi } from "./dataSource";
import { parsePublished, workflowData } from "./workflow";
import { loadFavorites, setFavorite } from "./favorites";
import { DraftsView } from "./DraftsView";
import { SubmissionsView, SubmissionView } from "./SubmissionsView";
import { PublishedView } from "./PublishedView";
import { ConnectedSolutionCard } from "./ConnectedSolutionCard";
import { FavoritesView } from "./FavoritesView";
import { clearRecoveries } from "./draftRecovery";
import { WelcomeScreen } from "./WelcomeScreen";

const PRESENT_KEY = "prisma.connected.present";
async function readCredits(id: string, present: boolean, signal: AbortSignal) {
  // Present mode never exposes builder names, on cards or in search.
  if (present) return [];
  const response = await workflowApi.published(id, present);
  signal.throwIfAborted();
  return parsePublished(response, id, present).contributors.map(person => person.name);
}
type LoadState = { kind: "loading" } | { kind: "host-required" } | { kind: "error" } | { kind: "ready"; catalogue: Solution[] };

export default function ConnectedApp() {
  const [present, setPresent] = useState(() => {
    try { return sessionStorage.getItem(PRESENT_KEY) === "1"; } catch { return false; }
  });
  const [attempt, setAttempt] = useState(0);
  const [entry, setEntry] = useState<"welcome" | "illuminating" | "revealing" | "entered">("welcome");
  useEffect(() => {
    if (entry !== "illuminating" && entry !== "revealing") return;
    const timer = window.setTimeout(() => setEntry(entry === "illuminating" ? "revealing" : "entered"), entry === "illuminating" ? 220 : 600);
    return () => window.clearTimeout(timer);
  }, [entry]);
  const begin = () => {
    if (entry !== "welcome") return;
    setEntry(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "entered" : "illuminating");
  };
  const [theme, toggleTheme] = useTheme();
  const togglePresent = () => {
    const next = !present;
    if (next) { try { clearRecoveries(sessionStorage); } catch { void 0; } }
    setPresent(next);
    try { sessionStorage.setItem(PRESENT_KEY, next ? "1" : "0"); } catch { return; }
  };
  return <>
    <div inert={entry === "illuminating" || entry === "revealing"}>
      <CatalogueSession key={`${present}:${attempt}`} present={present} onTogglePresent={togglePresent}
        theme={theme} onToggleTheme={toggleTheme} onRetry={() => setAttempt(current => current + 1)}
        entered={entry === "revealing" || entry === "entered"} entering={entry === "illuminating"} onBegin={begin} transitionComplete={entry === "entered"} />
    </div>
    {(entry === "illuminating" || entry === "revealing") && <div className="welcome-flash" aria-hidden="true" />}
  </>;
}

function CatalogueSession({ present, onTogglePresent, theme, onToggleTheme, onRetry, entered, entering, onBegin, transitionComplete }: {
  present: boolean; onTogglePresent: () => void; theme: "light" | "dark";
  onToggleTheme: () => void; onRetry: () => void;
  entered: boolean; entering: boolean; onBegin: () => void; transitionComplete: boolean;
}) {
  const [user, setUser] = useState<AppUser>({ fullName: "Not signed in", userPrincipalName: "", live: false });
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [bannerVisible, setBannerVisible] = useState(true);
  const [librarian, setLibrarian] = useState(false);
  const [favorites, setFavorites] = useState<Set<string> | null>(null);
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(new Set());
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    if (transitionComplete) main.current?.focus({ preventScroll: true });
  }, [transitionComplete]);
  const route = useRoute();
  const previousPath = useRef(route.path);
  useEffect(() => {
    const controller = new AbortController();
    let authenticated = false;
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ kind: authenticated ? "error" : "host-required" });
    }, 20_000);
    async function load() {
      try {
        const signedInUser = await getSignedInUser();
        controller.signal.throwIfAborted();
        try {
          const identity = signedInUser.userPrincipalName.toLowerCase();
          if (sessionStorage.getItem("prisma.connected.recovery-owner") !== identity) clearRecoveries(sessionStorage);
          sessionStorage.setItem("prisma.connected.recovery-owner", identity);
          if (present) clearRecoveries(sessionStorage);
        } catch { void 0; }
        authenticated = true;
        setUser(signedInUser);
        const catalogue = await loadCatalogue(readRows, present, controller.signal, readCredits);
        controller.signal.throwIfAborted();
        setState({ kind: "ready", catalogue });
      } catch {
        if (!authenticated && !controller.signal.aborted) { try { clearRecoveries(sessionStorage); } catch { void 0; } }
        if (!controller.signal.aborted) setState({ kind: authenticated ? "error" : "host-required" });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [present]);
  useEffect(() => {
    if (present || !user.live || !user.userPrincipalName) return;
    const identity = user.userPrincipalName;
    let active = true;
    const timeout = window.setTimeout(() => { active = false; }, 10_000);
    void getUserPhoto(identity).then(photoUrl => {
      if (active && photoUrl) setUser(current => current.userPrincipalName === identity ? { ...current, photoUrl } : current);
    }).finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); };
  }, [present, user.live, user.userPrincipalName]);
  useEffect(() => {
    if (present || !user.live) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    void workflowApi.list(false, 1).then(result => {
      if (!controller.signal.aborted) setLibrarian(workflowData(result).librarian === true);
    }).catch(() => { if (!controller.signal.aborted) setLibrarian(false); }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [present, user.live]);
  useEffect(() => {
    // Present mode never shows favorites (the masthead link and card hearts hide themselves).
    if (present || !user.live) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    void loadFavorites(favoriteApi, controller.signal).then(ids => {
      if (!controller.signal.aborted) setFavorites(ids);
    }).catch(() => { if (!controller.signal.aborted) setFavorites(null); }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [present, user.live]);
  const toggleFavorite = (id: string) => {
    if (!favorites || pendingFavorites.has(id)) return;
    const next = !favorites.has(id);
    setPendingFavorites(current => new Set(current).add(id));
    setFavorites(current => { const updated = new Set(current); if (next) updated.add(id); else updated.delete(id); return updated; });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    void setFavorite(favoriteApi, id, next, controller.signal).then(confirmed => {
      setFavorites(current => { const updated = new Set(current ?? []); if (confirmed) updated.add(id); else updated.delete(id); return updated; });
    }).catch(() => {
      // Roll back the optimistic update; the heart returns to its prior state.
      setFavorites(current => { const updated = new Set(current ?? []); if (next) updated.delete(id); else updated.add(id); return updated; });
    }).finally(() => { window.clearTimeout(timeout); setPendingFavorites(current => { const updated = new Set(current); updated.delete(id); return updated; }); });
  };
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = route.path;
    if (route.path !== "/" || previous === "/") return;
    const controller = new AbortController();
    setState({ kind: "loading" });
    const timeout = window.setTimeout(() => { controller.abort(); setState({ kind: "error" }); }, 20_000);
    void loadCatalogue(readRows, present, controller.signal, readCredits).then(catalogue => {
      if (!controller.signal.aborted) setState({ kind: "ready", catalogue });
    }).catch(() => { if (!controller.signal.aborted) setState({ kind: "error" }); }).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [route.path, present]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [route.path]);
  const filters = filtersFromQuery(route.query);
  const segments = route.path.split("/").filter(Boolean);
  const section = segments[0];
  const solution = state.kind === "ready" && (segments.length === 2 || (segments.length === 4 && segments[2] === "demo")) && segments[0] === "s"
    ? state.catalogue.find(entry => entry.id === segments[1]) : undefined;
  useEffect(() => {
    if (present && (section === "submit" || section === "submission" || section === "review" || route.path === "/my-submissions" || route.path === "/favorites")) navigate("/");
    else if (present && state.kind === "ready" && section === "s" && !solution) navigate("/");
  }, [present, route.path, section, solution, state.kind]);
  const showBanner = present && bannerVisible;

  return <div className="min-h-full" style={{ "--sticky-top": showBanner ? "9.75rem" : "6rem" } as CSSProperties}>
    <Background />
    <Masthead user={user} theme={theme} onToggleTheme={onToggleTheme} present={present} onTogglePresent={onTogglePresent} readOnly={!entered || state.kind !== "ready" || !user.live} reviewAvailable={librarian} favoriteCount={present ? undefined : favorites?.size} />
    {showBanner && <PresentBanner onDismiss={() => setBannerVisible(false)} />}
    <main key={route.path} ref={main} tabIndex={-1} className="focus-visible:outline-none">
      {state.kind === "loading" || (state.kind === "ready" && !entered) ? <WelcomeScreen authenticated={user.live} present={present} ready={state.kind === "ready"} entering={entering} onBegin={onBegin} />
        : state.kind === "host-required" ? <Message title="Power Apps sign-in required" message="Open this app through Power Apps Local Play in your signed-in browser." onRetry={onRetry} />
        : state.kind === "error" ? <Message title="Catalogue unavailable" message="Check your Dataverse access and connection, then retry." onRetry={onRetry} alert />
        : !present && route.path === "/submit" ? <DraftsView draftId={route.query.get("draft") ?? undefined} owner={user.userPrincipalName} />
        : !present && (route.path === "/my-submissions" || route.path === "/review") ? <SubmissionsView review={route.path === "/review"} />
        : !present && segments.length === 2 && (segments[0] === "submission" || segments[0] === "review") ? <SubmissionView key={route.path} id={segments[1]} review={segments[0] === "review"} />
        : !present && route.path === "/favorites" ? <FavoritesView catalogue={state.catalogue} ids={favorites ?? new Set()} pending={pendingFavorites} onToggle={toggleFavorite} />
        : solution ? <PublishedView key={`${solution.id}:${present}:${segments[3] ?? ""}`} solution={solution} present={present} assetId={segments[3]}
            favorite={favorites ? { saved: favorites.has(solution.id), pending: pendingFavorites.has(solution.id), onToggle: () => toggleFavorite(solution.id) } : undefined} />
        : route.path !== "/" ? <Message title="Page unavailable" message="This page is not available in the current catalogue." onBack={() => navigate("/")} />
        : <LibraryView catalogue={state.catalogue} filters={filters} onFilters={next => replaceQuery("/", filtersToQuery(next))} present={present} catalogueOnly renderCard={(entry, index) => <ConnectedSolutionCard solution={entry} present={present} index={index}
            favorite={favorites ? { saved: favorites.has(entry.id), pending: pendingFavorites.has(entry.id), onToggle: () => toggleFavorite(entry.id) } : undefined} />} />}
    </main>
  </div>;
}

function Message({ title, message, onRetry, onBack, alert = false }: {
  title: string; message: string; onRetry?: () => void; onBack?: () => void; alert?: boolean;
}) {
  return <section className="mx-auto max-w-[980px] px-6 py-16" role={alert ? "alert" : "status"}>
    <h1 className="text-[28px] font-semibold">{title}</h1>
    <p className="mt-3 text-[16px]" style={{ color: "var(--ink-2)" }}>{message}</p>
    {(onRetry || onBack) && <button type="button" onClick={onRetry ?? onBack} className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: "var(--glass-edge)", color: "var(--accent)" }}>
      <Icon name={onRetry ? "arrowRight" : "chevronLeft"} size={16} />{onRetry ? "Retry" : "Back to the library"}
    </button>}
  </section>;
}