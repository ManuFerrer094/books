-- Apply after schema.sql, using the Supabase SQL editor or psql.
-- SECURITY INVOKER preserves the caller's privileges and RLS policies.
CREATE OR REPLACE FUNCTION public.book_document(target_id integer)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT to_jsonb(b) || jsonb_build_object('authors', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) ORDER BY a.id)
    FROM public.book_authors ba JOIN public.authors a ON a.id = ba.author_id
    WHERE ba.book_id = b.id
  ), '[]'::jsonb)) FROM public.books b WHERE b.id = target_id;
$$;

CREATE OR REPLACE FUNCTION public.replace_book_authors(target_id integer, author_list jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE author_name text; resolved_id integer;
BEGIN
  IF jsonb_typeof(author_list) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'authors must be an array' USING ERRCODE = '23514';
  END IF;
  DELETE FROM public.book_authors WHERE book_id = target_id;
  -- Stable ordering reduces deadlocks when concurrent books share authors.
  FOR author_name IN
    SELECT DISTINCT btrim(item->>'name') FROM jsonb_array_elements(author_list) item
    ORDER BY 1
  LOOP
    IF author_name IS NULL OR author_name = '' THEN
      RAISE EXCEPTION 'author name is required' USING ERRCODE = '23514';
    END IF;
    INSERT INTO public.authors(name) VALUES (author_name)
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO resolved_id;
    INSERT INTO public.book_authors(book_id, author_id) VALUES (target_id, resolved_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_book_with_authors(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE new_id integer; fields public.books;
BEGIN
  fields := jsonb_populate_record(NULL::public.books, payload);
  INSERT INTO public.books(isbn, title, publisher, publication_date, pages, language, cover_url)
  VALUES (fields.isbn, fields.title, fields.publisher, fields.publication_date,
          fields.pages, fields.language, fields.cover_url)
  RETURNING id INTO new_id;
  PERFORM public.replace_book_authors(new_id, COALESCE(payload->'authors', '[]'::jsonb));
  RETURN public.book_document(new_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_book_with_authors(target_id integer, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE fields public.books;
BEGIN
  SELECT * INTO fields FROM public.books WHERE id = target_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  fields := jsonb_populate_record(fields, payload);
  UPDATE public.books SET isbn = fields.isbn, title = fields.title,
    publisher = fields.publisher, publication_date = fields.publication_date,
    pages = fields.pages, language = fields.language, cover_url = fields.cover_url,
    updated_at = CURRENT_TIMESTAMP WHERE id = target_id;
  IF payload ? 'authors' THEN
    PERFORM public.replace_book_authors(target_id, payload->'authors');
  END IF;
  RETURN public.book_document(target_id);
END;
$$;
