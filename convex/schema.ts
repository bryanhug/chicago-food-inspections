import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const violation = v.object({
  number: v.number(),
  title: v.string(),
  comment: v.union(v.string(), v.null()),
});

const historyItem = v.object({
  inspectionId: v.string(),
  inspectionDay: v.string(),
  results: v.string(),
  risk: v.string(),
});

const trend = v.union(
  v.literal("improving"),
  v.literal("declining"),
  v.literal("steady"),
  v.literal("insufficient"),
);

export default defineSchema({
  inspections: defineTable({
    inspectionId: v.string(),
    license: v.string(),
    sourceId: v.literal("chicago"),
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
  })
    .index("by_inspectionId", ["inspectionId"])
    .index("by_license_and_date", ["license", "inspectionDay"])
    .index("by_date", ["inspectionDay"])
    .index("by_result_and_date", ["results", "inspectionDay"])
    .index("by_facility_and_date", ["facilityType", "inspectionDay"])
    .index("by_risk_and_date", ["risk", "inspectionDay"])
    .index("by_zip_and_date", ["zip", "inspectionDay"]),

  restaurants: defineTable({
    license: v.string(),
    sourceId: v.literal("chicago"),
    dbaName: v.string(),
    akaName: v.string(),
    searchName: v.string(),
    address: v.string(),
    city: v.string(),
    state: v.string(),
    zip: v.string(),
    facilityType: v.string(),
    risk: v.string(),
    latitude: v.union(v.number(), v.null()),
    longitude: v.union(v.number(), v.null()),
    history: v.array(historyItem),
    passRate: v.union(v.number(), v.null()),
    passCount: v.number(),
    scoredCount: v.number(),
    failCount: v.number(),
    trend,
    outOfBusiness: v.boolean(),
    latestResult: v.string(),
    latestInspectionDay: v.string(),
    latestInspectionId: v.string(),
  })
    .index("by_license", ["license"])
    .index("by_zip", ["zip"])
    .searchIndex("search_name", {
      searchField: "searchName",
      filterFields: ["zip", "facilityType", "risk", "latestResult"],
    })
    .searchIndex("search_address", {
      searchField: "address",
      filterFields: ["zip", "facilityType", "risk", "latestResult"],
    }),

  syncRuns: defineTable({
    sourceId: v.string(),
    mode: v.union(v.literal("incremental"), v.literal("backfill")),
    startedAt: v.number(),
    finishedAt: v.union(v.number(), v.null()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
    ),
    rowsFetched: v.number(),
    rowsUpserted: v.number(),
    error: v.union(v.string(), v.null()),
    dataAsOf: v.union(v.string(), v.null()),
  }).index("by_started", ["startedAt"]),

  ingestCursors: defineTable({
    sourceId: v.string(),
    mode: v.union(v.literal("incremental"), v.literal("backfill")),
    offset: v.number(),
    since: v.union(v.string(), v.null()),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
      v.literal("idle"),
    ),
    attempt: v.number(),
    runId: v.union(v.id("syncRuns"), v.null()),
    lastError: v.union(v.string(), v.null()),
    updatedAt: v.number(),
  }).index("by_source_and_mode", ["sourceId", "mode"]),

  datasetState: defineTable({
    key: v.string(),
    dataAsOf: v.union(v.string(), v.null()),
    facilityTypes: v.array(v.string()),
    risks: v.array(v.string()),
  }).index("by_key", ["key"]),
});
