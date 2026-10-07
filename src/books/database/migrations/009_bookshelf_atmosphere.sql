-- Optional versioned lighting and sound settings travel with the existing scene.
-- Playback and reading timers deliberately remain on the device, outside storage.
BEGIN;
CREATE FUNCTION public.validate_bookshelf_atmosphere(settings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE lighting jsonb; sound jsonb; layers jsonb; k text; n jsonb;
  layer_ids text[] := ARRAY['rain','fire','wind','birds','pages','steps','clock','cafe','water','ocean','thunder','night','vinyl','dream'];
BEGIN
  IF jsonb_typeof(settings) IS DISTINCT FROM 'object' OR settings->'version' IS DISTINCT FROM '1'::jsonb
    OR coalesce(settings->>'scene','') NOT IN ('custom','rain-room','fireside','midnight','garden','cafe','silence','enchanted','coast','storm','timeless') THEN
    RAISE EXCEPTION 'Invalid bookshelf atmosphere' USING ERRCODE='22023';
  END IF;
  lighting := settings->'lighting'; sound := settings->'sound'; layers := sound->'layers';
  IF jsonb_typeof(lighting) IS DISTINCT FROM 'object' OR jsonb_typeof(sound) IS DISTINCT FROM 'object'
    OR jsonb_typeof(layers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid atmosphere settings' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['enabled','dust','motion'] LOOP
    IF jsonb_typeof(lighting->k) IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Invalid lighting toggle' USING ERRCODE='22023';
    END IF;
  END LOOP;
  IF jsonb_typeof(lighting->'color') IS DISTINCT FROM 'string' OR coalesce(lighting->>'color','') !~ '^#[0-9a-fA-F]{6}$'
    OR coalesce(lighting->>'backdrop','') NOT IN ('none','rain','snow','leaves','stars')
    OR jsonb_typeof(lighting->'angle') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Invalid light color or direction' USING ERRCODE='22023';
  END IF;
  IF (lighting->>'angle')::numeric NOT BETWEEN -60 AND 60 THEN
    RAISE EXCEPTION 'Light direction out of range' USING ERRCODE='22023';
  END IF;
  FOR n IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    lighting->'ambient',lighting->'beam',lighting->'glow',lighting->'vignette',sound->'master',sound->'width')) LOOP
    IF jsonb_typeof(n) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid atmosphere level' USING ERRCODE='22023'; END IF;
    IF n::text::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Atmosphere level out of range' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(layers)) <> array_length(layer_ids,1) THEN
    RAISE EXCEPTION 'Invalid sound layers' USING ERRCODE='22023';
  END IF;
  FOREACH k IN ARRAY layer_ids LOOP
    IF jsonb_typeof(layers->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Invalid sound layer' USING ERRCODE='22023'; END IF;
    IF (layers->>k)::numeric NOT BETWEEN 0 AND 1 THEN RAISE EXCEPTION 'Sound level out of range' USING ERRCODE='22023'; END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_bookshelf_atmosphere(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.validate_bookshelf_atmosphere(jsonb) TO authenticated;

-- Validate at the common scene boundary, protecting both RPC and direct writes.
-- Existing geometry validation, revision locking and owner policies remain active.
CREATE OR REPLACE FUNCTION public.check_bookshelf_scene() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE library_ids integer[];
BEGIN
  IF NEW.design IS NOT NULL THEN
    SELECT coalesce(array_agg(book_id),'{}') INTO library_ids FROM public.user_books WHERE user_id = NEW.user_id;
    PERFORM public.validate_bookshelf_design(NEW.design,library_ids);
    IF NEW.design ? 'atmosphere' THEN
      PERFORM public.validate_bookshelf_atmosphere(NEW.design->'atmosphere');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
