-- Supabase/PostgreSQL with schema and migrations 001–007 applied.
-- Run on a test database; all fixture data is rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.wish_book_a', (public.create_book_with_authors(
  '{"title":"Wishlist fixture Árboles","isbn":"9788484454892","authors":[{"name":"Wishlist fixture María"}]}'
)->>'id'), true);
SELECT set_config('test.wish_book_b', (public.create_book_with_authors(
  '{"title":"Wishlist fixture Bosque","authors":[{"name":"Wishlist fixture María"}]}'
)->>'id'), true);
INSERT INTO public.user_books(user_id, book_id, status, notes, rating, is_lent, lent_to, metadata) VALUES
  ('22222222-2222-4222-8222-222222222222', current_setting('test.wish_book_a')::integer,
   'read', 'Private notes invisible to the catalogue', 5, true, 'Private borrower', '{"title":"Private title"}');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
INSERT INTO public.user_wishlist(user_id, book_id, added_at) VALUES
  (auth.uid(), current_setting('test.wish_book_a')::integer, '2026-01-01');
INSERT INTO public.user_wishlist(user_id, book_id) VALUES
  (auth.uid(), current_setting('test.wish_book_a')::integer)
  ON CONFLICT (user_id, book_id) DO NOTHING;
DO $$ DECLARE response jsonb; first_page jsonb; second_page jsonb; changed integer; BEGIN
  IF (SELECT count(*) FROM public.user_wishlist) <> 1
    OR (SELECT added_at FROM public.user_wishlist) <> '2026-01-01'::timestamptz THEN
    RAISE EXCEPTION 'Duplicate wish changed the original entry';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_books) THEN
    RAISE EXCEPTION 'Wish acquired ownership or leaked another library';
  END IF;
  IF has_table_privilege('authenticated', 'public.user_wishlist', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.user_wishlist', 'UPDATE') THEN
    RAISE EXCEPTION 'Default privileges grant destructive access';
  END IF;
  BEGIN
    INSERT INTO public.user_wishlist(user_id, book_id) VALUES
      ('22222222-2222-4222-8222-222222222222', current_setting('test.wish_book_b')::integer);
    RAISE EXCEPTION 'Forged wishlist ownership allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.user_wishlist(user_id, book_id) VALUES (auth.uid(), -123456);
    RAISE EXCEPTION 'Nonexistent catalogue book accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  response := public.browse_catalog('wishlist fixture arboles', 1, 24);
  IF (response->>'total')::integer <> 1 OR response->'books'->0->>'title' <> 'Wishlist fixture Árboles'
    OR response->'books'->0->'authors'->0->>'name' <> 'Wishlist fixture María' THEN
    RAISE EXCEPTION 'Catalogue did not return shared metadata with accent-insensitive search';
  END IF;
  IF (response->'books'->0) ?| ARRAY['user_id', 'owner', 'email', 'status', 'rating', 'notes', 'lent_to', 'is_lent', 'metadata', 'cover_image_path', 'spine']
    OR position('Private' in response::text) > 0 THEN
    RAISE EXCEPTION 'Catalogue leaked private data';
  END IF;
  response := public.browse_catalog('wishlist fixture maria', 1, 24);
  IF (response->>'total')::integer <> 2 THEN RAISE EXCEPTION 'Author search failed'; END IF;
  response := public.browse_catalog('9788484454892', 1, 24);
  IF (response->>'total')::integer <> 1 THEN RAISE EXCEPTION 'ISBN search failed'; END IF;
  first_page := public.browse_catalog('wishlist fixture', 1, 1);
  second_page := public.browse_catalog('wishlist fixture', 2, 1);
  IF jsonb_array_length(first_page->'books') <> 1 OR jsonb_array_length(second_page->'books') <> 1
    OR first_page->'books'->0->>'id' = second_page->'books'->0->>'id'
    OR (first_page->>'total')::integer <> 2 THEN
    RAISE EXCEPTION 'Pagination lost or duplicated a book';
  END IF;
  response := public.browse_catalog('wishlist fixture', 3, 1);
  IF jsonb_array_length(response->'books') <> 0 THEN RAISE EXCEPTION 'Out-of-range page not empty'; END IF;
  BEGIN
    PERFORM public.browse_catalog('', 0, 24);
    RAISE EXCEPTION 'Invalid page accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.browse_catalog('', 1, 101);
    RAISE EXCEPTION 'Unbounded page size accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    UPDATE public.user_wishlist SET added_at = now();
    RAISE EXCEPTION 'Unexpected update grant';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ DECLARE changed integer; BEGIN
  IF EXISTS (SELECT 1 FROM public.user_wishlist) THEN RAISE EXCEPTION 'Another reader wish was visible'; END IF;
  DELETE FROM public.user_wishlist WHERE user_id = '11111111-1111-4111-8111-111111111111';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'Deleted another reader wish'; END IF;
  INSERT INTO public.user_wishlist(user_id, book_id) VALUES (auth.uid(), current_setting('test.wish_book_a')::integer);
END $$;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DELETE FROM public.user_wishlist WHERE book_id = current_setting('test.wish_book_a')::integer;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.user_wishlist) THEN RAISE EXCEPTION 'Own wish removal failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_wishlist WHERE book_id = current_setting('test.wish_book_a')::integer) <> 1
    OR (SELECT count(*) FROM public.user_books WHERE book_id = current_setting('test.wish_book_a')::integer) <> 1 THEN
    RAISE EXCEPTION 'Removal affected another wishlist or ownership';
  END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM * FROM public.user_wishlist;
    RAISE EXCEPTION 'Anonymous wishlist read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.browse_catalog();
    RAISE EXCEPTION 'Anonymous catalogue read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
