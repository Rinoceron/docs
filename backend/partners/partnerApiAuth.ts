/**
 * Partner API keys: mint (shared secret), list/revoke (API key), and validation for /public routes.
 *
 * Env (production: `wrangler secret put …`; local dev: `backend/api/.dev.vars`, never commit):
 *
 * ```
 * SUPABASE_URL=https://<project>.supabase.co
 * SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>
 * PARTNER_MINT_SECRET=<long_random_string>
 * # Optional — mixes into SHA-256(secretHex); rotate with key rollovers if compromised
 * API_KEY_PEPPER=
 * ```
 *
 * Key format returned once from mint: `rhino_<environment>_<8 hex id>_<64 hex secret>` (example env `live`).
 */

import type { EndpointHandler } from "../api/src/routes/_shared";

// --- env -----------------------------------------------------------------

export type PartnerAuthEnv = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Required to mint keys via POST /public/partner/api-keys */
  PARTNER_MINT_SECRET?: string;
  /** Optional pepper mixed into SHA-256(secret); set via Wrangler secret in production */
  API_KEY_PEPPER?: string;
};

export type PartnerContext = {
  party_id: string;
  api_key_id: string;
  api_client_id: string;
  scopes: string[];
};

const KEY_MATERIAL_REGEX = /^rhino_[a-z]+_[a-f0-9]{8}_[a-f0-9]{64}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- route → required OAuth-style scope string ----------------------------

function requiredScopeForPublicRoute(method: string, pathname: string): string {
  if (pathname === "/public/partner/api-keys" && method === "GET") {
    return "keys:manage";
  }
  if (pathname.startsWith("/public/partner/api-keys/") && method === "DELETE") {
    return "keys:manage";
  }
  return "partner:api";
}

function scopeAllows(scopes: unknown, required: string): boolean {
  if (!Array.isArray(scopes)) return false;
  const s = scopes as string[];
  if (s.includes("*") || s.includes("partner:*") || s.includes("keys:*")) return true;
  if (required === "keys:manage" && s.includes("keys:manage")) return true;
  if (required === "partner:api" && s.includes("partner:api")) return true;
  return s.includes(required);
}

// --- crypto ---------------------------------------------------------------

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) return false;
  const a = hexToBytes(aHex);
  const b = hexToBytes(bHex);
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i]! ^ b[i]!;
  return out === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return bytesToHex(digest);
}

function randomHex(bytes: number): string {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  return bytesToHex(u.buffer);
}

/** Parsed api key: full format rhino_<env>_<8 hex prefix id>_<64 hex secret> */
export function parsePartnerApiKey(raw: string): { keyPrefix: string; secretHex: string } | null {
  const t = raw.trim();
  if (!KEY_MATERIAL_REGEX.test(t)) return null;
  const lastUnderscore = t.lastIndexOf("_");
  if (lastUnderscore <= 0) return null;
  const secretHex = t.slice(lastUnderscore + 1);
  const keyPrefix = t.slice(0, lastUnderscore);
  if (secretHex.length !== 64) return null;
  return { keyPrefix, secretHex };
}

export function extractRawApiKeyFromRequest(request: Request): string | null {
  const x = request.headers.get("X-Api-Key");
  if (x && x.trim()) return x.trim();

  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token.startsWith("rhino_")) return null;
  return token;
}

function extractPartyIdFromPath(pathname: string): string | null {
  const m = pathname.match(/\/public\/parties\/([^/]+)/i);
  if (!m?.[1]) return null;
  const id = m[1];
  if (!UUID_RE.test(id)) return null;
  return id;
}

// --- Supabase REST --------------------------------------------------------

function supabaseHeaders(env: PartnerAuthEnv): HeadersInit | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Profile": "rhino",
    "Content-Type": "application/json",
  };
}

