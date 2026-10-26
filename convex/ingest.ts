import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import type { NormalizedInspection } from "../shared/chicagoSource";
import { applyInspection, type RestaurantRecord } from "../shared/summary";

const violation = v.object({
  number: v.number(),
  title: v.string(),
  comment: v.union(v.string(), v.null()),
});

const normalizedInspection = v.object({
  inspectionId: v.string(),
  license: v.string(),
  dbaName: v.string(),
  akaName: v.string(),
  facilityType: v.string(),
  risk: v.string(),
  address: v.string(),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  inspectionDate: v.string(),
  inspectionDay: v.string(),
  inspectionType: v.string(),
  results: v.string(),
  violationsRaw: v.string(),
  violations: v.array(violation),
  violationCount: v.number(),
  latitude: v.union(v.number(), v.null()),
  longitude: v.union(v.number(), v.null()),
  sourceId: v.literal("chicago"),
});

const mode = v.union(v.literal("incremental"), v.literal("backfill"));

function recordFromDoc(doc: Doc<"restaurants">): RestaurantRecord {
  return {
    license: doc.license,
    dbaName: doc.dbaName,
    akaName: doc.akaName,
    searchName: doc.searchName,
    address: doc.address,
    city: doc.city,
    state: doc.state,
    zip: doc.zip,
    facilityType: doc.facilityType,
    risk: doc.risk,
    latitude: doc.latitude,
    longitude: doc.longitude,
    history: doc.history,
    passRate: doc.passRate,
    passCount: doc.passCount,
    scoredCount: doc.scoredCount,
    failCount: doc.failCount,
    trend: doc.trend,
    outOfBusiness: doc.outOfBusiness,
    latestResult: doc.latestResult,
    latestInspectionDay: doc.latestInspectionDay,
    latestInspectionId: doc.latestInspectionId,
  };
}

function mergeFacets(current: string[], incoming: string[]): string[] {
  const values = new Set(current);
  for (const value of incoming) {
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b)).slice(0, 100);
}

export const getCursor = internalQuery({
  args: { sourceId: v.string(), mode },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ingestCursors")
      .withIndex("by_source_and_mode", (q) =>
        q.eq("sourceId", args.sourceId).eq("mode", args.mode),
      )
      .unique();
  },
});

export const maxInspectionDate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [latest] = await ctx.db
      .query("inspections")
      .withIndex("by_date")
      .order("desc")
      .take(1);
    return latest?.inspectionDate ?? null;
  },
});

export const beginRun = internalMutation({
  args: {
    sourceId: v.string(),
    mode,
    offset: v.number(),
    since: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const runId = await ctx.db.insert("syncRuns", {
      sourceId: args.sourceId,
      mode: args.mode,
      startedAt,
      finishedAt: null,
      status: "running",
      rowsFetched: 0,
      rowsUpserted: 0,
      error: null,
      dataAsOf: null,
    });
    const cursor = {
      sourceId: args.sourceId,
      mode: args.mode,
      offset: args.offset,
      since: args.since,
      status: "running" as const,
      attempt: 0,
      runId,
      lastError: null,
      updatedAt: startedAt,
    };
    const existing = await ctx.db
      .query("ingestCursors")
      .withIndex("by_source_and_mode", (q) =>
        q.eq("sourceId", args.sourceId).eq("mode", args.mode),
      )
      .unique();
    if (existing) await ctx.db.replace(existing._id, cursor);
    else await ctx.db.insert("ingestCursors", cursor);
    return runId;
  },
});

