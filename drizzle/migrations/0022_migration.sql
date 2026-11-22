CREATE TABLE public.platform_owners (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
GRANT ALL ON public.platform_owners TO service_role;
ALTER TABLE public.platform_owners ENABLE ROW LEVEL SECURITY;
INSERT INTO public.platform_owners(user_id) VALUES ('99c72940-ee4c-4e03-b90a-e29a13f34ab9');

CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT EXISTS (SELECT 1 FROM public.platform_owners WHERE user_id = _user_id) $$;
REVOKE EXECUTE ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_owner(uuid) TO authenticated, service_role;

CREATE TABLE public.demo_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  agency text NOT NULL CHECK (char_length(agency) BETWEEN 1 AND 160),
  role_title text CHECK (char_length(role_title) <= 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text CHECK (char_length(phone) <= 40),
  team_size text CHECK (char_length(team_size) <= 40),
  message text CHECK (char_length(message) <= 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.demo_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a demo request" ON public.demo_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'new');
CREATE POLICY "Platform owner reads demo requests" ON public.demo_requests FOR SELECT TO authenticated USING (public.is_platform_owner(auth.uid()));
CREATE POLICY "Platform owner updates demo requests" ON public.demo_requests FOR UPDATE TO authenticated USING (public.is_platform_owner(auth.uid())) WITH CHECK (public.is_platform_owner(auth.uid()));