async function supabaseGet<T>(
  env: PartnerAuthEnv,
  pathAndQuery: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  const h = supabaseHeaders(env);
  if (!h) return { ok: false, status: 500, text: "missing_supabase" };
  const res = await fetch(`${env.SUPABASE_URL}${pathAndQuery}`, { headers: h });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text };
  }
  const data = (await res.json()) as T;
  return { ok: true, data };
}

async function supabasePost<T>(
  env: PartnerAuthEnv,
  table: string,
  body: Record<string, unknown>,
  preferRepresentation = true,
): Promise<{ ok: true; row: T } | { ok: false; status: number; text: string }> {
  const h = supabaseHeaders(env);
  if (!h) return { ok: false, status: 500, text: "missing_supabase" };
  const headers: HeadersInit = {
    ...h,
    ...(preferRepresentation ? { Prefer: "return=representation" } : {}),
  };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text };
  }
  const data = (await res.json()) as T | T[];
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, row: row as T };
}

async function supabasePatch(
  env: PartnerAuthEnv,
  pathAndQuery: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; status: number; text: string }> {
  const h = supabaseHeaders(env);
  if (!h) return { ok: false, status: 500, text: "missing_supabase" };
  const res = await fetch(`${env.SUPABASE_URL}${pathAndQuery}`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, text };
  }
  return { ok: true };
}

type ApiClientRow = {
  api_client_id: string;
  party_id: string;
  client_name: string;
  environment: string;
  status: string;
  token_version: number;
  jwt_min_iat: string | null;
  created_at: string;
  updated_at: string;
};

type ApiKeyRow = {
  api_key_id: string;
  api_client_id: string;
  key_prefix: string;
  key_hash: string;
  key_version: number;
  scopes: unknown;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
  metadata: unknown;
};

// --- core validation ------------------------------------------------------

export async function validatePartnerApiKey(
  env: PartnerAuthEnv,
  rawKey: string,
): Promise<{ ok: true; ctx: PartnerContext } | { ok: false; reason: string }> {
  const parsed = parsePartnerApiKey(rawKey);
  if (!parsed) return { ok: false, reason: "invalid_key_format" };

  const pepper = env.API_KEY_PEPPER ?? "";
  const computedHash = await sha256Hex(pepper + parsed.secretHex);

  const sel = `/rest/v1/api_key?key_prefix=eq.${encodeURIComponent(parsed.keyPrefix)}&select=*`;
  const got = await supabaseGet<ApiKeyRow[]>(env, sel);
  if (!got.ok) return { ok: false, reason: "db_error" };

  const rows = Array.isArray(got.data) ? got.data : [];
  const row = rows[0];
  if (!row) return { ok: false, reason: "unknown_key" };

  if (!timingSafeEqualHex(computedHash.toLowerCase(), String(row.key_hash).toLowerCase())) {
    return { ok: false, reason: "bad_secret" };
  }

  if (row.status !== "active") return { ok: false, reason: "inactive" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };
  if (row.expires_at) {
    const exp = new Date(row.expires_at).getTime();
    if (Date.now() > exp) return { ok: false, reason: "expired" };
  }

  const cl = await supabaseGet<ApiClientRow[]>(
    env,
    `/rest/v1/api_client?api_client_id=eq.${encodeURIComponent(row.api_client_id)}&select=*`,
  );
  if (!cl.ok || !Array.isArray(cl.data) || !cl.data[0]) {
    return { ok: false, reason: "client_missing" };
  }
  const client = cl.data[0];
  if (client.status !== "active") return { ok: false, reason: "client_inactive" };

  const scopes =
    Array.isArray(row.scopes) ? (row.scopes as string[])
    : typeof row.scopes === "object" && row.scopes !== null && "scopes" in (row.scopes as object) ?
      ((row.scopes as { scopes?: string[] }).scopes ?? [])
    : [];

  return {
    ok: true,
    ctx: {
      party_id: client.party_id,
      api_key_id: row.api_key_id,
      api_client_id: row.api_client_id,
      scopes,
    },
  };
}