export const upsertBatch = internalMutation({
  args: { rows: v.array(normalizedInspection) },
  handler: async (ctx, args) => {
    const byLicense = new Map<string, NormalizedInspection[]>();
    for (const row of args.rows) {
      const existing = await ctx.db
        .query("inspections")
        .withIndex("by_inspectionId", (q) =>
          q.eq("inspectionId", row.inspectionId),
        )
        .unique();
      if (existing) await ctx.db.replace(existing._id, row);
      else await ctx.db.insert("inspections", row);
      const group = byLicense.get(row.license);
      if (group) group.push(row);
      else byLicense.set(row.license, [row]);
    }

    for (const [license, rows] of byLicense) {
      const existing = await ctx.db
        .query("restaurants")
        .withIndex("by_license", (q) => q.eq("license", license))
        .unique();
      let record: RestaurantRecord | null = existing
        ? recordFromDoc(existing)
        : null;
      for (const row of rows) {
        record = applyInspection(record, license, {
          inspectionId: row.inspectionId,
          inspectionDay: row.inspectionDay,
          results: row.results,
          risk: row.risk,
          dbaName: row.dbaName,
          akaName: row.akaName,
          address: row.address,
          city: row.city,
          state: row.state,
          zip: row.zip,
          facilityType: row.facilityType,
          latitude: row.latitude,
          longitude: row.longitude,
        });
      }
      if (!record) continue;
      const next = { ...record, sourceId: "chicago" as const };
      if (existing) await ctx.db.replace(existing._id, next);
      else await ctx.db.insert("restaurants", next);
    }
    return args.rows.length;
  },
});

export const recordProgress = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    sourceId: v.string(),
    mode,
    offset: v.number(),
    since: v.union(v.string(), v.null()),
    fetched: v.number(),
    upserted: v.number(),
    dataAsOf: v.union(v.string(), v.null()),
    facilityTypes: v.array(v.string()),
    risks: v.array(v.string()),
    cursorStatus: v.union(
      v.literal("running"),
      v.literal("idle"),
      v.literal("complete"),
    ),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    const dataAsOf =
      args.dataAsOf && (!run.dataAsOf || args.dataAsOf > run.dataAsOf)
        ? args.dataAsOf
        : run.dataAsOf;
    await ctx.db.patch(args.runId, {
      rowsFetched: run.rowsFetched + args.fetched,
      rowsUpserted: run.rowsUpserted + args.upserted,
      dataAsOf,
    });
    const cursor = await ctx.db
      .query("ingestCursors")
      .withIndex("by_source_and_mode", (q) =>
        q.eq("sourceId", args.sourceId).eq("mode", args.mode),
      )
      .unique();
    if (cursor) {
      await ctx.db.patch(cursor._id, {
        offset: args.offset,
        since: args.since,
        status: args.cursorStatus,
        attempt: 0,
        lastError: null,
        updatedAt: Date.now(),
        runId: args.runId,
      });
    }
    const state = await ctx.db
      .query("datasetState")
      .withIndex("by_key", (q) => q.eq("key", args.sourceId))
      .unique();
    const nextState = {
      key: args.sourceId,
      dataAsOf:
        args.dataAsOf && (!state?.dataAsOf || args.dataAsOf > state.dataAsOf)
          ? args.dataAsOf
          : (state?.dataAsOf ?? args.dataAsOf),
      facilityTypes: mergeFacets(
        state?.facilityTypes ?? [],
        args.facilityTypes,
      ),
      risks: mergeFacets(state?.risks ?? [], args.risks),
    };
    if (state) await ctx.db.replace(state._id, nextState);
    else await ctx.db.insert("datasetState", nextState);
  },
});

export const noteError = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    sourceId: v.string(),
    mode,
    attempt: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const message = args.error.slice(0, 500);
    await ctx.db.patch(args.runId, { error: message });
    const cursor = await ctx.db
      .query("ingestCursors")
      .withIndex("by_source_and_mode", (q) =>
        q.eq("sourceId", args.sourceId).eq("mode", args.mode),
      )
      .unique();
    if (cursor) {
      await ctx.db.patch(cursor._id, {
        attempt: args.attempt,
        lastError: message,
        status: "running",
        updatedAt: Date.now(),
      });
    }
  },
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("syncRuns"),
    sourceId: v.string(),
    mode,
    status: v.union(v.literal("success"), v.literal("error")),
    cursorStatus: v.union(
      v.literal("complete"),
      v.literal("error"),
      v.literal("idle"),
    ),
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      finishedAt: Date.now(),
      error: args.error,
    });
    const cursor = await ctx.db
      .query("ingestCursors")
      .withIndex("by_source_and_mode", (q) =>
        q.eq("sourceId", args.sourceId).eq("mode", args.mode),
      )
      .unique();
    if (cursor) {
      await ctx.db.patch(cursor._id, {
        status: args.cursorStatus,
        lastError: args.error,
        updatedAt: Date.now(),
      });
    }
  },
});
