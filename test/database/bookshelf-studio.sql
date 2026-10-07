-- Run after migrations 001–008. Fixtures are rolled back.
BEGIN;
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
SELECT set_config('test.studio_book', (public.create_book_with_authors('{"title":"Studio A"}')->>'id'), true);
SELECT set_config('test.foreign_book', (public.create_book_with_authors('{"title":"Studio B"}')->>'id'), true);
INSERT INTO public.user_books(user_id,book_id) VALUES
  ('11111111-1111-4111-8111-111111111111',current_setting('test.studio_book')::integer),
  ('22222222-2222-4222-8222-222222222222',current_setting('test.foreign_book')::integer);
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE scene jsonb; bad jsonb; result jsonb; id integer := current_setting('test.studio_book')::integer;
BEGIN
  scene := jsonb_build_object('version',1,'background','wall','background_color','#eee7dc','night',false,
    'bookcases',jsonb_build_array(jsonb_build_object('id','case-a','name','My shelf','material','oak','width',960,
      'shelves',jsonb_build_array(jsonb_build_object('id','shelf-a','height',280,'light',jsonb_build_object('color','#ffd69b','intensity',0.5,'garland',true))))),
    'items',jsonb_build_array(jsonb_build_object('id','book-a','kind','book','shelf_id','shelf-a','x',8,'width',40,'height',200,'book_ids',jsonb_build_array(id),'mode','upright','asset','','color','#869375','scale',1,'rotation',0)));
  result := public.save_bookshelf_design(ARRAY[id],0,scene);
  IF result->>'revision' <> '1' OR result->'design' IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Scene not saved atomically'; END IF;
  BEGIN
    PERFORM public.save_bookshelf_design(ARRAY[id],0,scene);
    RAISE EXCEPTION 'Stale revision accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  bad := jsonb_set(scene,'{items}',(scene->'items') || jsonb_build_array(jsonb_set(scene->'items'->0,'{id}','"duplicate-book"')));
  BEGIN PERFORM public.save_bookshelf_design(ARRAY[id],1,bad); RAISE EXCEPTION 'Duplicate accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  bad := jsonb_set(scene,'{items,0,x}','950');
  BEGIN PERFORM public.save_bookshelf_design(ARRAY[id],1,bad); RAISE EXCEPTION 'Overflow accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  bad := jsonb_set(scene,'{items,0,book_ids}',jsonb_build_array(current_setting('test.foreign_book')::integer));
  BEGIN PERFORM public.save_bookshelf_design(ARRAY[id],1,bad); RAISE EXCEPTION 'Foreign book accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN UPDATE public.user_bookshelf SET design=bad; RAISE EXCEPTION 'Forged direct write accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  bad := jsonb_set(scene,'{items}',scene->'items' || jsonb_build_array(jsonb_build_object('id','decor-a','kind','decor','shelf_id','shelf-a','x',20,'width',90,'height',125,'book_ids','[]'::jsonb,'mode','upright','asset','vase','color','#b18a60','scale',1,'rotation',0)));
  BEGIN PERFORM public.save_bookshelf_design(ARRAY[id],1,bad); RAISE EXCEPTION 'Collision accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT revision FROM public.user_bookshelf) <> 1 OR (SELECT design FROM public.user_bookshelf) IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Rejected transaction changed saved scene'; END IF;
  IF has_function_privilege('anon','public.save_bookshelf_design(integer[],integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous studio access'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.user_bookshelf) THEN RAISE EXCEPTION 'Other user can read scene'; END IF;
  UPDATE public.user_bookshelf SET design=NULL WHERE user_id='11111111-1111-4111-8111-111111111111';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT revision FROM public.user_bookshelf WHERE user_id='11111111-1111-4111-8111-111111111111') <> 1
    OR (SELECT design FROM public.user_bookshelf WHERE user_id='11111111-1111-4111-8111-111111111111') IS NULL THEN RAISE EXCEPTION 'Other user changed scene'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE original jsonb; pile jsonb; saved jsonb; id integer := current_setting('test.studio_book')::integer;
  second integer := current_setting('test.foreign_book')::integer;
BEGIN
  SELECT design INTO original FROM public.user_bookshelf;
  INSERT INTO public.user_books(user_id,book_id) VALUES (auth.uid(),second);
  IF (SELECT revision FROM public.user_bookshelf) <> 2 OR (SELECT design FROM public.user_bookshelf) IS DISTINCT FROM original THEN
    RAISE EXCEPTION 'New book moved the composition';
  END IF;
  pile := jsonb_set(original,'{items,0}',(original->'items'->0) || jsonb_build_object('kind','stack','book_ids',jsonb_build_array(id,second),'width',200,'height',80));
  pile := jsonb_set(pile,'{items}',pile->'items' || jsonb_build_array(jsonb_build_object('id','kept-decor','kind','decor','shelf_id','shelf-a','x',300,'width',90,'height',125,'book_ids','[]'::jsonb,'mode','upright','asset','vase','color','#b18a60','scale',1,'rotation',0)));
  PERFORM public.save_bookshelf_design(ARRAY[id,second],2,pile);
  DELETE FROM public.user_books WHERE book_id=id;
  SELECT design INTO saved FROM public.user_bookshelf;
  IF (SELECT revision FROM public.user_bookshelf) <> 4 OR saved->'items'->0->'book_ids' IS DISTINCT FROM jsonb_build_array(second)
    OR saved->'items'->1 IS DISTINCT FROM pile->'items'->1 OR saved->'bookcases' IS DISTINCT FROM original->'bookcases' THEN
    RAISE EXCEPTION 'Removing a pile member damaged the composition';
  END IF;
  DELETE FROM public.user_books WHERE book_id=second;
  IF (SELECT design->'items' FROM public.user_bookshelf) IS DISTINCT FROM jsonb_build_array(pile->'items'->1)
    OR (SELECT book_ids FROM public.user_bookshelf) IS DISTINCT FROM '{}'::integer[] THEN
    RAISE EXCEPTION 'Removing the last book damaged decorations';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
