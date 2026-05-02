export async function createOnboardingSession(request: Request, env: any) {
    try {
      const body = (await request.json()) as Record<string, unknown>;
  
      // Basic request validation
      if (!body?.country_of_incorporation || !body?.locale) {
        return new Response(
          JSON.stringify({ error: "country_of_incorporation and locale are required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
  
      const session = {
        session_id: crypto.randomUUID(),
        type: body.type,
        country_of_incorporation: body.country_of_incorporation,
        entry_channel: body.entry_channel || "unknown",
        locale: body.locale,
        status: "IN_PROGRESS",
        current_step: "PHONE_VERIFICATION",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
  
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/onboarding_session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          Prefer: "return=representation",
          "Content-Profile": "rhino", // write into rhino schema
        },
        body: JSON.stringify(session),
      });
  
      if (!res.ok) {
        const supabaseError = await res.text();
        console.error("Supabase insert failed", {
          status: res.status,
          body: supabaseError,
        });
  
        return new Response(
          JSON.stringify({
            error: "DB error",
            detail: "Failed to create onboarding session",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
  
      // Return DB representation (if Supabase returns one), fallback to local session object
      const created = await res.json().catch(() => null);
      const payload = Array.isArray(created) ? created[0] : created ?? session;
  
      return new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("createOnboardingSession unexpected error", {
        message: err?.message,
      });
  
      return new Response(
        JSON.stringify({ error: "Invalid request or internal error" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }