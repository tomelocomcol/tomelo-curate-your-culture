import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Redirect /perfil to /u/<my-username>
export const Route = createFileRoute("/_authenticated/perfil")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", context.user.id)
      .maybeSingle();
    if (!data?.username) throw redirect({ to: "/ajustes" });
    throw redirect({ to: "/u/$username", params: { username: data.username } });
  },
  component: () => null,
});
