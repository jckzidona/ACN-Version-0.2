import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSession } from "@/lib/session.functions";
import { supabase } from "@/integrations/supabase/client";
import type { SessionSnapshot } from "@/lib/authz";

export function useSession() {
  const fetchSession = useServerFn(getSession);
  return useQuery<SessionSnapshot | null>({
    queryKey: ["session"],
    queryFn: async () => {
      // Without a signed-in browser session there is no bearer token to attach,
      // and the protected server function would throw "Unauthorized".
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return null;
      try {
        return await fetchSession();
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}
