-- Migrate suburb_demographics primary key from postcode to (postcode, suburb_name).
-- Also removes FK constraints that assume postcode alone is unique.

BEGIN;

ALTER TABLE IF EXISTS suburb_scores
  DROP CONSTRAINT IF EXISTS suburb_scores_postcode_fkey;

ALTER TABLE IF EXISTS suburb_demographics
  DROP CONSTRAINT IF EXISTS suburb_demographics_pkey;

ALTER TABLE IF EXISTS suburb_demographics
  ADD CONSTRAINT suburb_demographics_pkey PRIMARY KEY (postcode, suburb_name);

COMMIT;

