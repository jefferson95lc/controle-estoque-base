// Edge function para o usuário master gerenciar usuários (criar, editar, excluir, resetar senha).
// Usa service role; valida que o caller é master via JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isMaster } = await admin.rpc("has_role", {
      _user_id: userData.user.id, _role: "master",
    });
    if (!isMaster) {
      return new Response(JSON.stringify({ error: "Apenas o usuário master pode executar esta ação" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password } = body;
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (error) throw error;
      return Response.json({ ok: true, user: data.user }, { headers: corsHeaders });
    }

    if (action === "update") {
      const { userId, email, password, active } = body;
      const updates: Record<string, unknown> = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (Object.keys(updates).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(userId, updates);
        if (error) throw error;
      }
      if (typeof active === "boolean") {
        const profileUpdate: Record<string, unknown> = { active };
        if (email) profileUpdate.email = email;
        const { error: pErr } = await admin.from("profiles").update(profileUpdate).eq("id", userId);
        if (pErr) throw pErr;
        // Se inativar, banir; se ativar, des-banir
        const { error: bErr } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: active ? "none" : "876000h",
        });
        if (bErr) throw bErr;
      } else if (email) {
        await admin.from("profiles").update({ email }).eq("id", userId);
      }
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === "delete") {
      const { userId } = body;
      if (userId === userData.user.id) {
        return new Response(JSON.stringify({ error: "Você não pode excluir a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
