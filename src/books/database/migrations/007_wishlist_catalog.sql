-- Run after migrations 001–006, before deploying the catalogue and wishlist.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_wishlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id integer NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX IF NOT EXISTS user_wishlist_book_id_idx ON public.user_wishlist(book_id);
ALTER TABLE public.user_wishlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_wishlist FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_wishlist TO authenticated;
GRANT ALL ON public.user_wishlist TO service_role;
DROP POLICY IF EXISTS wishlist_select_own ON public.user_wishlist;
CREATE POLICY wishlist_select_own ON public.user_wishlist FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS wishlist_insert_own ON public.user_wishlist;
CREATE POLICY wishlist_insert_own ON public.user_wishlist FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS wishlist_delete_own ON public.user_wishlist;
CREATE POLICY wishlist_delete_own ON public.user_wishlist FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- This catalogue reads only shared book/author data, with no ownership joins.
-- Pagination also avoids Supabase's default row limit truncating the catalogue.
CREATE OR REPLACE FUNCTION public.browse_catalog(
  search_query text DEFAULT '', page_number integer DEFAULT 1, page_size integer DEFAULT 24
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
DECLARE result jsonb; term text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF search_query IS NULL OR char_length(search_query) > 200
    OR page_number IS NULL OR page_number < 1 OR page_size IS NULL OR page_size NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid catalogue query' USING ERRCODE = '22023';
  END IF;
  term := translate(lower(btrim(search_query)), 'áéíóúüñ', 'aeiouun');
  WITH filtered AS (
    SELECT b.* FROM public.books b
    WHERE term = ''
      OR strpos(translate(lower(b.title), 'áéíóúüñ', 'aeiouun'), term) > 0
      OR strpos(lower(coalesce(b.isbn, '')), term) > 0
      OR EXISTS (
        SELECT 1 FROM public.book_authors ba JOIN public.authors a ON a.id = ba.author_id
        WHERE ba.book_id = b.id AND strpos(translate(lower(a.name), 'áéíóúüñ', 'aeiouun'), term) > 0
      )
  ), page_rows AS (
    SELECT b.id, b.title, b.isbn, b.publisher, b.publication_date, b.pages,
      b.language, b.cover_url, b.created_at, b.updated_at,
      coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) ORDER BY a.name, a.id)
        FROM public.book_authors ba JOIN public.authors a ON a.id = ba.author_id
        WHERE ba.book_id = b.id), '[]'::jsonb) AS authors
    FROM filtered b ORDER BY lower(b.title), b.id
    LIMIT page_size OFFSET ((page_number - 1)::bigint * page_size)
  )
  SELECT jsonb_build_object(
    'books', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY lower(p.title), p.id) FROM page_rows p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered), 'page', page_number, 'page_size', page_size
  ) INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.browse_catalog(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.browse_catalog(text, integer, integer) TO authenticated;
COMMIT;
