import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Convex cron hours are UTC (https://docs.convex.dev/scheduling/cron-jobs).
// 11:17 UTC is 6:17 AM Central Daylight Time and 5:17 AM Central Standard Time,
// the single daily slot closest to ~6:00 AM America/Chicago.
crons.daily(
  "chicago-incremental-sync",
  { hourUTC: 11, minuteUTC: 17 },
  internal.sync.startIncremental,
);

export default crons;
