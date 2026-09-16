import { useCallback, useEffect, useMemo, useState } from "react";
import { SOLUTIONS } from "./data/solutions";
import { Background } from "./components/Background";
import { Masthead } from "./components/Masthead";
import { PresentBanner } from "./components/PresentBanner";
import { LibraryView } from "./views/LibraryView";
import { DetailView } from "./views/DetailView";
import { ViewerView } from "./views/ViewerView";
import { useTheme } from "./lib/theme";
import { useAppUser } from "./lib/powerContext";
import { navigate, replaceQuery, useRoute } from "./lib/router";
import { filtersFromQuery, filtersToQuery, type Filters } from "./lib/search";

const PRESENT_KEY = "nsl.present";

/** The published catalogue — what a CSM can ever see. */
const PUBLISHED = SOLUTIONS.filter((s) => s.publicationStatus === "Published");

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const user = useAppUser();
  const route = useRoute();

  const [present, setPresent] = useState(() => sessionStorage.getItem(PRESENT_KEY) === "1");
  useEffect(() => {
    sessionStorage.setItem(PRESENT_KEY, present ? "1" : "0");
  }, [present]);

  /**
   * Present mode restricts the catalogue rather than hiding rows in the UI.
   * In the real app this becomes a filter on the Dataverse query so an
   * internal-only record can never reach the client's screen, even transiently.
   */
  const catalogue = useMemo(
    () => (present ? PUBLISHED.filter((s) => s.shareable !== "No – internal only") : PUBLISHED),
    [present],
  );
  const hiddenCount = PUBLISHED.length - catalogue.length;

  const filters = useMemo(() => filtersFromQuery(route.query), [route.query]);

  const setFilters = useCallback(
    (next: Filters) => replaceQuery(route.path, filtersToQuery(next)),
    [route.path],
  );

  const segments = route.path.split("/").filter(Boolean);
  const isSolutionRoute = segments[0] === "s";
  const solution = isSolutionRoute ? catalogue.find((s) => s.id === segments[1]) : undefined;
  const asset =
    segments[2] === "demo" ? solution?.assets.find((a) => a.id === segments[3]) : undefined;

  // Leaving a record that present mode just restricted should not dead-end.
  useEffect(() => {
    if (isSolutionRoute && !solution) navigate("/");
  }, [isSolutionRoute, solution]);

  return (
    <div
      className="min-h-full"
      style={{ "--sticky-top": present ? "9.75rem" : "6rem" } as React.CSSProperties}
    >
      <Background />

      <Masthead
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        present={present}
        onTogglePresent={() => setPresent((p) => !p)}
      />

      {present && <PresentBanner hidden={hiddenCount} onExit={() => setPresent(false)} />}

      <main key={route.path}>
        {solution && asset ? (
          <ViewerView solution={solution} asset={asset} present={present} />
        ) : solution ? (
          <DetailView solution={solution} present={present} />
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
