import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { formatAddress } from "../../components/InspectionList";
import { ResultPill } from "../../components/ResultPill";
import { formatInspectionDay } from "../../../shared/time";

const TREND_COPY = {
  improving: "Improving vs earlier inspections",
  declining: "Declining vs earlier inspections",
  steady: "Steady vs earlier inspections",
  insufficient: "Not enough history",
} as const;

export const Route = createFileRoute("/r/$license")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.restaurants.getByLicense, { license: params.license }),
    );
  },
  component: RestaurantPage,
});

function RestaurantPage() {
  const { license } = Route.useParams();
  const { data } = useSuspenseQuery(
    convexQuery(api.restaurants.getByLicense, { license }),
  );
  if (!data) {
    return (
      <main className="wrap">
        <p>
          <Link
            to="/"
            search={{ q: "", result: "", facility: "", risk: "", zip: "" }}
          >
            All inspections
          </Link>
        </p>
        <h1>No restaurant for license {license}</h1>
        <p>It is not in the inspections stored so far.</p>
      </main>
    );
  }
  const { restaurant, inspections } = data;
  const name = restaurant.dbaName || "Unnamed establishment";
  const passRate =
    restaurant.passRate == null || restaurant.scoredCount === 0
      ? "No scored inspections"
      : `${Math.round(restaurant.passRate * 100)}% · ${restaurant.passCount} of ${restaurant.scoredCount}`;
  const mapHref =
    restaurant.latitude != null && restaurant.longitude != null
      ? `https://www.openstreetmap.org/?mlat=${restaurant.latitude}&mlon=${restaurant.longitude}#map=17/${restaurant.latitude}/${restaurant.longitude}`
      : null;

  return (
    <main className="wrap">
      <p>
        <Link
          to="/"
          search={{ q: "", result: "", facility: "", risk: "", zip: "" }}
        >
          All inspections
        </Link>
      </p>
      <h1>{name}</h1>
      {restaurant.akaName && restaurant.akaName !== restaurant.dbaName ? (
        <p className="dek">Also known as {restaurant.akaName}</p>
      ) : null}
      <p className="meta">
        {formatAddress(restaurant)}
        {mapHref ? (
          <>
            {" "}
            · <a href={mapHref}>Map</a>
          </>
        ) : null}
      </p>
      <p className="meta">
        License {restaurant.license}
        {restaurant.facilityType ? ` · ${restaurant.facilityType}` : ""}
        {" · City of Chicago"}
      </p>
      {restaurant.outOfBusiness ? (
        <p className="banner">Latest result is out of business.</p>
      ) : null}
      <dl className="summary-grid">
        <div>
          <dt>Latest result</dt>
          <dd>
            <ResultPill result={restaurant.latestResult} />
            <span>
              {restaurant.latestInspectionDay
                ? formatInspectionDay(restaurant.latestInspectionDay)
                : "No date"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Pass rate</dt>
          <dd>{passRate}</dd>
        </div>
        <div>
          <dt>Fails</dt>
          <dd>{restaurant.failCount}</dd>
        </div>
        <div>
          <dt>Trend</dt>
          <dd>{TREND_COPY[restaurant.trend]}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{restaurant.risk || "Not listed"}</dd>
        </div>
        <div>
          <dt>Scored inspections</dt>
          <dd>{restaurant.scoredCount}</dd>
        </div>
      </dl>
      <section>
        <h2>Inspection history</h2>
        {inspections.length === 0 ? (
          <p className="empty">No inspections stored for this license.</p>
        ) : (
          <ol className="ledger">
            {inspections.map((inspection) => (
              <li key={inspection.inspectionId} className="ledger-item">
                <div className="ledger-top">
                  <strong>
                    {formatInspectionDay(inspection.inspectionDay)}
                  </strong>
                  <ResultPill result={inspection.results} />
                </div>
                <p className="meta">
                  {inspection.inspectionType || "Inspection"} ·{" "}
                  {inspection.violationCount} violation
                  {inspection.violationCount === 1 ? "" : "s"}
                </p>
                {inspection.violations.length > 0 ? (
                  <details>
                    <summary>Violations</summary>
                    <ul className="violations">
                      {inspection.violations.map((violation, index) => (
                        <li key={`${violation.number}-${index}`}>
                          <span className="violation-number">
                            {violation.number}
                          </span>
                          <div>
                            <strong>{violation.title}</strong>
                            {violation.comment ? (
                              <p>{violation.comment}</p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
