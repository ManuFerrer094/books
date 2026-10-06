-- Supabase/PostgreSQL with migrations 001–007 applied, in a test database.
-- Verifies the database cascade used by Auth's hard user deletion.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.account_book', (public.create_book_with_authors(
  '{"title":"Shared book for account deletion","authors":[{"name":"Shared author for account deletion"}]}'
)->>'id'), true);
INSERT INTO public.user_books(user_id, book_id, status, notes, rating) VALUES
  ('11111111-1111-4111-8111-111111111111', current_setting('test.account_book')::integer, 'reading', 'Private A', 0),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.account_book')::integer, 'read', 'Private B', 5);
INSERT INTO public.user_wishlist(user_id, book_id) VALUES
  ('11111111-1111-4111-8111-111111111111', current_setting('test.account_book')::integer),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.account_book')::integer);
INSERT INTO public.user_bookshelf(user_id, book_ids) VALUES
  ('11111111-1111-4111-8111-111111111111', ARRAY[current_setting('test.account_book')::integer]),
  ('22222222-2222-4222-8222-222222222222', ARRAY[current_setting('test.account_book')::integer]);
DELETE FROM auth.users WHERE id = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.user_books WHERE user_id = '11111111-1111-4111-8111-111111111111')
    OR EXISTS (SELECT 1 FROM public.user_wishlist WHERE user_id = '11111111-1111-4111-8111-111111111111')
    OR EXISTS (SELECT 1 FROM public.user_bookshelf WHERE user_id = '11111111-1111-4111-8111-111111111111') THEN
    RAISE EXCEPTION 'Personal rows survived account deletion';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.books WHERE id = current_setting('test.account_book')::integer)
    OR NOT EXISTS (SELECT 1 FROM public.book_authors WHERE book_id = current_setting('test.account_book')::integer) THEN
    RAISE EXCEPTION 'Account deletion removed shared catalogue data';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_books WHERE user_id = '22222222-2222-4222-8222-222222222222' AND notes = 'Private B' AND rating = 5)
    OR NOT EXISTS (SELECT 1 FROM public.user_wishlist WHERE user_id = '22222222-2222-4222-8222-222222222222')
    OR NOT EXISTS (SELECT 1 FROM public.user_bookshelf WHERE user_id = '22222222-2222-4222-8222-222222222222') THEN
    RAISE EXCEPTION 'Account deletion affected another reader';
  END IF;
END; $$;
ROLLBACK;
