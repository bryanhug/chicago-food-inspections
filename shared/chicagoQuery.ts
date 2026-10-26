export const CHICAGO_RESOURCE_URL =
  "https://data.cityofchicago.org/resource/4ijn-s7e5.json";

export const CHICAGO_PAGE_LIMIT = 1000;

export const OVERLAP_DAYS = 7;

export const CHICAGO_SELECT_FIELDS = [
  "inspection_id",
  "dba_name",
  "aka_name",
  "license_",
  "facility_type",
  "risk",
  "address",
  "city",
  "state",
  "zip",
  "inspection_date",
  "inspection_type",
  "results",
  "violations",
  "latitude",
  "longitude",
] as const;

export function subtractCalendarDays(
  floatingTimestamp: string,
  days: number,
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(floatingTimestamp);
  if (!match) {
    throw new Error(`Invalid inspection date: ${floatingTimestamp}`);
  }
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  utc.setUTCDate(utc.getUTCDate() - days);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}${match[4] ?? ""}`;
}

export function incrementalSince(maxStoredInspectionDate: string): string {
  return subtractCalendarDays(maxStoredInspectionDate, OVERLAP_DAYS);
}

export function buildChicagoInspectionsUrl(args: {
  since?: string | null;
  offset: number;
  limit?: number;
}): string {
  const url = new URL(CHICAGO_RESOURCE_URL);
  url.searchParams.set("$select", CHICAGO_SELECT_FIELDS.join(","));
  url.searchParams.set("$order", "inspection_date,inspection_id");
  url.searchParams.set("$limit", String(args.limit ?? CHICAGO_PAGE_LIMIT));
  url.searchParams.set("$offset", String(args.offset));
  if (args.since) {
    url.searchParams.set("$where", `inspection_date >= '${args.since}'`);
  }
  return url.toString();
}

export function socrataHeaders(
  appToken: string | undefined,
): Record<string, string> {
  if (!appToken) return {};
  return { "X-App-Token": appToken };
}
