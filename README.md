# Catwatcher

Catwatcher is a Vue and Vite single-page app for understanding local pet cat wildlife impact in Victoria.

Core features:

- Wildlife Risk Map with 5km threatened-species records and conservation-status filters
- Suburb Cat Impact Score with source-backed score components and LGA ranking
- Cat's Scoreboard with prevented-vs-caused encounter estimates and weekly trend
- Our Mission page with live evidence from the project database

## Run

```bash
npm install
npm run dev
```

## Database setup (PostgreSQL/PostGIS)

The API handlers in `server/api-handlers` support your existing schema:

- `suburb_demographics`
- `species_cache`
- `users`
- `reserves`
- `suburb_scores`
- `cat_ownership_rates`
- `cats_behaviour_stats`

The project queries the real database directly for:

- suburb lookup
- species points and conservation status
- peak activity and Cat schedule overlap
- nearest reserve boundary and distance
- pre-computed Cat Impact Score components and LGA comparison ranking

## Notes

- Vercel sees only one function file: `api/index.js`.
- During local dev, Vite serves all `/api/...` requests through the same router in `server/api-router.js`.
