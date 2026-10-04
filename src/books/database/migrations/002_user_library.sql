-- Supabase: run after schema.sql and migration 001. No existing books are deleted.
BEGIN;
CREATE TABLE IF NOT EXISTS public.user_books (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id integer NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reading', 'read')),
  added_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX IF NOT EXISTS user_books_book_id_idx ON public.user_books(book_id);
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_books FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_books TO authenticated, service_role;

DROP POLICY IF EXISTS user_books_select_own ON public.user_books;
CREATE POLICY user_books_select_own ON public.user_books FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_books_insert_own ON public.user_books;
CREATE POLICY user_books_insert_own ON public.user_books FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_books_update_own ON public.user_books;
CREATE POLICY user_books_update_own ON public.user_books FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS user_books_delete_own ON public.user_books;
CREATE POLICY user_books_delete_own ON public.user_books FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Catalog mutations go through Nest, whose server key stays on the backend.
-- Block direct edits/RPCs that would bypass the administrator guards.
REVOKE ALL ON public.books, public.authors, public.book_authors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.books, public.authors, public.book_authors TO authenticated;
GRANT ALL ON public.books, public.authors, public.book_authors TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.books_id_seq, public.authors_id_seq TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_authors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS books_read_authenticated ON public.books;
CREATE POLICY books_read_authenticated ON public.books FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS authors_read_authenticated ON public.authors;
CREATE POLICY authors_read_authenticated ON public.authors FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS book_authors_read_authenticated ON public.book_authors;
CREATE POLICY book_authors_read_authenticated ON public.book_authors FOR SELECT TO authenticated USING (true);

REVOKE EXECUTE ON FUNCTION public.create_book_with_authors(jsonb),
  public.update_book_with_authors(integer,jsonb), public.replace_book_authors(integer,jsonb),
  public.book_document(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_book_with_authors(jsonb),
  public.update_book_with_authors(integer,jsonb), public.replace_book_authors(integer,jsonb),
  public.book_document(integer) TO service_role;
COMMIT;
