-- Fix security warnings: Set search_path for all functions to prevent search path hijacking

-- Update compute_checksum function with secure search_path
CREATE OR REPLACE FUNCTION public.compute_checksum(p_title TEXT, p_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(
    digest(
      jsonb_build_object(
        'title', TRIM(p_title), 
        'content', TRIM(p_content)
      )::text, 
      'sha256'
    ), 
    'hex'
  );
END;
$$;

-- Update handle_updated_at function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update handle_prompt_checksum function with secure search_path
CREATE OR REPLACE FUNCTION public.handle_prompt_checksum()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.checksum = public.compute_checksum(NEW.title, NEW.content);
  RETURN NEW;
END;
$$;