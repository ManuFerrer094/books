-- Run against a database with schema.sql and migration 001 applied.
-- Everything created by this test is rolled back.
BEGIN;
DO $$
DECLARE first_book jsonb; second_book jsonb; before_books bigint; before_authors bigint;
BEGIN
  first_book := public.create_book_with_authors('{"title":"Transaction test A","isbn":"test-atomic-a","authors":[{"name":" Test Author A "},{"name":"Test Author B"},{"name":"Test Author A"}]}');
  IF jsonb_array_length(first_book->'authors') <> 2 THEN
    RAISE EXCEPTION 'Repeated author relationships were not deduplicated';
  END IF;
  second_book := public.create_book_with_authors('{"title":"Transaction test B","authors":[{"name":"Test Author A"}]}');
  IF (SELECT count(*) FROM public.authors WHERE name = 'Test Author A') <> 1 THEN
    RAISE EXCEPTION 'Shared author was duplicated';
  END IF;
  SELECT count(*) INTO before_books FROM public.books;
  SELECT count(*) INTO before_authors FROM public.authors;
  BEGIN
    PERFORM public.create_book_with_authors(jsonb_build_object('title', 'Must roll back', 'authors',
      jsonb_build_array(jsonb_build_object('name', 'AAA temporary author'), jsonb_build_object('name', repeat('z', 256)))));
    RAISE EXCEPTION 'Expected invalid author to fail';
  EXCEPTION WHEN string_data_right_truncation THEN NULL;
  END;
  IF (SELECT count(*) FROM public.books) <> before_books OR
     (SELECT count(*) FROM public.authors) <> before_authors THEN
    RAISE EXCEPTION 'Failed creation left partial data';
  END IF;
  BEGIN
    PERFORM public.create_book_with_authors('{"title":"Duplicate","isbn":"test-atomic-a","authors":[{"name":"Should not exist"}]}');
    RAISE EXCEPTION 'Expected duplicate ISBN to fail';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.authors WHERE name = 'Should not exist') THEN
    RAISE EXCEPTION 'Duplicate ISBN created an author';
  END IF;
  BEGIN
    PERFORM public.update_book_with_authors((first_book->>'id')::integer,
      '{"title":"Should roll back","authors":[{"name":""}]}');
    RAISE EXCEPTION 'Expected invalid update to fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF public.book_document((first_book->>'id')::integer) IS DISTINCT FROM first_book THEN
    RAISE EXCEPTION 'Failed update changed book or relationships';
  END IF;
  second_book := public.update_book_with_authors((first_book->>'id')::integer, '{"authors":[]}');
  IF jsonb_array_length(second_book->'authors') <> 0 THEN
    RAISE EXCEPTION 'Empty authors did not clear relationships';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.authors WHERE name = 'Test Author A') THEN
    RAISE EXCEPTION 'Removing a relationship deleted a shared author';
  END IF;
END;
$$;
ROLLBACK;
