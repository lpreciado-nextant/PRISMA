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
import type { Solution } from "./types";
import { useTheme } from "./lib/theme";
import { useAppUser } from "./lib/powerContext";
import { navigate, replaceQuery, useRoute } from "./lib/router";
import { filtersFromQuery, filtersToQuery, type Filters } from "./lib/search";
import { presentCatalogue } from "./lib/catalogue";

const PRESENT_KEY = "nsl.present";

/** The published catalogue — what a CSM can ever see. */
const PUBLISHED = SOLUTIONS.filter((s) => s.publicationStatus === "Published");

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const user = useAppUser();
  const route = useRoute();
  const [submissions, setSubmissions] = useState<{ owner: string; solution: Solution }[]>([]);
  const ownedSubmissions = submissions.filter((entry) => entry.owner === user.userPrincipalName).map((entry) => entry.solution);
  const saveSubmission = (solution: Solution) => setSubmissions((current) => [
    { owner: user.userPrincipalName, solution: { ...solution, publicationStatus: "Pending review", clientSafeReviewed: false } },
    ...current.filter((entry) => entry.solution.id !== solution.id || entry.owner !== user.userPrincipalName),
  ]);

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
  const catalogue = useMemo(
    () => (present ? presentCatalogue(PUBLISHED) : PUBLISHED),
    [present],
  );
  const hiddenCount = PUBLISHED.length - catalogue.length;

  const filters = useMemo(() => filtersFromQuery(route.query), [route.query]);

  const setFilters = useCallback(
    (next: Filters) => replaceQuery(route.path, filtersToQuery(next)),
    [route.path],
  );

  const segments = route.path.split("/").filter(Boolean);
  const recordId = segments[1];
  const isSolutionRoute = segments[0] === "s";
  const isSubmissionRoute = segments[0] === "submit";
  const editing = isSubmissionRoute ? ownedSubmissions.find((entry) => entry.id === segments[1]) : undefined;
  const ownSolution = !present && isSolutionRoute ? ownedSubmissions.find((entry) => entry.id === segments[1]) : undefined;
  const solution = isSolutionRoute ? ownSolution ?? catalogue.find((s) => s.id === segments[1]) : undefined;
  const asset =
    segments[2] === "demo" ? solution?.assets.find((a) => a.id === segments[3]) : undefined;

  // Leaving a record that present mode just restricted should not dead-end,
  // and the submission form is a contributor surface — never client-facing.
  useEffect(() => {
    if (isSolutionRoute && !solution) navigate("/");
    if (present && (isSubmissionRoute || route.path === "/my-submissions")) navigate("/");
    if (!present && isSubmissionRoute && recordId && !editing) navigate("/my-submissions");
  }, [isSolutionRoute, solution, present, route.path, isSubmissionRoute, editing, recordId]);

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
        {solution && asset ? (
          <ViewerView solution={solution} asset={asset} present={present} />
        ) : solution ? (
          <DetailView solution={solution} present={present} onEdit={ownSolution ? () => navigate(`/submit/${solution.id}`) : undefined} />
        ) : isSubmissionRoute && !present && (!segments[1] || editing) ? (
          <SubmitView user={user} initialSolution={editing} draftKey={editing ? `nsl.edit.${editing.id}` : undefined} onSubmitted={saveSubmission} />
        ) : route.path === "/my-submissions" && !present ? (
          <MySubmissionsView solutions={ownedSubmissions} />
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
