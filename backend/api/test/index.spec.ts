import { describe, it, expect } from "vitest";
import worker from "../src/index";

describe("rhino-api worker", () => {
  it("GET /health returns JSON without API key", async () => {
    const response = await worker.fetch(new Request("http://example.com/health"), {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("GET /public/onboarding-sessions/{id} without API key returns 401", async () => {
    const response = await worker.fetch(
      new Request(
        "http://example.com/public/onboarding-sessions/11111111-1111-4111-8111-111111111111",
      ),
      {
        SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
      },
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeDefined();
  });

  it("POST /public/partner/api-keys without X-Partner-Mint-Key returns 401", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/public/partner/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          party_id: "22222222-2222-4222-8222-222222222222",
        }),
      }),
      {
        SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service_role_test",
        PARTNER_MINT_SECRET: "only-mint-knows",
      },
    );
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("unauthorized_mint");
  });

  it("OPTIONS returns 204 with CORS headers including partner headers", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/public/onboarding-sessions", { method: "OPTIONS" }),
      {},
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Api-Key");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-Partner-Mint-Key");
  });
});
