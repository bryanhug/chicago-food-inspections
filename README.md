# Chicago food inspections

Search City of Chicago food-inspection results, with a pass rate, fail count, and parsed violations for each license. Suburban Cook County is labeled not available: no open dataset was found for CCDPH or town health departments.

There is no numeric inspection score in the city data. Pass and Pass w/ Conditions count as a pass. Out of Business, No Entry, Not Ready, and Business Not Located stay out of the pass-rate denominator.

## Setup

```bash
npm install
npx convex dev
```

`npx convex dev` creates a deployment, writes `.env.local`, and syncs the `convex/` functions. Leave it running.

In a second terminal:

```bash
npm run dev
```

Open http://localhost:3000.

Optional higher Socrata rate limits use a free app token. Convex actions read it from the deployment, not from the web server:

```bash
npx convex env set CHICAGO_DATA_APP_TOKEN <token>
```

The header is `X-App-Token`. The sync works without a token.

## Backfill

Full history is about 318,000 rows since 2010. The backfill pages 1,000 rows at a time, upserts by `inspection_id`, waits between pages, and backs off on throttling and server errors. Progress is stored, so stopping and running the command again resumes the same walk.

```bash
npx convex run sync:startBackfill
```

Start over from the first page:

```bash
npx convex run sync:startBackfill '{"restart":true}'
```

A short recent slice, useful while checking the UI (this one waits until the pages finish):

```bash
npx convex run sync:startBackfill '{"since":"2026-10-20T00:00:00.000","maxPages":1}'
```

The home page shows the last sync time in Pacific Time and the newest stored inspection date.

## Daily sync

A Convex cron runs at 11:17 UTC, which is 6:17 AM Central Daylight Time and 5:17 AM Central Standard Time. It pulls `inspection_date >=` the newest stored timestamp minus 7 days, so late or corrected rows are upserted again.

## Deploy

```bash
npx convex deploy
npm run build
npm run preview
```

Set `VITE_CONVEX_URL` to the production Convex URL wherever the web app is hosted. For the production deployment's app token:

```bash
npx convex env set CHICAGO_DATA_APP_TOKEN <token> --prod
```

## Docker

Host installs are not required. `docker compose up` installs dependencies into a named `node_modules` volume, then runs `npx convex dev` and the app inside the container.

```bash
docker compose up --build
```

The app listens on port 3000. The first start needs network access so Convex can create an anonymous dev deployment.

## Checks

```bash
npm test
npm run typecheck
npm run build
npm run format:check
```
