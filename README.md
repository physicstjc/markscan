# MarkScan

Optical Mark Sheet marking software. Scanned PDFs, student directories, answers,
scores, and reports remain in the browser.

## Analytics

Analytics are opt-in and disabled automatically on `localhost`, loopback hosts,
and `file:` URLs.

- Google Analytics 4 records consented page and product events using measurement
  ID `G-7VK5RL8WPN`.
- Neon stores only validated aggregate product events through Vercel Functions.
- The public `/metrics` page reads aggregate usage figures from Neon.
- Filenames, uploaded files, student names and IDs, exam titles, answers, marks,
  and scores are never included in analytics payloads.

The database is created lazily on the first analytics request. The equivalent
SQL is available in [`db/schema.sql`](db/schema.sql) for inspection or manual
setup in Neon or TablePlus.

## Vercel setup

1. Import this repository into Vercel.
2. Add a Neon integration or create a Neon database.
3. Add its pooled connection string as `DATABASE_URL` for Production, Preview,
   and Development as appropriate.
4. Deploy. Vercel serves `metrics.html` at `/metrics` through `cleanUrls`.

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANALYTICS_ENABLED` | `true` | Set to `false` to disable event ingestion. |
| `METRICS_ENABLED` | `true` | Set to `false` to disable the metrics API. |
| `METRICS_ACCESS_TOKEN` | empty | When set, `/metrics` prompts for this token. |

Copy `.env.example` to `.env.local` for local Vercel development. Do not commit
database credentials.

```bash
npm install
npm run dev
```

Run the payload privacy checks with:

```bash
npm test
```
