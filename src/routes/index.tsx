import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { api } from "../../convex/_generated/api";
import { interpretLookup } from "../../shared/lookup";
import { formatInspectionDay } from "../../shared/time";
import { CoverageNote } from "../components/CoverageNote";
import { formatAddress, InspectionList } from "../components/InspectionList";
import { ResultPill } from "../components/ResultPill";
import { SearchForm } from "../components/SearchForm";
import { SyncBar } from "../components/SyncBar";

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

type HomeSearch = {
  q: string;
  result: string;
  facility: string;
  risk: string;
  zip: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    q: asText(search.q),
    result: asText(search.result),
    facility: asText(search.facility),
    risk: asText(search.risk),
    zip: asText(search.zip),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const lookup = interpretLookup(deps);
    const filters = {
      result: lookup.result || undefined,
      facilityType: lookup.facility || undefined,
      risk: lookup.risk || undefined,
      zip: lookup.zip || undefined,
    };
    const showFeed = lookup.mode !== "text";
    const showFails = showFeed && !lookup.result;
    await Promise.all([
      context.queryClient.ensureQueryData(convexQuery(api.feed.status, {})),
      context.queryClient.ensureQueryData(
        convexQuery(
          api.feed.recent,
          showFeed ? { ...filters, limit: 30 } : { limit: 0 },
        ),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(
          api.feed.recent,
          showFails ? { ...filters, result: "Fail", limit: 20 } : { limit: 0 },
        ),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.restaurants.search, {
          q: lookup.mode === "text" ? lookup.q : "",
          zip: lookup.zip || undefined,
          facilityType: lookup.facility || undefined,
          risk: lookup.risk || undefined,
          result: lookup.result || undefined,
        }),
      ),
    ]);
  },
  component: HomePage,
  pendingComponent: () => <p className="wrap">Loading inspections…</p>,
});

function HomePage() {
  const search = Route.useSearch();
  const lookup = interpretLookup(search);
  const filters = {
    result: lookup.result || undefined,
    facilityType: lookup.facility || undefined,
    risk: lookup.risk || undefined,
    zip: lookup.zip || undefined,
  };
  const showFeed = lookup.mode !== "text";
  const showFails = showFeed && !lookup.result;
  const showRestaurants = lookup.mode !== "feed";
  const { data: status } = useSuspenseQuery(convexQuery(api.feed.status, {}));
  const { data: recent } = useSuspenseQuery(
    convexQuery(
      api.feed.recent,
      showFeed ? { ...filters, limit: 30 } : { limit: 0 },
    ),
  );
  const { data: fails } = useSuspenseQuery(
    convexQuery(
      api.feed.recent,
      showFails ? { ...filters, result: "Fail", limit: 20 } : { limit: 0 },
    ),
  );
  const { data: restaurants } = useSuspenseQuery(
    convexQuery(api.restaurants.search, {
      q: lookup.mode === "text" ? lookup.q : "",
      zip: lookup.zip || undefined,
      facilityType: lookup.facility || undefined,
      risk: lookup.risk || undefined,
      result: lookup.result || undefined,
    }),
  );

  return (
    <main className="wrap">
      <p className="dek">
        Pass rates and violation history from Chicago Department of Public
        Health inspections. There is no numeric score in the city data.
      </p>
      <CoverageNote />
      <SyncBar status={status} />
      <SearchForm
        search={search}
        facilityTypes={status.facilityTypes}
        risks={status.risks}
      />
      {showRestaurants ? (
        <section>
          <h2>Restaurants</h2>
          {restaurants.length === 0 ? (
            <p className="empty">No restaurants match.</p>
          ) : (
            <ol className="ledger">
              {restaurants.map((restaurant) => (
                <li key={restaurant.license} className="ledger-item">
                  <div className="ledger-top">
                    <Link
                      to="/r/$license"
                      params={{ license: restaurant.license }}
                      className="place-name"
                    >
                      {restaurant.dbaName || "Unnamed establishment"}
                    </Link>
                    <ResultPill result={restaurant.latestResult} />
                  </div>
                  {restaurant.akaName &&
                  restaurant.akaName !== restaurant.dbaName ? (
                    <p className="meta">Also known as {restaurant.akaName}</p>
                  ) : null}
                  <p className="meta">{formatAddress(restaurant)}</p>
                  <p className="meta">
                    {restaurant.latestInspectionDay
                      ? `Latest ${formatInspectionDay(restaurant.latestInspectionDay)}`
                      : "No inspection date"}
                    {restaurant.outOfBusiness ? " · Out of business" : ""}
                    {` · ${restaurant.failCount} fail${restaurant.failCount === 1 ? "" : "s"}`}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
      {showFeed ? (
        <section>
          <h2>Recent inspections</h2>
          <InspectionList
            inspections={recent}
            empty="No inspections stored yet. Run the backfill to load City of Chicago results."
          />
        </section>
      ) : null}
      {showFails ? (
        <section>
          <h2>Recent fails</h2>
          <InspectionList
            inspections={fails}
            empty="No failed inspections in this view."
          />
        </section>
      ) : null}
    </main>
  );
}
