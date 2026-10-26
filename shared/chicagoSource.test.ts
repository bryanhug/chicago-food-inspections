import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  createChicagoAdapter,
  createSuburbanCookAdapter,
  normalizeChicagoRow,
} from "./chicagoSource";
import type { ChicagoRow } from "./chicagoSource";

const rows = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/chi_rows.json", import.meta.url),
    "utf8",
  ),
) as ChicagoRow[];

describe("normalizeChicagoRow", () => {
  test("maps a real Socrata row onto the restaurant key license_", () => {
    const normalized = normalizeChicagoRow(rows[0]!);
    expect(normalized).toMatchObject({
      inspectionId: "2645731",
      license: "3103962",
      dbaName: "BILLAL'S",
      akaName: "BILLAL'S",
      facilityType: "Restaurant",
      risk: "Risk 1 (High)",
      address: "131 N CLINTON ST",
      city: "CHICAGO",
      state: "IL",
      zip: "60661",
      inspectionDate: "2026-10-23T00:00:00.000",
      inspectionDay: "2026-10-23",
      inspectionType: "License",
      results: "Pass",
      sourceId: "chicago",
    });
    expect(normalized?.violationCount).toBe(6);
    expect(normalized?.latitude).toBeCloseTo(41.884187507127805);
    expect(normalized?.longitude).toBeCloseTo(-87.64111966683218);
    expect(normalized).not.toHaveProperty("location");
  });

  test("drops rows that cannot be keyed", () => {
    expect(
      normalizeChicagoRow({ inspection_id: "1", results: "Pass" }),
    ).toBeNull();
    expect(
      normalizeChicagoRow({
        inspection_id: "1",
        license_: "5",
        inspection_date: "2026-01-01T00:00:00.000",
      }),
    ).toBeNull();
  });
});

describe("inspection source adapters", () => {
  test("suburban Cook County is unavailable and does not pretend to return rows", async () => {
    const suburban = createSuburbanCookAdapter();
    expect(suburban.availability).toBe("unavailable");
    expect(suburban.unavailableReason?.length).toBeGreaterThan(0);
    await expect(
      suburban.fetchPage({ offset: 0, limit: 10, since: null }),
    ).resolves.toEqual({ rows: [], received: 0 });
  });

  test("the Chicago adapter requests the incremental URL with the app token header", async () => {
    const calls: Array<{
      url: string;
      headers: Record<string, string> | undefined;
    }> = [];
    const source = createChicagoAdapter({
      appToken: "city-token",
      fetchImpl: async (url, init) => {
        calls.push({ url, headers: init?.headers });
        return new Response(JSON.stringify([rows[2]]), { status: 200 });
      },
    });
    expect(source.availability).toBe("available");
    const page = await source.fetchPage({
      offset: 0,
      limit: 1000,
      since: "2026-10-16T00:00:00.000",
    });
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get("$where")).toBe(
      "inspection_date >= '2026-10-16T00:00:00.000'",
    );
    expect(calls[0]?.headers).toEqual({ "X-App-Token": "city-token" });
    expect(page.received).toBe(1);
    expect(page.rows[0]?.results).toBe("Pass w/ Conditions");
    expect(page.rows[0]?.license).toBe(String(rows[2]?.license_));
  });
});
