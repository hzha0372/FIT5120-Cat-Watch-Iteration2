# Cat Watch (FIT5120 - US1.1 to US1.3)

This project now implements the new **Cat Watch** wildlife risk map features:

- US1.1 Interactive Risk Map (5km species pins, colour-coded by status)
- US1.2 Risk Warning Card (species details + overlap with Simba's roaming schedule)
- US1.3 Closest No-go Zone (nearest reserve polygon + distance)

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

The project queries the real database directly for:
- suburb lookup
- species points and conservation status
- peak activity and Simba schedule overlap
- nearest reserve boundary and distance

## Notes

- Replace `/public/images/catwatch-logo.png` with your final Cat Watch logo file.
- During local dev, Vite serves `/api/catwatch` and `/api/suburbs` via middleware in `vite.config.js`.