function scheduleKeyTouch(env: PartnerAuthEnv, apiKeyId: string, ctx?: ExecutionContext): void {
  const run = async () => {
    await supabasePatch(env, `/rest/v1/api_key?api_key_id=eq.${encodeURIComponent(apiKeyId)}`, {
      last_used_at: new Date().toISOString(),
    });
  };
  if (ctx?.waitUntil) {
    ctx.waitUntil(run());
  } else {
    void run();
  }
}

function scheduleRequestLog(
  env: PartnerAuthEnv,
  row: {
    api_client_id: string | null;
    api_key_id: string | null;
    party_id: string | null;
    request_id: string | null;
    method: string;
    path: string;
    status_code: number;
    ip_address: string | null;
    user_agent: string | null;
    request_started_at: string;
    request_completed_at: string | null;
    error_code: string | null;
    metadata: unknown;
  },
  ctx?: ExecutionContext,
): void {
  const run = async () => {
    const ins = await supabasePost(env, "api_request_log", {
      request_log_id: crypto.randomUUID(),
      ...row,
    });
    if (!ins.ok) console.error("api_request_log insert failed", ins);
  };
  if (ctx?.waitUntil) ctx.waitUntil(run());
  else void run();
}

/**
 * Returns Response on failure, or PartnerContext on success.
 * Optionally records request log + last_used on context (caller passes status after handler — see wrap helper).
 */
export async function authorizePartnerPublicRequest(
  request: Request,
  env: PartnerAuthEnv,
  method: string,
  pathname: string,
  ctx?: ExecutionContext,
): Promise<Response | PartnerContext> {
  const raw = extractRawApiKeyFromRequest(request);
  if (!raw) {
    return jsonErr(401, { error: "missing_api_key", detail: "Provide X-Api-Key or Authorization: Bearer rhino_..." });
  }

  const v = await validatePartnerApiKey(env, raw);
  if (!v.ok) {
    return jsonErr(401, { error: "invalid_api_key", reason: v.reason });
  }

  const need = requiredScopeForPublicRoute(method, pathname);
  if (!scopeAllows(v.ctx.scopes, need)) {
    return jsonErr(403, { error: "insufficient_scope", required: need });
  }

  const pathParty = extractPartyIdFromPath(pathname);
  if (pathParty && pathParty !== v.ctx.party_id) {
    return jsonErr(403, { error: "party_mismatch", detail: "Key cannot access this party" });
  }

  scheduleKeyTouch(env, v.ctx.api_key_id, ctx);

  return v.ctx;
}

