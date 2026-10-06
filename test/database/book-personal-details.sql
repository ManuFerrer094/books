-- Supabase/PostgreSQL with migrations 001–006 applied. Test data is rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.personal_book', (public.create_book_with_authors(
  '{"title":"Shared book for personal details"}'
)->>'id'), true);
INSERT INTO public.user_books(user_id, book_id, status) VALUES
  ('11111111-1111-4111-8111-111111111111', current_setting('test.personal_book')::integer, 'reading'),
  ('22222222-2222-4222-8222-222222222222', current_setting('test.personal_book')::integer, 'read');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $$ DECLARE changed integer; BEGIN
  IF (SELECT is_lent FROM public.user_books) IS DISTINCT FROM false
    OR (SELECT rating FROM public.user_books) IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid defaults';
  END IF;
  UPDATE public.user_books SET is_lent = true, lent_to = 'Ana', notes = 'Private notes', rating = 0;
  IF (SELECT status FROM public.user_books) IS DISTINCT FROM 'reading'
    OR (SELECT rating FROM public.user_books) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Loan changed reading state or zero rating was lost';
  END IF;
  UPDATE public.user_books SET notes = 'Forged', rating = 5
    WHERE user_id = '22222222-2222-4222-8222-222222222222';
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN RAISE EXCEPTION 'RLS allowed editing another reader'; END IF;
  BEGIN
    UPDATE public.user_books SET rating = 6;
    RAISE EXCEPTION 'Invalid rating accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.user_books SET rating = -1;
    RAISE EXCEPTION 'Negative rating accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.user_books SET lent_to = repeat('a', 201);
    RAISE EXCEPTION 'Oversized borrower accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.user_books SET lent_to = ' ';
    RAISE EXCEPTION 'Blank borrower accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.user_books SET notes = repeat('a', 10001);
    RAISE EXCEPTION 'Oversized notes accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM public.update_personal_book_metadata(current_setting('test.personal_book')::integer, NULL);
  IF (SELECT notes FROM public.user_books) IS DISTINCT FROM 'Private notes'
    OR (SELECT rating FROM public.user_books) IS DISTINCT FROM 0
    OR (SELECT lent_to FROM public.user_books) IS DISTINCT FROM 'Ana' THEN
    RAISE EXCEPTION 'Catalog reset removed personal details';
  END IF;
  UPDATE public.user_books SET is_lent = false, lent_to = NULL;
  IF (SELECT notes FROM public.user_books) IS DISTINCT FROM 'Private notes'
    OR (SELECT status FROM public.user_books) IS DISTINCT FROM 'reading' THEN
    RAISE EXCEPTION 'Return removed notes or reading state';
  END IF;
  BEGIN
    UPDATE public.user_books SET lent_to = 'Ana';
    RAISE EXCEPTION 'Borrower without loan accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.user_books SET rating = 5;
  UPDATE public.user_books SET rating = NULL, notes = NULL;
END $$;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
DO $$ BEGIN
  IF (SELECT status FROM public.user_books) IS DISTINCT FROM 'read'
    OR (SELECT notes FROM public.user_books) IS NOT NULL
    OR (SELECT rating FROM public.user_books) IS NOT NULL
    OR (SELECT is_lent FROM public.user_books) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Personal changes affected another reader';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT title FROM public.books WHERE id = current_setting('test.personal_book')::integer)
    IS DISTINCT FROM 'Shared book for personal details' THEN
    RAISE EXCEPTION 'Shared catalog was changed';
  END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM notes, rating, lent_to FROM public.user_books;
    RAISE EXCEPTION 'Anonymous read of personal details allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
