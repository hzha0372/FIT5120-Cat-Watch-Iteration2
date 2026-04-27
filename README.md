# Cat Watch (FIT5120 - US1.1 to US1.3)

This project now implements the new **Cat Watch** wildlife risk map features:

- US1.1 Interactive Risk Map (5km species pins, colour-coded by status)
- US1.2 Risk Warning Card (species details + overlap with Cat's roaming schedule)
- US1.3 Closest No-go Zone (nearest reserve polygon + distance)
- US4.1/US4.2 Suburb Cat Impact Score (pre-computed suburb_scores + LGA ranking)
- Coverage update: project scope has expanded from Melbourne pilot work to statewide Victoria.

## Run

```bash
npm install
npm run dev
```

## Database setup (PostgreSQL/PostGIS)

The API route `api/catwatch.js` supports your existing schema:

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

## Pair Programming

For team development, follow the Pair Programming document:
- Assign one `Driver` and one `Navigator` at the start of each coding session.
- Swap `Driver` and `Navigator` roles regularly during the session.

## Notes

- Replace `/public/images/catwatch-logo.png` with your final Cat Watch logo file.
- During local dev, Vite serves `/api/catwatch`, `/api/suburbs`, and `/api/cat-impact-score` via middleware in `vite.config.js`.
