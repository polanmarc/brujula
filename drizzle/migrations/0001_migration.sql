CREATE OR REPLACE FUNCTION public.is_app_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT auth.uid() IS NOT NULL AND auth.uid() = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1);
$$;
REVOKE ALL ON FUNCTION public.is_app_owner() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_app_owner() TO authenticated;