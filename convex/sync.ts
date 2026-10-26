import { v } from "convex/values";
import { CHICAGO_PAGE_LIMIT } from "../shared/chicagoQuery";
import {
  ChicagoFetchError,
  createChicagoAdapter,
} from "../shared/chicagoSource";
import { incrementalSince } from "../shared/chicagoQuery";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";

const PAGE_GAP_MS = 1500;
const MAX_ATTEMPTS = 8;
const STALE_RUN_MS = 15 * 60 * 1000;

const mode = v.union(v.literal("incremental"), v.literal("backfill"));

const pageArgs = {
  runId: v.id("syncRuns"),
  mode,
  offset: v.number(),
  since: v.union(v.string(), v.null()),
  attempt: v.number(),
  pagesRemaining: v.union(v.number(), v.null()),
};

type PageArgs = {
  runId: import("./_generated/dataModel").Id<"syncRuns">;
  mode: "incremental" | "backfill";
  offset: number;
  since: string | null;
  attempt: number;
  pagesRemaining: number | null;
};

type PageOutcome =
  | { kind: "done" }
  | { kind: "more"; nextOffset: number }
  | { kind: "retry"; attempt: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffMs(attempt: number): number {
  return Math.min(60_000, 1000 * 2 ** attempt);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function ingestPage(
  ctx: Pick<ActionCtx, "runMutation">,
  args: PageArgs,
): Promise<PageOutcome> {
  try {
    const adapter = createChicagoAdapter({
      appToken: process.env.CHICAGO_DATA_APP_TOKEN,
    });
    const page = await adapter.fetchPage({
      offset: args.offset,
      limit: CHICAGO_PAGE_LIMIT,
      since: args.since,
    });
    for (const rows of chunk(page.rows, 10)) {
      await ctx.runMutation(internal.ingest.upsertBatch, { rows });
    }
    let dataAsOf: string | null = null;
    const facilityTypes = new Set<string>();
    const risks = new Set<string>();
    for (const row of page.rows) {
      if (!dataAsOf || row.inspectionDay > dataAsOf)
        dataAsOf = row.inspectionDay;
      if (row.facilityType) facilityTypes.add(row.facilityType);
      if (row.risk) risks.add(row.risk);
    }
    const nextOffset = args.offset + page.received;
    const hasMore = page.received === CHICAGO_PAGE_LIMIT;
    const stopEarly =
      hasMore && args.pagesRemaining !== null && args.pagesRemaining <= 1;
    await ctx.runMutation(internal.ingest.recordProgress, {
      runId: args.runId,
      sourceId: "chicago",
      mode: args.mode,
      offset: nextOffset,
      since: args.since,
      fetched: page.received,
      upserted: page.rows.length,
      dataAsOf,
      facilityTypes: [...facilityTypes],
      risks: [...risks],
      cursorStatus:
        hasMore && !stopEarly ? "running" : stopEarly ? "idle" : "complete",
    });
    if (!hasMore) {
      await ctx.runMutation(internal.ingest.finishRun, {
        runId: args.runId,
        sourceId: "chicago",
        mode: args.mode,
        status: "success",
        cursorStatus: "complete",
        error: null,
      });
      return { kind: "done" };
    }
    if (stopEarly) {
      await ctx.runMutation(internal.ingest.finishRun, {
        runId: args.runId,
        sourceId: "chicago",
        mode: args.mode,
        status: "success",
        cursorStatus: "idle",
        error: null,
      });
      return { kind: "done" };
    }
    return { kind: "more", nextOffset };
  } catch (error) {
    const retryable =
      error instanceof ChicagoFetchError ? error.retryable : true;
    const message =
      error instanceof Error ? error.message : "Chicago sync failed";
    const attempt = args.attempt + 1;
    if (!retryable || attempt > MAX_ATTEMPTS) {
      await ctx.runMutation(internal.ingest.finishRun, {
        runId: args.runId,
        sourceId: "chicago",
        mode: args.mode,
        status: "error",
        cursorStatus: "error",
        error: message.slice(0, 500),
      });
      return { kind: "done" };
    }
    await ctx.runMutation(internal.ingest.noteError, {
      runId: args.runId,
      sourceId: "chicago",
      mode: args.mode,
      attempt,
      error: message,
    });
    return { kind: "retry", attempt };
  }
}

export const pullPage = internalAction({
  args: pageArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const outcome = await ingestPage(ctx, args);
    if (outcome.kind === "retry") {
      await ctx.scheduler.runAfter(
        backoffMs(outcome.attempt),
        internal.sync.pullPage,
        { ...args, attempt: outcome.attempt },
      );
      return null;
    }
    if (outcome.kind === "done") return null;
    const pagesRemaining =
      args.pagesRemaining === null ? null : args.pagesRemaining - 1;
    await ctx.scheduler.runAfter(PAGE_GAP_MS, internal.sync.pullPage, {
      ...args,
      offset: outcome.nextOffset,
      attempt: 0,
      pagesRemaining,
    });
    return null;
  },
});

export const runInline = internalAction({
  args: pageArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    let current: PageArgs = args;
    while (true) {
      const outcome = await ingestPage(ctx, current);
      if (outcome.kind === "retry") {
        await sleep(backoffMs(outcome.attempt));
        current = { ...current, attempt: outcome.attempt };
        continue;
      }
      if (outcome.kind === "done") return null;
      const pagesRemaining =
        current.pagesRemaining === null ? null : current.pagesRemaining - 1;
      current = {
        ...current,
        offset: outcome.nextOffset,
        attempt: 0,
        pagesRemaining,
      };
      await sleep(PAGE_GAP_MS);
    }
  },
});

