BEGIN;
INSERT INTO auth.users(id) VALUES ('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE scene jsonb; atmo jsonb; layers jsonb; result jsonb; bad jsonb; i integer;
BEGIN
  SELECT jsonb_object_agg(id,0) INTO layers FROM unnest(ARRAY['rain','fire','wind','birds','pages','steps','clock','cafe','water','ocean','thunder','night','vinyl','dream']) t(id);
  atmo := jsonb_build_object('version',1,'scene','rain-room','lighting',jsonb_build_object('enabled',true,'color','#ffe0b5','ambient',0.7,'beam',0.18,'angle',-24,'glow',0.62,'vignette',0.2,'dust',true,'motion',true,'backdrop','rain'),
    'sound',jsonb_build_object('master',0.5,'width',0.7,'layers',layers || '{"rain":0.6,"pages":0.16}'::jsonb));
  scene := jsonb_build_object('version',1,'background','wall','background_color','#eee7dc','night',false,
    'bookcases',jsonb_build_array(jsonb_build_object('id','case','name','Room','material','oak','width',960,
      'shelves',jsonb_build_array(jsonb_build_object('id','shelf','height',280,'light',jsonb_build_object('color','#ffd69b','intensity',0.5,'garland',true))))),
    'items','[]'::jsonb,'atmosphere',atmo);
  result := public.save_bookshelf_design('{}',0,scene);
  IF result->>'revision' <> '1' OR result->'design' IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Atmosphere round trip failed'; END IF;
  FOR i IN 0..8 LOOP
    bad := CASE i
      WHEN 0 THEN jsonb_set(scene,'{atmosphere,sound,master}','1.01')
      WHEN 1 THEN jsonb_set(scene,'{atmosphere,sound,layers,rain}','-0.01')
      WHEN 2 THEN jsonb_set(scene,'{atmosphere,lighting,angle}','61')
      WHEN 3 THEN jsonb_set(scene,'{atmosphere,lighting,color}','"url(bad)"')
      WHEN 4 THEN jsonb_set(scene,'{atmosphere,lighting,dust}','"true"')
      WHEN 5 THEN jsonb_set(scene,'{atmosphere,sound,layers}',layers - 'pages')
      WHEN 6 THEN jsonb_set(scene,'{atmosphere,sound,layers}',layers || '{"remote_url":0}'::jsonb)
      WHEN 7 THEN jsonb_set(scene,'{atmosphere}','null')
      ELSE jsonb_set(scene,'{atmosphere,lighting,backdrop}','"remote"') END;
    BEGIN PERFORM public.save_bookshelf_design('{}',1,bad); RAISE EXCEPTION 'Invalid atmosphere accepted: %',i; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
    BEGIN UPDATE public.user_bookshelf SET design=bad WHERE user_id=auth.uid(); RAISE EXCEPTION 'Invalid direct write accepted: %',i; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  END LOOP;
  IF (SELECT revision FROM public.user_bookshelf) <> 1 OR (SELECT design FROM public.user_bookshelf) IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Failed validation lost scene or revision'; END IF;
  PERFORM public.save_bookshelf_order('{}',1);
  IF (SELECT design FROM public.user_bookshelf) IS DISTINCT FROM scene THEN RAISE EXCEPTION 'Legacy order erased atmosphere'; END IF;
  BEGIN PERFORM public.save_bookshelf_design('{}',1,scene); RAISE EXCEPTION 'Stale atmosphere write accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  IF has_function_privilege('anon','public.validate_bookshelf_atmosphere(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous atmosphere access'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.user_bookshelf) THEN RAISE EXCEPTION 'Another user read atmosphere'; END IF;
  UPDATE public.user_bookshelf SET design=NULL WHERE user_id='33333333-3333-4333-8333-333333333333';
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT design FROM public.user_bookshelf WHERE user_id='33333333-3333-4333-8333-333333333333') IS NULL THEN RAISE EXCEPTION 'Another user erased atmosphere'; END IF;
END $$;
ROLLBACK;
