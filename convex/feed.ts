import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

const feedItem = v.object({
  inspectionId: v.string(),
  license: v.string(),
  dbaName: v.string(),
  address: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  facilityType: v.string(),
  risk: v.string(),
  inspectionDay: v.string(),
  inspectionType: v.string(),
  results: v.string(),
  violationCount: v.number(),
});

const feedArgs = {
  result: v.optional(v.string()),
  facilityType: v.optional(v.string()),
  risk: v.optional(v.string()),
  zip: v.optional(v.string()),
  limit: v.optional(v.number()),
};

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function matches(
  row: Doc<"inspections">,
  filters: {
    result?: string;
    facilityType?: string;
    risk?: string;
    zip?: string;
  },
): boolean {
  if (filters.result && row.results !== filters.result) return false;
  if (filters.facilityType && row.facilityType !== filters.facilityType) {
    return false;
  }
  if (filters.risk && row.risk !== filters.risk) return false;
  if (filters.zip && row.zip !== filters.zip) return false;
  return true;
}

function toFeedItem(row: Doc<"inspections">) {
  return {
    inspectionId: row.inspectionId,
    license: row.license,
    dbaName: row.dbaName,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    facilityType: row.facilityType,
    risk: row.risk,
    inspectionDay: row.inspectionDay,
    inspectionType: row.inspectionType,
    results: row.results,
    violationCount: row.violationCount,
  };
}

async function readRecent(
  ctx: QueryCtx,
  filters: {
    result?: string;
    facilityType?: string;
    risk?: string;
    zip?: string;
  },
  overscan: number,
): Promise<Doc<"inspections">[]> {
  if (filters.result) {
    return await ctx.db
      .query("inspections")
      .withIndex("by_result_and_date", (q) => q.eq("results", filters.result!))
      .order("desc")
      .take(overscan);
  }
  if (filters.zip) {
    return await ctx.db
      .query("inspections")
      .withIndex("by_zip_and_date", (q) => q.eq("zip", filters.zip!))
      .order("desc")
      .take(overscan);
  }
  if (filters.facilityType) {
    return await ctx.db
      .query("inspections")
      .withIndex("by_facility_and_date", (q) =>
        q.eq("facilityType", filters.facilityType!),
      )
      .order("desc")
      .take(overscan);
  }
  if (filters.risk) {
    return await ctx.db
      .query("inspections")
      .withIndex("by_risk_and_date", (q) => q.eq("risk", filters.risk!))
      .order("desc")
      .take(overscan);
  }
  return await ctx.db
    .query("inspections")
    .withIndex("by_date")
    .order("desc")
    .take(overscan);
}

export const recent = query({
  args: feedArgs,
  returns: v.array(feedItem),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 30, 0), 50);
    if (limit === 0) return [];
    const filters = {
      result: present(args.result),
      facilityType: present(args.facilityType),
      risk: present(args.risk),
      zip: present(args.zip),
    };
    const overscan = Math.min(Math.max(limit * 4, limit), 120);
    const rows = await readRecent(ctx, filters, overscan);
    return rows
      .filter((row) => matches(row, filters))
      .slice(0, limit)
      .map(toFeedItem);
  },
});

export const status = query({
  args: {},
  returns: v.object({
    dataAsOf: v.union(v.string(), v.null()),
    lastSyncAt: v.union(v.number(), v.null()),
    lastSyncStatus: v.union(v.string(), v.null()),
    lastSyncMode: v.union(v.string(), v.null()),
    rowsUpserted: v.number(),
    error: v.union(v.string(), v.null()),
    facilityTypes: v.array(v.string()),
    risks: v.array(v.string()),
  }),
  handler: async (ctx) => {
    const [run] = await ctx.db
      .query("syncRuns")
      .withIndex("by_started")
      .order("desc")
      .take(1);
    const state = await ctx.db
      .query("datasetState")
      .withIndex("by_key", (q) => q.eq("key", "chicago"))
      .unique();
    return {
      dataAsOf: state?.dataAsOf ?? run?.dataAsOf ?? null,
      lastSyncAt: run ? (run.finishedAt ?? run.startedAt) : null,
      lastSyncStatus: run?.status ?? null,
      lastSyncMode: run?.mode ?? null,
      rowsUpserted: run?.rowsUpserted ?? 0,
      error: run?.error ?? null,
      facilityTypes: state?.facilityTypes ?? [],
      risks: state?.risks ?? [],
    };
  },
});
