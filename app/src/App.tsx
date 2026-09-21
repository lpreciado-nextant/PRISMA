import { useCallback, useEffect, useMemo, useState } from "react";
import { SOLUTIONS } from "./data/solutions";
import { Background } from "./components/Background";
import { Masthead } from "./components/Masthead";
import { PresentBanner } from "./components/PresentBanner";
import { LibraryView } from "./views/LibraryView";
import { DetailView } from "./views/DetailView";
import { ViewerView } from "./views/ViewerView";
import { SubmitView } from "./views/SubmitView";
import { MySubmissionsView } from "./views/MySubmissionsView";
import { ReviewView } from "./views/ReviewView";
import type { Solution } from "./types";
import { useTheme } from "./lib/theme";
import { useAppUser } from "./lib/powerContext";
import { navigate, replaceQuery, useRoute } from "./lib/router";
import { filtersFromQuery, filtersToQuery, type Filters } from "./lib/search";
import { presentCatalogue } from "./lib/catalogue";
import { loadSubmissions, reviewContribution, saveContribution, storeSubmission, type SubmissionEntry } from "./lib/submissions";

const PRESENT_KEY = "nsl.present";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const user = useAppUser();
  const route = useRoute();
  const [submissions, setSubmissions] = useState<SubmissionEntry[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    let active = true;
    loadSubmissions().then((entries) => {
      if (active) { setSubmissions(entries); setStorageReady(true); }
    }).catch((error: unknown) => {
      if (active) setStorageError(error instanceof Error ? error.message : "Could not load saved submissions.");
    });
    return () => { active = false; };
  }, []);
  const owner = user.userPrincipalName.toLowerCase();
  const ownedEntries = submissions.filter((entry) => entry.owner === owner);
  const ownedSubmissions = ownedEntries.map((entry) => entry.solution);
  const persistEntry = async (entry: SubmissionEntry) => {
    await storeSubmission(entry);
    setSubmissions((current) => [entry, ...current.filter((existing) => existing.solution.id !== entry.solution.id)]);
  };
  const saveSubmission = async (solution: Solution, status: "Draft" | "Pending review") => {
    const existing = submissions.find((entry) => entry.solution.id === solution.id);
    if (existing && existing.owner !== owner) throw new Error("You can only edit your own submissions.");
    await persistEntry({ owner, solution: saveContribution(solution, status, existing?.solution) });
  };

  const [present, setPresent] = useState(() => sessionStorage.getItem(PRESENT_KEY) === "1");
  const [bannerHidden, setBannerHidden] = useState(false);
  useEffect(() => {
    sessionStorage.setItem(PRESENT_KEY, present ? "1" : "0");
  }, [present]);

  const togglePresent = () => {
    setPresent((p) => !p);
    setBannerHidden(false);
  };

  /**
   * Present mode restricts the catalogue rather than hiding rows in the UI.
   * In the real app this becomes a filter on the Dataverse query so an
   * internal-only record can never reach the client's screen, even transiently.
   */
  const published = useMemo(() => [
    ...submissions.map((entry) => entry.solution),
    ...SOLUTIONS.filter((solution) => !submissions.some((entry) => entry.solution.id === solution.id)),
  ].filter((solution) => solution.publicationStatus === "Published"), [submissions]);
  const catalogue = useMemo(() => present ? presentCatalogue(published) : published, [present, published]);
  const hiddenCount = published.length - catalogue.length;

  const filters = useMemo(() => filtersFromQuery(route.query), [route.query]);

  const setFilters = useCallback(
    (next: Filters) => replaceQuery(route.path, filtersToQuery(next)),
    [route.path],
  );

  const segments = route.path.split("/").filter(Boolean);
  const recordId = segments[1];
  const isSolutionRoute = segments[0] === "s";
  const isSubmissionRoute = segments[0] === "submit";
  const isReviewRoute = segments[0] === "review";
  const reviewEntry = !present && isReviewRoute ? submissions.find((entry) => entry.solution.id === recordId && entry.solution.publicationStatus !== "Draft") : undefined;
  const reviewAsset = segments[2] === "demo" ? reviewEntry?.solution.assets.find((entry) => entry.id === segments[3]) : undefined;
  const editing = isSubmissionRoute ? ownedSubmissions.find((entry) => entry.id === segments[1]) : undefined;
  const ownSolution = !present && isSolutionRoute ? ownedSubmissions.find((entry) => entry.id === segments[1]) : undefined;
  const solution = isSolutionRoute ? ownSolution ?? catalogue.find((s) => s.id === segments[1]) : undefined;
  const asset =
    segments[2] === "demo" ? solution?.assets.find((a) => a.id === segments[3]) : undefined;

  // Leaving a record that present mode just restricted should not dead-end,
  // and the submission form is a contributor surface — never client-facing.
  useEffect(() => {
    if (isSolutionRoute && !solution && storageReady) navigate("/");
    if (ownSolution?.publicationStatus === "Draft") navigate(`/submit/${ownSolution.id}`);
    if (present && (isSubmissionRoute || isReviewRoute || route.path === "/my-submissions")) navigate("/");
    if (!present && storageReady && isSubmissionRoute && recordId && !editing) navigate("/my-submissions");
  }, [isSolutionRoute, solution, ownSolution, present, route.path, isSubmissionRoute, isReviewRoute, editing, recordId, storageReady]);

  // Each view starts at the top; "instant" sidesteps the global smooth-scroll.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route.path]);

  const showBanner = present && !bannerHidden;

  return (
    <div
      className="min-h-full"
      style={{ "--sticky-top": showBanner ? "9.75rem" : "6rem" } as React.CSSProperties}
    >
      <Background />

      <Masthead
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        present={present}
        onTogglePresent={togglePresent}
      />

      {showBanner && (
        <PresentBanner hidden={hiddenCount} onDismiss={() => setBannerHidden(true)} />
      )}

      <main key={route.path}>
        {!present && !storageReady && (isSubmissionRoute || isSolutionRoute || isReviewRoute || route.path === "/my-submissions") ? (
          <p className="mx-auto max-w-[980px] px-6 py-12" role={storageError ? "alert" : "status"}>{storageError || "Loading saved submissions..."}</p>
        ) : !present && reviewEntry && reviewAsset ? (
          <ViewerView solution={reviewEntry.solution} asset={reviewAsset} present={false} backPath={`/review/${reviewEntry.solution.id}`} />
        ) : isReviewRoute && !present ? (
          <ReviewView entries={submissions} selectedId={recordId} onDecision={async (id, decision, comments, clientSafe) => {
            const entry = submissions.find((candidate) => candidate.solution.id === id);
            if (!entry) throw new Error("Submission unavailable. Return to the queue.");
            await persistEntry({ ...entry, solution: reviewContribution(entry.solution, decision, comments, clientSafe) });
          }} />
        ) : ownSolution?.publicationStatus === "Draft" ? null : solution && asset ? (
          <ViewerView solution={solution} asset={asset} present={present} />
        ) : solution ? (
          <DetailView solution={solution} present={present} onEdit={ownSolution ? () => navigate(`/submit/${solution.id}`) : undefined} />
        ) : isSubmissionRoute && !present && (!segments[1] || editing) ? (
          <SubmitView user={user} initialSolution={editing} draftKey={editing ? `nsl.edit.${editing.id}` : `nsl.draft.v2.${owner}`} onSubmitted={(solution) => saveSubmission(solution, "Pending review")} onSaveDraft={(solution) => saveSubmission(solution, "Draft")} />
        ) : route.path === "/my-submissions" && !present ? (
          <MySubmissionsView entries={ownedEntries} />
        ) : (
          <LibraryView
            catalogue={catalogue}
            filters={filters}
            onFilters={setFilters}
            present={present}
          />
        )}
      </main>
    </div>
  );
}
