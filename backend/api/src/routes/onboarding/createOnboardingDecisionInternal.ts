import { deliverPartyReadyWebhook } from "../../lib/deliverPartyReadyWebhook";

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
  const m = pathname.match(/^\/internal\/onboarding-sessions\/([^/]+)\/decision$/);
  return m?.[1] ?? null;
}

async function supabaseHeaders(env: Env): Promise<HeadersInit | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Profile": "rhino",
  };
}

/**
 * Records an internal onboarding decision. When decision is APPROVED and party_id is supplied,
 * dispatches the configured partner webhook (party.ready) if partner_ready_webhook_url is set on the session.
 */
export async function createOnboardingDecisionInternal(request: Request, env: unknown): Promise<Response> {
  const e = env as Env;
  const headersBase = await supabaseHeaders(e);
  if (!headersBase) {
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
  const decision = typeof rec.decision === "string" ? rec.decision.trim().toUpperCase() : "";
  const partyId = typeof rec.party_id === "string" ? rec.party_id.trim() : "";

  if (decision === "APPROVED") {
    if (!partyId) {
      return json({ error: "party_id is required when decision is APPROVED" }, 400);
    }

    if (!e.SUPABASE_URL) {
      return json({ error: "Server misconfiguration" }, 500);
    }

    const sessionRes = await fetch(
      `${e.SUPABASE_URL}/rest/v1/onboarding_session?session_id=eq.${encodeURIComponent(sessionId)}&select=partner_ready_webhook_url,partner_ready_webhook_secret`,
      { headers: { ...headersBase } },
    );
    if (!sessionRes.ok) {
      const t = await sessionRes.text().catch(() => "");
      return json({ error: "Failed to load session", detail: t.slice(0, 300) }, 502);
    }
    const sessions = (await sessionRes.json().catch(() => [])) as Record<string, unknown>[];
    const session = Array.isArray(sessions) ? sessions[0] : null;
    const webhookUrl =
      session && typeof session.partner_ready_webhook_url === "string"
        ? session.partner_ready_webhook_url.trim()
        : "";
    const webhookSecret =
      session && typeof session.partner_ready_webhook_secret === "string"
        ? session.partner_ready_webhook_secret
        : null;

    const partyRes = await fetch(
      `${e.SUPABASE_URL}/rest/v1/party?party_id=eq.${encodeURIComponent(partyId)}`,
      { headers: { ...headersBase } },
    );
    if (!partyRes.ok) {
      const t = await partyRes.text().catch(() => "");
      return json({ error: "Failed to load party", detail: t.slice(0, 300) }, 502);
    }
    const parties = (await partyRes.json().catch(() => [])) as Record<string, unknown>[];
    const party = Array.isArray(parties) ? parties[0] : null;
    if (!party) {
      return json({ error: "Party not found" }, 404);
    }

    if (!webhookUrl) {
      return json({ ok: true, decision: "APPROVED", webhook_dispatched: false, reason: "no_webhook_url" }, 200);
    }

    const result = await deliverPartyReadyWebhook({
      webhookUrl,
      webhookSecret,
      sessionId,
      party,
    });

    if (!result.ok) {
      console.error("party.ready webhook failed", result);
      return json(
        {
          ok: false,
          decision: "APPROVED",
          webhook_dispatched: false,
          webhook_error: result.error ?? "unknown",
          webhook_status: result.status,
        },
        502,
      );
    }

    return json({ ok: true, decision: "APPROVED", webhook_dispatched: true }, 200);
  }

  return json(
    {
      error: "Not implemented",
      operation_id: "createOnboardingDecisionInternal",
      hint: "Only decision=APPROVED with party_id is supported for now",
    },
    501,
  );
}
