import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildChicagoInspectionsUrl,
  incrementalSince,
  socrataHeaders,
  subtractCalendarDays,
} from "./chicagoQuery";

type FixtureRow = { inspection_date: string; inspection_id: string };

const rows = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/chi_rows.json", import.meta.url),
    "utf8",
  ),
) as FixtureRow[];

describe("incremental Chicago query", () => {
  test("builds a paged Socrata URL from the newest stored sample date minus 7 days", () => {
    const maxStored = rows[0]?.inspection_date;
    expect(maxStored).toBe("2026-10-23T00:00:00.000");
    const since = incrementalSince(maxStored ?? "");
    expect(since).toBe("2026-10-16T00:00:00.000");

    const url = new URL(
      buildChicagoInspectionsUrl({ since, offset: 2000, limit: 1000 }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://data.cityofchicago.org/resource/4ijn-s7e5.json",
    );
    expect(url.searchParams.get("$where")).toBe(
      "inspection_date >= '2026-10-16T00:00:00.000'",
    );
    expect(url.searchParams.get("$order")).toBe(
      "inspection_date,inspection_id",
    );
    expect(url.searchParams.get("$limit")).toBe("1000");
    expect(url.searchParams.get("$offset")).toBe("2000");
    const select = url.searchParams.get("$select") ?? "";
    for (const field of [
      "inspection_id",
      "license_",
      "dba_name",
      "inspection_date",
      "results",
      "violations",
      "latitude",
      "longitude",
    ]) {
      expect(select.split(",")).toContain(field);
    }
    expect(select).not.toContain("location");
  });

  test("omits $where for a full backfill page", () => {
    const url = new URL(buildChicagoInspectionsUrl({ offset: 0, limit: 1000 }));
    expect(url.searchParams.get("$where")).toBeNull();
    expect(url.searchParams.get("$offset")).toBe("0");
    expect(url.searchParams.get("$order")).toBe(
      "inspection_date,inspection_id",
    );
  });

  test("subtracts calendar days across month and leap-day boundaries", () => {
    expect(subtractCalendarDays("2026-03-01T00:00:00.000", 7)).toBe(
      "2026-02-22T00:00:00.000",
    );
    expect(subtractCalendarDays("2024-03-01T00:00:00.000", 1)).toBe(
      "2024-02-29T00:00:00.000",
    );
  });

  test("sends X-App-Token only when a token is configured", () => {
    expect(socrataHeaders(undefined)).toEqual({});
    expect(socrataHeaders("")).toEqual({});
    expect(socrataHeaders("city-token")).toEqual({
      "X-App-Token": "city-token",
    });
  });
});
