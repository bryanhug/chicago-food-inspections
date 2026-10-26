import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";

const summary = v.object({
  license: v.string(),
  dbaName: v.string(),
  akaName: v.string(),
  address: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  facilityType: v.string(),
  risk: v.string(),
  latitude: v.union(v.number(), v.null()),
  longitude: v.union(v.number(), v.null()),
  latestResult: v.string(),
  latestInspectionDay: v.string(),
  passRate: v.union(v.number(), v.null()),
  passCount: v.number(),
  scoredCount: v.number(),
  failCount: v.number(),
  trend: v.union(
    v.literal("improving"),
    v.literal("declining"),
    v.literal("steady"),
    v.literal("insufficient"),
  ),
  outOfBusiness: v.boolean(),
});

const violation = v.object({
  number: v.number(),
  title: v.string(),
  comment: v.union(v.string(), v.null()),
});

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toSummary(row: Doc<"restaurants">) {
  return {
    license: row.license,
    dbaName: row.dbaName,
    akaName: row.akaName,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    facilityType: row.facilityType,
    risk: row.risk,
    latitude: row.latitude,
    longitude: row.longitude,
    latestResult: row.latestResult,
    latestInspectionDay: row.latestInspectionDay,
    passRate: row.passRate,
    passCount: row.passCount,
    scoredCount: row.scoredCount,
    failCount: row.failCount,
    trend: row.trend,
    outOfBusiness: row.outOfBusiness,
  };
}

function matchesRestaurant(
  row: Doc<"restaurants">,
  filters: { facilityType?: string; risk?: string; result?: string },
): boolean {
  if (filters.facilityType && row.facilityType !== filters.facilityType) {
    return false;
  }
  if (filters.risk && row.risk !== filters.risk) return false;
  if (filters.result && row.latestResult !== filters.result) return false;
  return true;
}

export const search = query({
  args: {
    q: v.string(),
    zip: v.optional(v.string()),
    facilityType: v.optional(v.string()),
    risk: v.optional(v.string()),
    result: v.optional(v.string()),
  },
  returns: v.array(summary),
  handler: async (ctx, args) => {
    const q = args.q.trim();
    const zip = present(args.zip);
    const filters = {
      facilityType: present(args.facilityType),
      risk: present(args.risk),
      result: present(args.result),
    };
    if (!q && !zip) return [];
    if (!q && zip) {
      const rows = await ctx.db
        .query("restaurants")
        .withIndex("by_zip", (index) => index.eq("zip", zip))
        .take(80);
      return rows
        .filter((row) => matchesRestaurant(row, filters))
        .slice(0, 25)
        .map(toSummary);
    }

    const byName = await ctx.db
      .query("restaurants")
      .withSearchIndex("search_name", (index) => {
        let search = index.search("searchName", q);
        if (zip) search = search.eq("zip", zip);
        if (filters.facilityType) {
          search = search.eq("facilityType", filters.facilityType);
        }
        if (filters.risk) search = search.eq("risk", filters.risk);
        if (filters.result) search = search.eq("latestResult", filters.result);
        return search;
      })
      .take(25);
    const byAddress = await ctx.db
      .query("restaurants")
      .withSearchIndex("search_address", (index) => {
        let search = index.search("address", q);
        if (zip) search = search.eq("zip", zip);
        if (filters.facilityType) {
          search = search.eq("facilityType", filters.facilityType);
        }
        if (filters.risk) search = search.eq("risk", filters.risk);
        if (filters.result) search = search.eq("latestResult", filters.result);
        return search;
      })
      .take(25);
    const seen = new Set<string>();
    const merged: Doc<"restaurants">[] = [];
    for (const row of [...byName, ...byAddress]) {
      if (seen.has(row.license)) continue;
      seen.add(row.license);
      merged.push(row);
      if (merged.length === 25) break;
    }
    return merged.map(toSummary);
  },
});

export const getByLicense = query({
  args: { license: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      restaurant: summary,
      inspections: v.array(
        v.object({
          inspectionId: v.string(),
          inspectionDay: v.string(),
          inspectionType: v.string(),
          results: v.string(),
          violationCount: v.number(),
          violations: v.array(violation),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const restaurant = await ctx.db
      .query("restaurants")
      .withIndex("by_license", (q) => q.eq("license", args.license))
      .unique();
    if (!restaurant) return null;
    const inspections = await ctx.db
      .query("inspections")
      .withIndex("by_license_and_date", (q) => q.eq("license", args.license))
      .order("desc")
      .take(100);
    return {
      restaurant: toSummary(restaurant),
      inspections: inspections.map((row) => ({
        inspectionId: row.inspectionId,
        inspectionDay: row.inspectionDay,
        inspectionType: row.inspectionType,
        results: row.results,
        violationCount: row.violationCount,
        violations: row.violations,
      })),
    };
  },
});
