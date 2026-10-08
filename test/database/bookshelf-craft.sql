BEGIN;
INSERT INTO auth.users(id) VALUES ('77777777-7777-4777-8777-777777777777');
SELECT set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE scene jsonb; result jsonb; bad jsonb; i integer;
BEGIN
  scene := '{"version":1,"background":"wall","background_color":"#eee7dc","night":true,"bookcases":[{"id":"case","name":"Room","style":"gilded","lights_on":false,"material":"oak","width":960,"shelves":[{"id":"shelf","height":280,"light":{"color":"#ffd69b","intensity":0.5,"garland":true,"type":"neon","enabled":true}}]}],"items":[{"id":"frame","kind":"decor","asset":"portrait","shelf_id":"shelf","x":8,"width":50,"height":80,"book_ids":[],"mode":"upright","color":"#72865b","scale":1,"rotation":0,"active":true,"artwork":3}]}'::jsonb;
  result := public.save_bookshelf_design('{}',0,scene);
  IF result->'design' IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Craft round trip failed'; END IF;
  FOR i IN 0..9 LOOP
    bad := CASE i
      WHEN 0 THEN jsonb_set(scene,'{bookcases,0,style}','"remote"')
      WHEN 1 THEN jsonb_set(scene,'{bookcases,0,lights_on}','null')
      WHEN 2 THEN jsonb_set(scene,'{bookcases,0,shelves,0,light,type}','"laser"')
      WHEN 3 THEN jsonb_set(scene,'{bookcases,0,shelves,0,light,enabled}','"true"')
      WHEN 4 THEN jsonb_set(scene,'{items,0,active}','1')
      WHEN 5 THEN jsonb_set(scene,'{items,0,artwork}','4')
      WHEN 6 THEN jsonb_set(scene,'{items,0,artwork}','0.5')
      WHEN 7 THEN jsonb_set(scene,'{items,0,artwork}','null')
      WHEN 8 THEN jsonb_set(scene,'{items,0,asset}','"lamp"')
      ELSE jsonb_set(scene,'{bookcases,0,shelves,0,light,type}','null') END;
    BEGIN PERFORM public.save_bookshelf_design('{}',1,bad); RAISE EXCEPTION 'Invalid craft accepted: %',i; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
    BEGIN UPDATE public.user_bookshelf SET design=bad WHERE user_id=auth.uid(); RAISE EXCEPTION 'Invalid direct craft write accepted: %',i; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  END LOOP;
  IF (SELECT revision FROM public.user_bookshelf) <> 1 THEN RAISE EXCEPTION 'Rejected craft advanced revision'; END IF;
  PERFORM public.save_bookshelf_order('{}',1);
  IF (SELECT design FROM public.user_bookshelf) IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Old order erased switches or artwork'; END IF;
  BEGIN PERFORM public.save_bookshelf_design('{}',1,scene); RAISE EXCEPTION 'Stale craft write accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  IF has_function_privilege('anon','public.validate_bookshelf_craft(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous craft access'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
