-- Fix compute_checksum to use fully qualified extensions.digest()
CREATE OR REPLACE FUNCTION public.compute_checksum(p_title text, p_content text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN encode(
    extensions.digest(
      jsonb_build_object(
        'title', TRIM(p_title), 
        'content', TRIM(p_content)
      )::text, 
      'sha256'
    ), 
    'hex'
  );
END;
$function$;