function jsonErr(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonOk(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Mint (POST /public/partner/api-keys) ---------------------------------

export const mintPartnerApiKey: EndpointHandler = async (request, env) => {
  const e = env as PartnerAuthEnv;
  const mintSecret = request.headers.get("X-Partner-Mint-Key");
  if (!e.PARTNER_MINT_SECRET || mintSecret !== e.PARTNER_MINT_SECRET) {
    return jsonErr(401, { error: "unauthorized_mint" });
  }
  if (!e.SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonErr(500, { error: "server_misconfiguration" });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(400, { error: "json_required" });
  }

  const partyId = typeof body.party_id === "string" ? body.party_id.trim() : "";
  if (!partyId || !UUID_RE.test(partyId)) {
    return jsonErr(400, { error: "party_id_required", detail: "Must be a valid UUID" });
  }

  const environment = typeof body.environment === "string" && body.environment.trim() ?
    body.environment.trim()
  : "live";
  const clientName =
    typeof body.client_name === "string" && body.client_name.trim() ?
      body.client_name.trim()
    : `partner_${environment}`;

  const defaultScopes = ["partner:api", "keys:manage"];
  let scopes: string[] = defaultScopes;
  if (Array.isArray(body.scopes)) {
    scopes = body.scopes.filter((x): x is string => typeof x === "string");
  }

  const existing = await supabaseGet<ApiClientRow[]>(
    e,
    `/rest/v1/api_client?party_id=eq.${encodeURIComponent(partyId)}&environment=eq.${encodeURIComponent(environment)}&select=*`,
  );
  if (!existing.ok) return jsonErr(502, { error: "db_error", detail: existing.text.slice(0, 200) });

  let apiClientId: string;
  if (Array.isArray(existing.data) && existing.data[0]) {
    apiClientId = existing.data[0].api_client_id;
  } else {
    const now = new Date().toISOString();
    const ins = await supabasePost<ApiClientRow>(e, "api_client", {
      api_client_id: crypto.randomUUID(),
      party_id: partyId,
      client_name: clientName,
      environment,
      status: "active",
      token_version: 1,
      jwt_min_iat: null,
      created_at: now,
      updated_at: now,
    });
    if (!ins.ok) return jsonErr(502, { error: "api_client_create_failed", detail: ins.text.slice(0, 200) });
    apiClientId = ins.row.api_client_id;
  }

  const shortId = randomHex(4);
  const keyPrefix = `rhino_${environment}_${shortId}`;
  const secretHex = randomHex(32);
  const plaintext = `${keyPrefix}_${secretHex}`;
  const pepper = e.API_KEY_PEPPER ?? "";
  const keyHash = await sha256Hex(pepper + secretHex);

  const now = new Date().toISOString();
  const insKey = await supabasePost<ApiKeyRow>(e, "api_key", {
    api_key_id: crypto.randomUUID(),
    api_client_id: apiClientId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    key_version: 1,
    scopes,
    status: "active",
    last_used_at: null,
    expires_at: null,
    created_at: now,
    revoked_at: null,
    metadata: {},
  });
  if (!insKey.ok) {
    return jsonErr(502, { error: "api_key_create_failed", detail: insKey.text.slice(0, 200) });
  }

  const row = insKey.row;
  return jsonOk(201, {
    api_key: plaintext,
    api_key_id: row.api_key_id,
    api_client_id: apiClientId,
    key_prefix: keyPrefix,
    scopes,
    environment,
    party_id: partyId,
    warning: "Store this key securely; it cannot be shown again.",
  });
};

// --- List keys (GET /public/partner/api-keys) ------------------------------

export const listPartnerApiKeys: EndpointHandler = async (request, env) => {
  const e = env as PartnerAuthEnv;
  const apiClientId = request.headers.get(HEADER_API_CLIENT_ID);
  const partyId = request.headers.get(HEADER_PARTNER_ID);
  if (!apiClientId || !partyId) {
    return jsonErr(401, { error: "missing_partner_context" });
  }

  const q =
    `/rest/v1/api_key?api_client_id=eq.${encodeURIComponent(apiClientId)}` +
    `&select=api_key_id,key_prefix,key_version,scopes,status,last_used_at,expires_at,created_at,revoked_at` +
    `&order=created_at.desc`;
  const got = await supabaseGet<ApiKeyRow[]>(e, q);
  if (!got.ok) return jsonErr(502, { error: "db_error", detail: got.text.slice(0, 200) });

  const list = Array.isArray(got.data) ? got.data : [];
  const masked = list.map((r) => ({
    api_key_id: r.api_key_id,
    key_prefix: r.key_prefix,
    key_version: r.key_version,
    scopes: r.scopes,
    status: r.status,
    last_used_at: r.last_used_at,
    expires_at: r.expires_at,
    created_at: r.created_at,
    revoked_at: r.revoked_at,
  }));

  return jsonOk(200, { keys: masked, party_id: partyId });
};

// --- Revoke (DELETE /public/partner/api-keys/{apiKeyId}) -------------------

/** Align with Worker route matching when clients use /public/v1/... */
export function canonicalizePublicPath(pathname: string): string {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (normalized.startsWith("/public/v1/")) {
    return `/public/${normalized.slice("/public/v1/".length)}`;
  }
  if (normalized === "/public/v1") {
    return "/public";
  }
  return normalized;
}

export function extractApiKeyIdFromPartnerPath(pathname: string): string | null {
  const base = "/public/partner/api-keys/";
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length);
  if (!rest || rest.includes("/")) return null;
  if (!UUID_RE.test(rest)) return null;
  return rest;
}

export const revokePartnerApiKey: EndpointHandler = async (request, env) => {
  const e = env as PartnerAuthEnv;
  const url = new URL(request.url);
  const pathname = canonicalizePublicPath(url.pathname);
  const apiKeyId = extractApiKeyIdFromPartnerPath(pathname);
  if (!apiKeyId) return jsonErr(400, { error: "invalid_path" });

  const apiClientId = request.headers.get(HEADER_API_CLIENT_ID);
  if (!apiClientId) {
    return jsonErr(401, { error: "missing_partner_context" });
  }

  const rowCheck = await supabaseGet<ApiKeyRow[]>(
    e,
    `/rest/v1/api_key?api_key_id=eq.${encodeURIComponent(apiKeyId)}&select=api_client_id`,
  );
  if (!rowCheck.ok || !Array.isArray(rowCheck.data) || !rowCheck.data[0]) {
    return jsonErr(404, { error: "api_key_not_found" });
  }
  if (rowCheck.data[0].api_client_id !== apiClientId) {
    return jsonErr(403, { error: "forbidden" });
  }

  const now = new Date().toISOString();
  const patch = await supabasePatch(
    e,
    `/rest/v1/api_key?api_key_id=eq.${encodeURIComponent(apiKeyId)}`,
    { status: "revoked", revoked_at: now },
  );
  if (!patch.ok) return jsonErr(502, { error: "revoke_failed", detail: patch.text.slice(0, 200) });

  return jsonOk(200, { ok: true, api_key_id: apiKeyId, revoked_at: now });
};

/**
 * After public handler runs: optional api_request_log line (best-effort).
 */
export function logPublicPartnerRequest(
  env: PartnerAuthEnv,
  ctx: PartnerContext | null,
  meta: {
    request: Request;
    method: string;
    pathname: string;
    status: number;
    startedAt: number;
    error_code?: string | null;
  },
  exec?: ExecutionContext,
): void {
  if (!ctx) return;
  const rawIp =
    meta.request.headers.get("CF-Connecting-IP") ||
    meta.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "";
  const ip = /^[\d.a-fA-F:]+$/.test(rawIp) ? rawIp : null;
  scheduleRequestLog(
    env,
    {
      api_client_id: ctx.api_client_id,
      api_key_id: ctx.api_key_id,
      party_id: ctx.party_id,
      request_id: meta.request.headers.get("X-Request-Id"),
      method: meta.method,
      path: meta.pathname,
      status_code: meta.status,
      ip_address: ip,
      user_agent: meta.request.headers.get("User-Agent"),
      request_started_at: new Date(meta.startedAt).toISOString(),
      request_completed_at: new Date().toISOString(),
      error_code: meta.error_code ?? null,
      metadata: {},
    },
    exec,
  );
}

export const HEADER_PARTNER_ID = "X-Rhino-Partner-Id";
export const HEADER_API_CLIENT_ID = "X-Rhino-Api-Client-Id";
export const HEADER_API_KEY_ID = "X-Rhino-Api-Key-Id";

/** Set after authorizePartnerPublicRequest so list/revoke avoid a second full key lookup. */
export function injectPartnerContext(request: Request, c: PartnerContext): Request {
  const h = new Headers(request.headers);
  h.set(HEADER_PARTNER_ID, c.party_id);
  h.set(HEADER_API_CLIENT_ID, c.api_client_id);
  h.set(HEADER_API_KEY_ID, c.api_key_id);
  return new Request(request, { headers: h });
}
