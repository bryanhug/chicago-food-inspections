import { buildChicagoInspectionsUrl, socrataHeaders } from "./chicagoQuery";
import { parseViolations, type ParsedViolation } from "./violations";

export const SUBURBAN_COOK_REASON =
  "No open data source found for CCDPH or suburban Cook County health departments. This tracker lists City of Chicago inspections only.";

export type ChicagoRow = {
  inspection_id?: string | number;
  dba_name?: string;
  aka_name?: string;
  license_?: string | number;
  facility_type?: string;
  risk?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string | number;
  inspection_date?: string;
  inspection_type?: string;
  results?: string;
  violations?: string | null;
  latitude?: string | number;
  longitude?: string | number;
};

export type NormalizedInspection = {
  inspectionId: string;
  license: string;
  dbaName: string;
  akaName: string;
  facilityType: string;
  risk: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  inspectionDate: string;
  inspectionDay: string;
  inspectionType: string;
  results: string;
  violationsRaw: string;
  violations: ParsedViolation[];
  violationCount: number;
  latitude: number | null;
  longitude: number | null;
  sourceId: "chicago";
};

export type PageRequest = {
  offset: number;
  limit: number;
  since: string | null;
};

export type PageResult = {
  rows: NormalizedInspection[];
  received: number;
};

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

export type InspectionSourceAdapter = {
  id: string;
  label: string;
  availability: "available" | "unavailable";
  unavailableReason?: string;
  fetchPage(request: PageRequest): Promise<PageResult>;
};

export const COVERAGE = [
  {
    id: "chicago",
    label: "City of Chicago",
    availability: "available" as const,
    detail: "CDPH food inspections from the City of Chicago open data portal.",
  },
  {
    id: "suburban-cook",
    label: "Suburban Cook County",
    availability: "unavailable" as const,
    detail: SUBURBAN_COOK_REASON,
  },
];

function text(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).trim();
}

function coordinate(value: string | number | undefined): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeChicagoRow(
  row: ChicagoRow,
): NormalizedInspection | null {
  const inspectionId = text(row.inspection_id);
  const license = text(row.license_);
  const inspectionDate = text(row.inspection_date);
  const results = text(row.results);
  const inspectionDay = inspectionDate.slice(0, 10);
  if (
    !inspectionId ||
    !license ||
    !/^\d{4}-\d{2}-\d{2}$/.test(inspectionDay) ||
    !results
  ) {
    return null;
  }
  const violations = parseViolations(row.violations);
  return {
    inspectionId,
    license,
    dbaName: text(row.dba_name),
    akaName: text(row.aka_name),
    facilityType: text(row.facility_type),
    risk: text(row.risk),
    address: text(row.address),
    city: text(row.city),
    state: text(row.state),
    zip: text(row.zip),
    inspectionDate,
    inspectionDay,
    inspectionType: text(row.inspection_type),
    results,
    violationsRaw: row.violations?.trim() ?? "",
    violations,
    violationCount: violations.length,
    latitude: coordinate(row.latitude),
    longitude: coordinate(row.longitude),
    sourceId: "chicago",
  };
}

export class ChicagoFetchError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "ChicagoFetchError";
    this.status = status;
    this.retryable = retryable;
  }
}

export function createChicagoAdapter(options?: {
  appToken?: string;
  fetchImpl?: FetchLike;
}): InspectionSourceAdapter {
  const fetchImpl = options?.fetchImpl ?? fetch;
  return {
    id: "chicago",
    label: "City of Chicago",
    availability: "available",
    async fetchPage(request) {
      const url = buildChicagoInspectionsUrl({
        since: request.since,
        offset: request.offset,
        limit: request.limit,
      });
      const response = await fetchImpl(url, {
        headers: socrataHeaders(options?.appToken),
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        throw new ChicagoFetchError(
          `Chicago data request failed (${response.status})`,
          response.status,
          retryable,
        );
      }
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        throw new ChicagoFetchError(
          "Chicago data response was not a list",
          200,
          false,
        );
      }
      const rows: NormalizedInspection[] = [];
      for (const item of payload) {
        if (!item || typeof item !== "object") continue;
        const normalized = normalizeChicagoRow(item as ChicagoRow);
        if (normalized) rows.push(normalized);
      }
      return { rows, received: payload.length };
    },
  };
}

export function createSuburbanCookAdapter(): InspectionSourceAdapter {
  return {
    id: "suburban-cook",
    label: "Suburban Cook County",
    availability: "unavailable",
    unavailableReason: SUBURBAN_COOK_REASON,
    async fetchPage() {
      return { rows: [], received: 0 };
    },
  };
}
