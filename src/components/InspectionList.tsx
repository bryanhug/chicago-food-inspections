import { Link } from "@tanstack/react-router";
import { formatInspectionDay } from "../../shared/time";
import { ResultPill } from "./ResultPill";

export type FeedInspection = {
  inspectionId: string;
  license: string;
  dbaName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  facilityType: string;
  risk: string;
  inspectionDay: string;
  inspectionType: string;
  results: string;
  violationCount: number;
};

export function InspectionList({
  inspections,
  empty,
}: {
  inspections: FeedInspection[];
  empty: string;
}) {
  if (inspections.length === 0) {
    return <p className="empty">{empty}</p>;
  }
  return (
    <ol className="ledger">
      {inspections.map((inspection) => (
        <li key={inspection.inspectionId} className="ledger-item">
          <div className="ledger-top">
            <Link
              to="/r/$license"
              params={{ license: inspection.license }}
              className="place-name"
            >
              {inspection.dbaName || "Unnamed establishment"}
            </Link>
            <ResultPill result={inspection.results} />
          </div>
          <p className="meta">
            {formatAddress(inspection)}
            {inspection.facilityType ? ` · ${inspection.facilityType}` : ""}
            {inspection.risk ? ` · ${inspection.risk}` : ""}
          </p>
          <p className="meta">
            {formatInspectionDay(inspection.inspectionDay)}
            {inspection.inspectionType ? ` · ${inspection.inspectionType}` : ""}
            {` · ${inspection.violationCount} violation${inspection.violationCount === 1 ? "" : "s"}`}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function formatAddress(parts: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const region = [parts.state, parts.zip]
    .filter((part) => part.trim())
    .join(" ");
  return [parts.address, parts.city, region]
    .filter((part) => part.trim().length > 0)
    .join(", ");
}
