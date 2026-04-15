import { Pool } from 'pg'

const db = new Pool({
  host: process.env.PGHOST || '130.162.194.202',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'P@ssw0rd',
  database: process.env.PGDATABASE || 'echoes_of_earth',
})

const postcode = '3029'

const q1 = await db.query(
  `SELECT COUNT(DISTINCT LOWER(TRIM(scientific_name)))::int AS c
   FROM species_cache
   WHERE TRIM(postcode) = $1
     AND (
       LOWER(COALESCE(state_conservation, '')) LIKE '%endangered%'
       OR LOWER(COALESCE(state_conservation, '')) LIKE '%vulnerable%'
     )`,
  [postcode],
)

const q2 = await db.query(
  `SELECT COUNT(*)::int AS c
   FROM species_cache
   WHERE TRIM(postcode) = $1`,
  [postcode],
)

const q3 = await db.query(
  `SELECT COUNT(DISTINCT CONCAT(LOWER(TRIM(scientific_name)), '|', ROUND(lat::numeric,5)::text, '|', ROUND(lng::numeric,5)::text))::int AS c
   FROM species_cache
   WHERE TRIM(postcode) = $1
     AND lat IS NOT NULL
     AND lng IS NOT NULL`,
  [postcode],
)

const q4 = await db.query(
  `WITH first350 AS (
     SELECT scientific_name, state_conservation, lat, lng
     FROM species_cache
     WHERE TRIM(postcode) = $1
       AND lat IS NOT NULL
       AND lng IS NOT NULL
     LIMIT 350
   ),
   dedup AS (
     SELECT DISTINCT
       LOWER(TRIM(scientific_name)) AS sn,
       ROUND(lat::numeric,5) AS lat5,
       ROUND(lng::numeric,5) AS lng5,
       state_conservation
     FROM first350
   )
   SELECT COUNT(*) FILTER (
     WHERE LOWER(COALESCE(state_conservation, '')) LIKE '%endangered%'
        OR LOWER(COALESCE(state_conservation, '')) LIKE '%critical%'
        OR LOWER(COALESCE(state_conservation, '')) LIKE '%vulnerable%'
   )::int AS threatened_in_first350
   FROM dedup`,
  [postcode],
)

console.log({
  threatened_distinct_species_endangered_vulnerable: q1.rows[0].c,
  total_rows: q2.rows[0].c,
  dedup_species_coord_all: q3.rows[0].c,
  threatened_points_like_map_first350: q4.rows[0].threatened_in_first350,
})

await db.end()
