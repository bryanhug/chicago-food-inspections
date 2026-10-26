export type Trend = "improving" | "declining" | "steady" | "insufficient";

export type ScoredInput = {
  inspectionId: string;
  inspectionDay: string;
  results: string;
  risk?: string;
};

export type RestaurantSummary = {
  latestResult: string | null;
  latestInspectionDay: string | null;
  latestInspectionId: string | null;
  passRate: number | null;
  passCount: number;
  scoredCount: number;
  failCount: number;
  trend: Trend;
  risk: string | null;
  outOfBusiness: boolean;
  recentPassRate: number | null;
  earlierPassRate: number | null;
};

export const PASS_RESULTS = new Set(["Pass", "Pass w/ Conditions"]);

export const EXCLUDED_RESULTS = new Set([
  "Out of Business",
  "No Entry",
  "Not Ready",
  "Business Not Located",
]);

export const KNOWN_RESULTS = [
  "Pass",
  "Pass w/ Conditions",
  "Fail",
  "Out of Business",
  "No Entry",
  "Not Ready",
  "Business Not Located",
] as const;

export const MAX_HISTORY = 400;

const EMPTY_SUMMARY: RestaurantSummary = {
  latestResult: null,
  latestInspectionDay: null,
  latestInspectionId: null,
  passRate: null,
  passCount: 0,
  scoredCount: 0,
  failCount: 0,
  trend: "insufficient",
  risk: null,
  outOfBusiness: false,
  recentPassRate: null,
  earlierPassRate: null,
};

export function compareInspections(
  a: Pick<ScoredInput, "inspectionDay" | "inspectionId">,
  b: Pick<ScoredInput, "inspectionDay" | "inspectionId">,
): number {
  if (a.inspectionDay !== b.inspectionDay) {
    return a.inspectionDay < b.inspectionDay ? -1 : 1;
  }
  const aId = Number(a.inspectionId);
  const bId = Number(b.inspectionId);
  if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) {
    return aId < bId ? -1 : 1;
  }
  if (a.inspectionId === b.inspectionId) return 0;
  return a.inspectionId < b.inspectionId ? -1 : 1;
}

function rate(passCount: number, total: number): number | null {
  if (total === 0) return null;
  return passCount / total;
}

export function summarizeInspections(
  inspections: ScoredInput[],
): RestaurantSummary {
  if (inspections.length === 0) return EMPTY_SUMMARY;
  const ordered = [...inspections].sort(compareInspections);
  const latest = ordered[ordered.length - 1]!;
  const scored = ordered.filter((item) => !EXCLUDED_RESULTS.has(item.results));
  const passCount = scored.filter((item) =>
    PASS_RESULTS.has(item.results),
  ).length;
  const failCount = ordered.filter((item) => item.results === "Fail").length;
  let trend: Trend = "insufficient";
  let recentPassRate: number | null = null;
  let earlierPassRate: number | null = null;
  if (scored.length >= 4) {
    const recent = scored.slice(-3);
    const earlier = scored.slice(0, -3);
    const recentPasses = recent.filter((item) =>
      PASS_RESULTS.has(item.results),
    ).length;
    const earlierPasses = earlier.filter((item) =>
      PASS_RESULTS.has(item.results),
    ).length;
    recentPassRate = rate(recentPasses, recent.length);
    earlierPassRate = rate(earlierPasses, earlier.length);
    if (
      recentPassRate != null &&
      earlierPassRate != null &&
      recentPassRate > earlierPassRate
    ) {
      trend = "improving";
    } else if (
      recentPassRate != null &&
      earlierPassRate != null &&
      recentPassRate < earlierPassRate
    ) {
      trend = "declining";
    } else {
      trend = "steady";
    }
  }
  const risk = latest.risk?.trim() ? latest.risk.trim() : null;
  return {
    latestResult: latest.results,
    latestInspectionDay: latest.inspectionDay,
    latestInspectionId: latest.inspectionId,
    passRate: rate(passCount, scored.length),
    passCount,
    scoredCount: scored.length,
    failCount,
    trend,
    risk,
    outOfBusiness: latest.results === "Out of Business",
    recentPassRate,
    earlierPassRate,
  };
}

export type IdentityInput = {
  inspectionId: string;
  inspectionDay: string;
  results: string;
  risk: string;
  dbaName: string;
  akaName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  facilityType: string;
  latitude: number | null;
  longitude: number | null;
};

export type RestaurantRecord = {
  license: string;
  dbaName: string;
  akaName: string;
  searchName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  facilityType: string;
  risk: string;
  latitude: number | null;
  longitude: number | null;
  history: Array<ScoredInput & { risk: string }>;
  passRate: number | null;
  passCount: number;
  scoredCount: number;
  failCount: number;
  trend: Trend;
  outOfBusiness: boolean;
  latestResult: string;
  latestInspectionDay: string;
  latestInspectionId: string;
};

function searchName(dbaName: string, akaName: string): string {
  return [dbaName, akaName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

export function applyInspection(
  previous: RestaurantRecord | null,
  license: string,
  incoming: IdentityInput,
): RestaurantRecord {
  const history = [
    ...(previous?.history ?? []).filter(
      (item) => item.inspectionId !== incoming.inspectionId,
    ),
    {
      inspectionId: incoming.inspectionId,
      inspectionDay: incoming.inspectionDay,
      results: incoming.results,
      risk: incoming.risk,
    },
  ].sort(compareInspections);
  const capped =
    history.length > MAX_HISTORY
      ? history.slice(history.length - MAX_HISTORY)
      : history;
  const summary = summarizeInspections(capped);
  const profile =
    !previous || summary.latestInspectionId === incoming.inspectionId
      ? incoming
      : previous;
  return {
    license,
    dbaName: profile.dbaName,
    akaName: profile.akaName,
    searchName: searchName(profile.dbaName, profile.akaName),
    address: profile.address,
    city: profile.city,
    state: profile.state,
    zip: profile.zip,
    facilityType: profile.facilityType,
    risk: summary.risk ?? "",
    latitude: profile.latitude,
    longitude: profile.longitude,
    history: capped,
    passRate: summary.passRate,
    passCount: summary.passCount,
    scoredCount: summary.scoredCount,
    failCount: summary.failCount,
    trend: summary.trend,
    outOfBusiness: summary.outOfBusiness,
    latestResult: summary.latestResult ?? "",
    latestInspectionDay: summary.latestInspectionDay ?? "",
    latestInspectionId: summary.latestInspectionId ?? "",
  };
}
