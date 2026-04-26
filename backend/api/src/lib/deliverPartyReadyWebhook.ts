export type PartyReadyEventPayload = {
  event: "party.ready";
  session_id: string;
  party: Record<string, unknown>;
};

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * POSTs a party.ready payload to a partner-configured HTTPS URL.
 * Optional HMAC-SHA256 of the raw body when webhook_secret is set.
 */
export async function deliverPartyReadyWebhook(params: {
  webhookUrl: string;
  webhookSecret?: string | null;
  sessionId: string;
  party: Record<string, unknown>;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { webhookUrl, webhookSecret, sessionId, party } = params;
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    return { ok: false, error: "invalid_webhook_url" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "webhook_url_must_be_https" };
  }

  const body: PartyReadyEventPayload = {
    event: "party.ready",
    session_id: sessionId,
    party,
  };
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Rhino-Event": "party.ready",
  };

  if (webhookSecret && webhookSecret.trim()) {
    const hex = await hmacSha256Hex(webhookSecret.trim(), raw);
    headers["X-Rhino-Signature"] = `sha256=${hex}`;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: raw,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 500) || "webhook_target_error" };
    }
    return { ok: true, status: res.status };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: message };
  }
}
