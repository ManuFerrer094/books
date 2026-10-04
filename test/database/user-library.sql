-- Supabase with migration 002 applied. Test data is rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
-- Current migration prevents direct public/catalog writes.
DO $$ BEGIN
  IF has_function_privilege('authenticated', 'public.create_book_with_authors(jsonb)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.books', 'DELETE')
     OR has_table_privilege('anon', 'public.user_books', 'SELECT') THEN
    RAISE EXCEPTION 'Unexpected direct catalog or anonymous library permissions';
  END IF;
END $$;
SELECT set_config('test.library_book_id', (public.create_book_with_authors(
  '{"title":"Shared library test","authors":[{"name":"Library test author"}]}'
)->>'id'), true);
INSERT INTO public.user_books(user_id, book_id, status) VALUES
 ('11111111-1111-4111-8111-111111111111', current_setting('test.library_book_id')::integer, 'reading'),
 ('22222222-2222-4222-8222-222222222222', current_setting('test.library_book_id')::integer, 'pending');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
DO $$ DECLARE changed bigint; BEGIN
  IF (SELECT count(*) FROM public.user_books) <> 1 THEN
    RAISE EXCEPTION 'RLS exposed another user library';
  END IF;
  INSERT INTO public.user_books(user_id, book_id) VALUES
    ('11111111-1111-4111-8111-111111111111', current_setting('test.library_book_id')::integer)
    ON CONFLICT (user_id, book_id) DO NOTHING;
  IF (SELECT status FROM public.user_books) <> 'reading' THEN
    RAISE EXCEPTION 'Duplicate addition changed existing status';
  END IF;
  UPDATE public.user_books SET status = 'read' WHERE user_id = '22222222-2222-4222-8222-222222222222';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Updated someone else library'; END IF;
  DELETE FROM public.user_books WHERE user_id = '22222222-2222-4222-8222-222222222222';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Deleted someone else library'; END IF;
  BEGIN
    INSERT INTO public.user_books(user_id, book_id) VALUES
      ('22222222-2222-4222-8222-222222222222', current_setting('test.library_book_id')::integer);
    RAISE EXCEPTION 'Forged ownership was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  DELETE FROM public.user_books WHERE user_id = '11111111-1111-4111-8111-111111111111';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_books WHERE book_id = current_setting('test.library_book_id')::integer) <> 1 THEN
    RAISE EXCEPTION 'Removing one library entry changed the other user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.books WHERE id = current_setting('test.library_book_id')::integer) THEN
    RAISE EXCEPTION 'Removing from library deleted shared book';
  END IF;
  BEGIN
    DELETE FROM public.books WHERE id = current_setting('test.library_book_id')::integer;
    RAISE EXCEPTION 'Deleted a book still in another user library';
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN NULL;
  END;
END $$;
ROLLBACK;
