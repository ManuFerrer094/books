-- Run after migrations 001–005, before deploying this version.
-- Loans, notes and ratings belong to each user's copy, never the shared catalog.
BEGIN;
ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS is_lent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lent_to text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS rating smallint;

ALTER TABLE public.user_books DROP CONSTRAINT IF EXISTS user_books_loan;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_loan CHECK (
  (is_lent OR lent_to IS NULL)
  AND (lent_to IS NULL OR (char_length(lent_to) BETWEEN 1 AND 200 AND btrim(lent_to) <> ''))
);
ALTER TABLE public.user_books DROP CONSTRAINT IF EXISTS user_books_notes;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_notes
  CHECK (notes IS NULL OR char_length(notes) <= 10000);
ALTER TABLE public.user_books DROP CONSTRAINT IF EXISTS user_books_rating;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_rating
  CHECK (rating IS NULL OR rating BETWEEN 0 AND 5);
-- Existing user_books RLS policies already restrict all four columns to the owner.
COMMIT;
