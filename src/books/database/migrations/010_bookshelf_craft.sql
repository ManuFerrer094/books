-- Optional carpentry, fixture and object states. Legacy scenes keep their geometry and materials.
BEGIN;
CREATE FUNCTION public.validate_bookshelf_craft(scene jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c jsonb; s jsonb; i jsonb;
BEGIN
  FOR c IN SELECT value FROM jsonb_array_elements(scene->'bookcases') LOOP
    IF c ? 'style' AND (jsonb_typeof(c->'style') IS DISTINCT FROM 'string' OR c->>'style' NOT IN ('classic','arch','gilded','industrial','floating')) THEN
      RAISE EXCEPTION 'Invalid furniture style' USING ERRCODE='22023';
    END IF;
    IF c ? 'lights_on' AND jsonb_typeof(c->'lights_on') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Invalid furniture switch' USING ERRCODE='22023';
    END IF;
    FOR s IN SELECT value FROM jsonb_array_elements(c->'shelves') LOOP
      IF s->'light' ? 'type' AND (jsonb_typeof(s->'light'->'type') IS DISTINCT FROM 'string' OR s->'light'->>'type' NOT IN ('strip','spots','globes','fairy','neon','none')) THEN
        RAISE EXCEPTION 'Invalid shelf fixture' USING ERRCODE='22023';
      END IF;
      IF s->'light' ? 'enabled' AND jsonb_typeof(s->'light'->'enabled') IS DISTINCT FROM 'boolean' THEN
        RAISE EXCEPTION 'Invalid shelf switch' USING ERRCODE='22023';
      END IF;
    END LOOP;
  END LOOP;
  FOR i IN SELECT value FROM jsonb_array_elements(scene->'items') LOOP
    IF i ? 'active' AND (i->>'kind' <> 'decor' OR jsonb_typeof(i->'active') IS DISTINCT FROM 'boolean') THEN
      RAISE EXCEPTION 'Invalid decoration state' USING ERRCODE='22023';
    END IF;
    IF i ? 'artwork' THEN
      IF i->>'kind' <> 'decor' OR i->>'asset' NOT IN ('portrait','landscape') OR jsonb_typeof(i->'artwork') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'Invalid frame artwork' USING ERRCODE='22023';
      END IF;
      IF (i->>'artwork')::numeric NOT IN (0,1,2,3) THEN
        RAISE EXCEPTION 'Frame artwork out of range' USING ERRCODE='22023';
      END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_bookshelf_craft(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.validate_bookshelf_craft(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.check_bookshelf_scene() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE library_ids integer[];
BEGIN
  IF NEW.design IS NOT NULL THEN
    SELECT coalesce(array_agg(book_id),'{}') INTO library_ids FROM public.user_books WHERE user_id = NEW.user_id;
    PERFORM public.validate_bookshelf_design(NEW.design,library_ids);
    IF NEW.design ? 'atmosphere' THEN PERFORM public.validate_bookshelf_atmosphere(NEW.design->'atmosphere'); END IF;
    PERFORM public.validate_bookshelf_craft(NEW.design);
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
