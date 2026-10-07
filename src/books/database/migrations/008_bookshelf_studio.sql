-- Apply after 007, before deploying the studio API and frontend.
BEGIN;
ALTER TABLE public.user_bookshelf ADD COLUMN design jsonb;

CREATE FUNCTION public.validate_bookshelf_design(scene jsonb, library_ids integer[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c jsonb; s jsonb; i jsonb; n jsonb;
  identifiers text[] := '{}'; shelf_ids text[] := '{}'; used_books integer[] := '{}';
  widths jsonb := '{}'; heights jsonb := '{}'; sid text; bid integer;
  x numeric; w numeric; h numeric; sc numeric;
BEGIN
  IF scene IS NULL OR jsonb_typeof(scene) <> 'object' OR (scene->>'version') IS DISTINCT FROM '1'
    OR coalesce(scene->>'background','') NOT IN ('plain','wall','wallpaper')
    OR coalesce(scene->>'background_color','') !~ '^#[0-9a-fA-F]{6}$'
    OR jsonb_typeof(scene->'night') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(scene->'bookcases') IS DISTINCT FROM 'array'
    OR jsonb_typeof(scene->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid scene' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(scene->'bookcases') NOT BETWEEN 1 AND 20 OR jsonb_array_length(scene->'items') > 5000 THEN
    RAISE EXCEPTION 'Scene too large' USING ERRCODE = '22023';
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(scene->'bookcases') LOOP
    IF coalesce(c->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$' OR c->>'id' = ANY(identifiers)
      OR coalesce(length(c->>'name'),0) NOT BETWEEN 1 AND 80 OR jsonb_typeof(c->'name') <> 'string'
      OR coalesce(c->>'material','') NOT IN ('oak','walnut','birch','white','black')
      OR jsonb_typeof(c->'width') IS DISTINCT FROM 'number'
      OR (c->>'width')::numeric NOT BETWEEN 320 AND 1600
      OR jsonb_typeof(c->'shelves') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid bookcase' USING ERRCODE = '22023';
    END IF;
    identifiers := array_append(identifiers,c->>'id');
    IF jsonb_array_length(c->'shelves') NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Invalid shelves' USING ERRCODE = '22023';
    END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(c->'shelves') LOOP
      sid := s->>'id';
      IF coalesce(sid,'') !~ '^[a-zA-Z0-9_-]{1,100}$' OR sid = ANY(identifiers)
        OR jsonb_typeof(s->'height') IS DISTINCT FROM 'number' OR (s->>'height')::numeric NOT BETWEEN 160 AND 600
        OR coalesce(s->'light'->>'color','') !~ '^#[0-9a-fA-F]{6}$'
        OR jsonb_typeof(s->'light'->'intensity') IS DISTINCT FROM 'number' OR (s->'light'->>'intensity')::numeric NOT BETWEEN 0 AND 1
        OR jsonb_typeof(s->'light'->'garland') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Invalid shelf' USING ERRCODE = '22023';
      END IF;
      identifiers := array_append(identifiers,sid); shelf_ids := array_append(shelf_ids,sid);
      widths := widths || jsonb_build_object(sid,(c->>'width')::numeric);
      heights := heights || jsonb_build_object(sid,(s->>'height')::numeric);
    END LOOP;
  END LOOP;
  FOR i IN SELECT value FROM jsonb_array_elements(scene->'items') LOOP
    sid := i->>'shelf_id';
    IF coalesce(i->>'id','') !~ '^[a-zA-Z0-9_-]{1,100}$' OR i->>'id' = ANY(identifiers)
      OR sid IS NULL OR NOT sid = ANY(shelf_ids)
      OR coalesce(i->>'kind','') NOT IN ('book','stack','decor') OR coalesce(i->>'mode','') NOT IN ('upright','lean','cover')
      OR coalesce(i->>'color','') !~ '^#[0-9a-fA-F]{6}$' OR jsonb_typeof(i->'asset') IS DISTINCT FROM 'string'
      OR jsonb_typeof(i->'book_ids') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid item' USING ERRCODE = '22023';
    END IF;
    identifiers := array_append(identifiers,i->>'id');
    FOREACH sid IN ARRAY ARRAY['x','width','height','scale','rotation'] LOOP
      IF jsonb_typeof(i->sid) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid geometry' USING ERRCODE = '22023'; END IF;
    END LOOP;
    sid := i->>'shelf_id'; x := (i->>'x')::numeric; sc := (i->>'scale')::numeric;
    w := (i->>'width')::numeric * sc; h := (i->>'height')::numeric * sc;
    IF (i->>'width')::numeric NOT BETWEEN 8 AND 1200 OR (i->>'height')::numeric NOT BETWEEN 8 AND 580
      OR sc NOT BETWEEN 0.5 AND 1.5 OR (i->>'rotation')::numeric NOT BETWEEN -20 AND 20
      OR x < 8 OR x+w > (widths->>sid)::numeric-8 OR h > (heights->>sid)::numeric-16 THEN
      RAISE EXCEPTION 'Item outside shelf' USING ERRCODE = '22023';
    END IF;
    IF (i->>'kind' = 'book' AND jsonb_array_length(i->'book_ids') <> 1)
      OR (i->>'kind' = 'stack' AND jsonb_array_length(i->'book_ids') NOT BETWEEN 1 AND 12)
      OR (i->>'kind' = 'decor' AND (jsonb_array_length(i->'book_ids') <> 0 OR i->>'asset' NOT IN
        ('fern','monstera','ivy','cactus','flowers','bonsai','pot','ceramic-pot','vase','round-vase','candle','candles','lamp','lantern','portrait','landscape','cat','bird','moon','star','arch','mountain','divider','label','clock','mug','crystal'))) THEN
      RAISE EXCEPTION 'Invalid item contents' USING ERRCODE = '22023';
    END IF;
    FOR n IN SELECT value FROM jsonb_array_elements(i->'book_ids') LOOP
      IF n::text !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Invalid book' USING ERRCODE = '22023'; END IF;
      bid := n::text::integer;
      IF NOT bid = ANY(library_ids) OR bid = ANY(used_books) THEN RAISE EXCEPTION 'Invalid membership' USING ERRCODE = '22023'; END IF;
      used_books := array_append(used_books,bid);
    END LOOP;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT (value->>'x')::numeric AS x,
        lag((value->>'x')::numeric + (value->>'width')::numeric*(value->>'scale')::numeric + 4)
        OVER (PARTITION BY value->>'shelf_id' ORDER BY (value->>'x')::numeric) AS previous_end
      FROM jsonb_array_elements(scene->'items')
    ) positions WHERE positions.previous_end > positions.x
  ) THEN RAISE EXCEPTION 'Overlapping items' USING ERRCODE = '22023'; END IF;
END;
$$;

CREATE FUNCTION public.save_bookshelf_design(requested_book_ids integer[], expected_revision integer, requested_design jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb; projected integer[]; current_ids integer[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  -- Membership, row lock and revision are checked by the existing transaction.
  -- Validate before changing the row; any subsequent exception rolls back both fields.
  PERFORM public.validate_bookshelf_design(requested_design,requested_book_ids);
  result := public.save_bookshelf_order(requested_book_ids,expected_revision);
  SELECT coalesce(array_agg((b.value)::text::integer ORDER BY c.ordinality,s.ordinality,(i.value->>'x')::numeric,b.ordinality),'{}') INTO projected
    FROM jsonb_array_elements(requested_design->'bookcases') WITH ORDINALITY c
    CROSS JOIN LATERAL jsonb_array_elements(c.value->'shelves') WITH ORDINALITY s
    CROSS JOIN LATERAL jsonb_array_elements(requested_design->'items') i
    CROSS JOIN LATERAL jsonb_array_elements(i.value->'book_ids') WITH ORDINALITY b
    WHERE i.value->>'shelf_id' = s.value->>'id';
  SELECT coalesce(array_agg(id ORDER BY ordinality),'{}') INTO current_ids FROM unnest(requested_book_ids) WITH ORDINALITY t(id,ordinality) WHERE NOT id = ANY(projected);
  IF projected || current_ids IS DISTINCT FROM requested_book_ids THEN
    RAISE EXCEPTION 'Order does not match scene' USING ERRCODE = '22023';
  END IF;
  UPDATE public.user_bookshelf SET design = requested_design WHERE user_id = auth.uid();
  RETURN result || jsonb_build_object('design',requested_design);
END;
$$;
REVOKE ALL ON FUNCTION public.validate_bookshelf_design(jsonb,integer[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_bookshelf_design(integer[],integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.validate_bookshelf_design(jsonb,integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bookshelf_design(integer[],integer,jsonb) TO authenticated;
-- Direct table writes must satisfy the same scene checks as the API.
CREATE FUNCTION public.check_bookshelf_scene() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE library_ids integer[];
BEGIN
  IF NEW.design IS NOT NULL THEN
    SELECT coalesce(array_agg(book_id),'{}') INTO library_ids FROM public.user_books WHERE user_id = NEW.user_id;
    PERFORM public.validate_bookshelf_design(NEW.design,library_ids);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER bookshelf_scene_check BEFORE INSERT OR UPDATE OF design ON public.user_bookshelf
FOR EACH ROW EXECUTE FUNCTION public.check_bookshelf_scene();

-- Convert existing libraries once, keeping their order and private appearance.
-- Photos and colors remain on user_books; a scene only stores their placement.
INSERT INTO public.user_bookshelf(user_id,book_ids)
SELECT user_id,array_agg(book_id ORDER BY added_at DESC,book_id) FROM public.user_books GROUP BY user_id
ON CONFLICT DO NOTHING;
DO $$
DECLARE legacy record; book record; scene jsonb; items jsonb; shelves jsonb; cases jsonb;
  ordered_ids integer[]; x integer; width integer; height integer; shelf_index integer;
  case_index integer; item_count integer; shelf_id text; count_shelves integer;
BEGIN
  FOR legacy IN SELECT * FROM public.user_bookshelf LOOP
    SELECT coalesce(array_agg(b.book_id ORDER BY array_position(legacy.book_ids,b.book_id) NULLS LAST,b.added_at DESC,b.book_id),'{}')
      INTO ordered_ids FROM public.user_books b WHERE b.user_id=legacy.user_id;
    items := '[]'; cases := '[]'; x := 8; shelf_index := 0; case_index := 0; item_count := 0;
    FOR book IN SELECT b.*,catalog.pages FROM public.user_books b JOIN public.books catalog ON catalog.id=b.book_id
      WHERE b.user_id=legacy.user_id ORDER BY array_position(ordered_ids,b.book_id) LOOP
      width := coalesce(book.spine_width,round(greatest(28,least(64,26+coalesce((book.metadata->>'pages')::numeric,book.pages,220)/18)))::integer);
      height := coalesce(book.spine_height,176+(book.book_id%5)*12);
      IF x+width > 952 THEN shelf_index := shelf_index+1; x := 8; END IF;
      IF shelf_index >= 100 THEN
        SELECT jsonb_agg(jsonb_build_object('id','migrated-shelf-'||case_index||'-'||n,'height',280,'light',jsonb_build_object('color','#ffd69b','intensity',0.25,'garland',false)) ORDER BY n)
          INTO shelves FROM generate_series(0,99) n;
        cases := cases || jsonb_build_array(jsonb_build_object('id','migrated-case-'||case_index,'name','Mi estantería','width',960,'material','oak','shelves',shelves));
        case_index := case_index+1; shelf_index := 0;
      END IF;
      EXIT WHEN item_count >= 5000 OR case_index >= 20;
      shelf_id := 'migrated-shelf-'||case_index||'-'||shelf_index;
      items := items || jsonb_build_array(jsonb_build_object('id','migrated-book-'||book.book_id,'kind','book','shelf_id',shelf_id,'x',x,
        'width',width,'height',height,'book_ids',jsonb_build_array(book.book_id),'mode','upright','asset','','color','#8c9a75','scale',1,'rotation',0));
      x := x+width+4; item_count := item_count+1;
    END LOOP;
    count_shelves := greatest(3,shelf_index+1);
    SELECT jsonb_agg(jsonb_build_object('id','migrated-shelf-'||case_index||'-'||n,'height',280,'light',jsonb_build_object('color','#ffd69b','intensity',0.25,'garland',false)) ORDER BY n)
      INTO shelves FROM generate_series(0,count_shelves-1) n;
    cases := cases || jsonb_build_array(jsonb_build_object('id','migrated-case-'||case_index,'name','Mi estantería','width',960,'material','oak','shelves',shelves));
    scene := jsonb_build_object('version',1,'background','wall','background_color','#eee7dc','night',false,'bookcases',cases,'items',items);
    UPDATE public.user_bookshelf SET design=scene,book_ids=ordered_ids WHERE user_id=legacy.user_id;
  END LOOP;
END;
$$;

-- Membership changes share the scene revision. New books stay unplaced; removing
-- one book edits only its placement, including its membership of an explicit pile.
CREATE FUNCTION public.sync_bookshelf_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE next_scene jsonb; next_items jsonb; item jsonb; remaining jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_bookshelf
      SET book_ids = array_append(book_ids,NEW.book_id), revision = revision + 1
      WHERE user_id = NEW.user_id AND NOT NEW.book_id = ANY(book_ids);
    RETURN NEW;
  END IF;
  SELECT design INTO next_scene FROM public.user_bookshelf WHERE user_id = OLD.user_id FOR UPDATE;
  IF next_scene IS NOT NULL THEN
    next_items := '[]';
    FOR item IN SELECT value FROM jsonb_array_elements(next_scene->'items') LOOP
      SELECT coalesce(jsonb_agg(value),'[]') INTO remaining
        FROM jsonb_array_elements(item->'book_ids') WHERE value::text::integer <> OLD.book_id;
      IF item->>'kind' = 'decor' OR jsonb_array_length(remaining) > 0 THEN
        next_items := next_items || jsonb_build_array(jsonb_set(item,'{book_ids}',remaining));
      END IF;
    END LOOP;
    next_scene := jsonb_set(next_scene,'{items}',next_items);
  END IF;
  UPDATE public.user_bookshelf SET design = next_scene,
    book_ids = array_remove(book_ids,OLD.book_id), revision = revision + 1
    WHERE user_id = OLD.user_id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER bookshelf_membership_sync AFTER INSERT OR DELETE ON public.user_books
FOR EACH ROW EXECUTE FUNCTION public.sync_bookshelf_membership();
COMMIT;
