-- Run after migrations 001, 002 and 003. Existing catalog data is unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.valid_personal_book_metadata(document jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp AS $$
DECLARE
  field record;
  author jsonb;
  content text;
BEGIN
  IF document IS NULL OR jsonb_typeof(document) <> 'object' THEN RETURN false; END IF;
  FOR field IN SELECT key, value FROM jsonb_each(document) LOOP
    IF field.key NOT IN ('title', 'authors', 'isbn', 'publisher', 'publication_date', 'pages', 'language', 'cover_url') THEN
      RETURN false;
    END IF;
    IF field.value = 'null'::jsonb THEN
      IF field.key IN ('title', 'authors') THEN RETURN false; END IF;
      CONTINUE;
    END IF;
    IF field.key = 'authors' THEN
      IF jsonb_typeof(field.value) <> 'array' THEN RETURN false; END IF;
      FOR author IN SELECT value FROM jsonb_array_elements(field.value) LOOP
        IF jsonb_typeof(author) <> 'object' OR NOT (author ? 'name')
          OR author - 'name' <> '{}'::jsonb OR jsonb_typeof(author->'name') <> 'string'
          OR length(btrim(author->>'name')) = 0 OR length(author->>'name') > 255 THEN
          RETURN false;
        END IF;
      END LOOP;
    ELSIF field.key = 'pages' THEN
      IF jsonb_typeof(field.value) <> 'number' OR field.value::text !~ '^[0-9]+$'
        OR field.value::text::numeric < 1 OR field.value::text::numeric > 2147483647 THEN
        RETURN false;
      END IF;
    ELSE
      IF jsonb_typeof(field.value) <> 'string' THEN RETURN false; END IF;
      content := field.value #>> '{}';
      IF field.key = 'title' AND (length(btrim(content)) = 0 OR length(content) > 500) THEN RETURN false; END IF;
      IF field.key = 'isbn' AND length(content) > 20 THEN RETURN false; END IF;
      IF field.key = 'publisher' AND length(content) > 255 THEN RETURN false; END IF;
      IF field.key = 'language' AND length(content) > 50 THEN RETURN false; END IF;
      IF field.key = 'cover_url' AND (length(content) > 1000 OR content !~* '^https?://[^[:space:]]+$') THEN RETURN false; END IF;
      IF field.key = 'publication_date' THEN
        IF content !~ '^\d{4}-\d{2}-\d{2}$' OR (content::date)::text <> content THEN RETURN false; END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RETURN false;
END $$;

ALTER TABLE public.user_books
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.user_books DROP CONSTRAINT IF EXISTS user_books_metadata_valid;
ALTER TABLE public.user_books ADD CONSTRAINT user_books_metadata_valid
  CHECK (public.valid_personal_book_metadata(metadata));

-- Atomic merge prevents concurrent edits to different fields from overwriting each other.
-- SQL NULL resets all overrides; JSON null clears an optional personal field.
CREATE OR REPLACE FUNCTION public.update_personal_book_metadata(
  requested_book_id integer, metadata_patch jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public, pg_temp AS $$
DECLARE changed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF metadata_patch IS NOT NULL AND NOT public.valid_personal_book_metadata(metadata_patch) THEN
    RAISE EXCEPTION 'Invalid personal book metadata' USING ERRCODE = '22023';
  END IF;
  UPDATE public.user_books
    SET metadata = CASE WHEN metadata_patch IS NULL THEN '{}'::jsonb ELSE metadata || metadata_patch END,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = auth.uid() AND book_id = requested_book_id
    RETURNING true INTO changed;
  RETURN COALESCE(changed, false);
END $$;

REVOKE ALL ON FUNCTION public.valid_personal_book_metadata(jsonb),
  public.update_personal_book_metadata(integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_personal_book_metadata(jsonb),
  public.update_personal_book_metadata(integer, jsonb) TO authenticated, service_role;
COMMIT;
