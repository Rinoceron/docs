type Env = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractSessionId(pathname: string): string | null {
  const m = pathname.match(/^\/public\/onboarding-sessions\/([^/]+)\/webhook$/);
  return m?.[1] ?? null;
}

/**
 * Persists partner_ready_webhook_url / partner_ready_webhook_secret on onboarding_session (Supabase).
 * Columns must exist on the table; otherwise the PATCH returns an error surfaced to the client.
 */
export async function registerOnboardingSessionWebhook(request: Request, env: unknown): Promise<Response> {
  const e = env as Env;
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Server misconfiguration" }, 500);
  }

  const sessionId = extractSessionId(new URL(request.url).pathname);
  if (!sessionId) {
    return json({ error: "Invalid path" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON body required" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Body must be an object" }, 400);
  }

  const rec = body as Record<string, unknown>;
  const webhookUrl = typeof rec.webhook_url === "string" ? rec.webhook_url.trim() : "";
  const webhookSecret =
    typeof rec.webhook_secret === "string" && rec.webhook_secret.length > 0
      ? rec.webhook_secret
      : null;

  if (!webhookUrl) {
    return json({ error: "webhook_url is required" }, 400);
  }

  try {
    const u = new URL(webhookUrl);
    if (u.protocol !== "https:") {
      return json({ error: "webhook_url must use https" }, 400);
    }
  } catch {
    return json({ error: "webhook_url is not a valid URL" }, 400);
  }

  const patch = {
    partner_ready_webhook_url: webhookUrl,
    partner_ready_webhook_secret: webhookSecret,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(
    `${e.SUPABASE_URL}/rest/v1/onboarding_session?session_id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: e.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal",
        "Content-Profile": "rhino",
      },
      body: JSON.stringify(patch),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("registerOnboardingSessionWebhook supabase error", res.status, detail);
    return json(
      {
        error: "Failed to persist webhook",
        detail: detail.slice(0, 500),
      },
      502,
    );
  }

  return json({ ok: true, session_id: sessionId }, 200);
}