export const startBackfill = action({
  args: {
    restart: v.optional(v.boolean()),
    since: v.optional(v.string()),
    maxPages: v.optional(v.number()),
  },
  returns: v.object({
    status: v.string(),
    runId: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ status: string; runId: string | null }> => {
    const requestedSince = args.since ?? null;
    const cursor: {
      status: "running" | "complete" | "error" | "idle";
      since: string | null;
      offset: number;
      updatedAt: number;
      runId: string | null;
    } | null = await ctx.runQuery(internal.ingest.getCursor, {
      sourceId: "chicago",
      mode: "backfill",
    });
    const restart = args.restart === true;
    const sameWalk =
      !restart && cursor !== null && cursor.since === requestedSince;
    if (
      sameWalk &&
      cursor.status === "complete" &&
      args.maxPages === undefined
    ) {
      return { status: "complete", runId: cursor.runId };
    }
    if (
      sameWalk &&
      cursor.status === "running" &&
      Date.now() - cursor.updatedAt < STALE_RUN_MS &&
      args.maxPages === undefined
    ) {
      return { status: "already-running", runId: cursor.runId };
    }
    const offset = sameWalk && cursor.status !== "complete" ? cursor.offset : 0;
    const runId = (await ctx.runMutation(internal.ingest.beginRun, {
      sourceId: "chicago",
      mode: "backfill",
      offset,
      since: requestedSince,
    })) as PageArgs["runId"];
    const payload: PageArgs = {
      runId,
      mode: "backfill",
      offset,
      since: requestedSince,
      attempt: 0,
      pagesRemaining: args.maxPages ?? null,
    };
    if (args.maxPages !== undefined) {
      await ctx.runAction(internal.sync.runInline, payload);
      return { status: "finished", runId };
    }
    await ctx.scheduler.runAfter(0, internal.sync.pullPage, payload);
    return { status: "started", runId };
  },
});

export const startIncremental = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const cursor = await ctx.runQuery(internal.ingest.getCursor, {
      sourceId: "chicago",
      mode: "incremental",
    });
    if (
      cursor?.status === "running" &&
      Date.now() - cursor.updatedAt < STALE_RUN_MS
    ) {
      return null;
    }
    const maxStored = await ctx.runQuery(internal.ingest.maxInspectionDate, {});
    if (!maxStored) return null;
    const since = incrementalSince(maxStored);
    const runId = await ctx.runMutation(internal.ingest.beginRun, {
      sourceId: "chicago",
      mode: "incremental",
      offset: 0,
      since,
    });
    await ctx.scheduler.runAfter(0, internal.sync.pullPage, {
      runId,
      mode: "incremental",
      offset: 0,
      since,
      attempt: 0,
      pagesRemaining: null,
    });
    return null;
  },
});
