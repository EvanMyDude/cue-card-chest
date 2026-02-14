-- Enable the pgcrypto extension (provides digest function for checksums)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;