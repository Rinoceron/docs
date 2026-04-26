import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(docsRoot, "..", "..");
const inventoryPath = path.join(repoRoot, "backend", "api", "src", "routes", "endpointInventory.json");
const documentationPath = path.join(docsRoot, "data", "endpointDocumentation.json");
const generatedRoot = path.join(docsRoot, "generated");
const stagePagesDir = path.join(generatedRoot, "stages");

const stageOrder = [
  "onboarding",
  "application",
  "servicing",
  "delinquency",
  "misc-services",
  "closure",
];

const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function titleCase(value) {
  return value
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function sortEndpoints(a, b) {
  const pathCompare = a.path.localeCompare(b.path);
  if (pathCompare !== 0) return pathCompare;

  const methodA = methodOrder.indexOf(a.method.toUpperCase());
  const methodB = methodOrder.indexOf(b.method.toUpperCase());
  return methodA - methodB;
}

function operationSummary(endpoint) {
  const resource = endpoint.path.split("/").filter(Boolean).at(-1) ?? "resource";
  return `${endpoint.method.toUpperCase()} ${resource}`;
}

function buildComponentsSchemas() {
  return {
    ErrorResponse: {
      type: "object",
      properties: {
        error: { type: "string" },
        detail: { type: "string" },
        operation_id: { type: "string" },
      },
    },
    NotImplementedResponse: {
      type: "object",
      required: ["error", "operation_id"],
      properties: {
        error: { type: "string" },
        operation_id: { type: "string" },
      },
    },
    HealthResponse: {
      type: "object",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["ok"] },
      },
    },
    PartyReadyPayload: {
      type: "object",
      required: ["event", "session_id", "party"],
      properties: {
        event: { type: "string", enum: ["party.ready"] },
        session_id: { type: "string", format: "uuid" },
        party: { type: "object", additionalProperties: true },
      },
    },
    RegisterWebhookRequest: {
      type: "object",
      additionalProperties: false,
      required: ["webhook_url"],
      properties: {
        webhook_url: { type: "string", format: "uri" },
        webhook_secret: { type: "string" },
      },
    },
    RegisterWebhookResponse: {
      type: "object",
      required: ["ok", "session_id"],
      properties: {
        ok: { type: "boolean" },
        session_id: { type: "string", format: "uuid" },
      },
    },
    GenericJsonBody: {
      type: "object",
      additionalProperties: true,
    },
  };
}

function stub501(operationId) {
  return {
    description: "Not implemented (placeholder handler)",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/NotImplementedResponse" },
        example: { error: "Not implemented", operation_id: operationId },
      },
    },
  };
}

function buildOperation(endpoint, docById) {
  const id = endpoint.operationId;
  const doc = docById[id] ?? {};
  const method = endpoint.method.toUpperCase();
  const operation = {
    operationId: id,
    summary: doc.summary ?? operationSummary(endpoint),
    tags: [titleCase(endpoint.stage)],
    responses: {},
  };
  if (doc.description) {
    operation.description = doc.description;
  }

  if (id === "registerOnboardingSessionWebhook") {
    operation.requestBody = {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/RegisterWebhookRequest" },
          example: {
            webhook_url: "https://partner.example.com/hooks/rhino/party-ready",
            webhook_secret: "optional-shared-secret",
          },
        },
      },
    };
    operation.responses = {
      200: {
        description: "Webhook URL stored on the session",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RegisterWebhookResponse" },
            example: { ok: true, session_id: "11111111-1111-4111-8111-111111111111" },
          },
        },
      },
      400: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { error: "webhook_url is required" },
          },
        },
      },
      502: {
        description: "Persistence or upstream error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
            example: { error: "Failed to persist webhook", detail: "…" },
          },
        },
      },
    };
    return operation;
  }

  if (method === "GET") {
    operation.responses["200"] = {
      description: "Successful response",
      content: {
        "application/json": {
          schema: { type: "object", additionalProperties: true },
          example:
            id === "health"
              ? { status: "ok" }
              : id === "listDocumentsForOnboardingSession"
                ? { documents: [{ document_id: "uuid", kind: "ID", status: "PENDING" }] }
                : { result: "Illustrative example; replace when the handler is fully implemented." },
        },
      },
    };
    operation.responses["501"] = stub501(id);
    return operation;
  }

  operation.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/GenericJsonBody" },
        example: { example_field: "value" },
      },
    },
  };
  operation.responses["200"] = {
    description: "Successful response (or 201 where applicable)",
    content: {
      "application/json": {
        schema: { type: "object", additionalProperties: true },
        example: { ok: true },
      },
    },
  };
  operation.responses["501"] = stub501(id);
  return operation;
}

function buildHealthOperation(docById) {
  const doc = docById.health ?? {};
  return {
    operationId: "health",
    summary: doc.summary ?? "Health check",
    description:
      doc.description ??
      "Lightweight liveness probe returning service availability for load balancers and monitors.",
    tags: ["Misc Services"],
    responses: {
      200: {
        description: "Service is reachable",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/HealthResponse" },
            example: { status: "ok" },
          },
        },
      },
    },
  };
}

function buildWebhooks() {
  return {
    partyReady: {
      post: {
        operationId: "partyReadyWebhook",
        summary: "Outbound party.ready (Rhino calls your URL)",
        description:
          "After an internal onboarding decision with `decision=APPROVED` and a `party_id`, Rhino POSTs this JSON body to the HTTPS URL stored via `PUT /public/onboarding-sessions/{sessionId}/webhook` (`partner_ready_webhook_url`). Payload mirrors the party resource you would read with `GET /public/onboarding-sessions/{sessionId}/party`. If `partner_ready_webhook_secret` is set, Rhino sends `X-Rhino-Signature: sha256=<hex>` (HMAC-SHA256 of the raw JSON body).",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PartyReadyPayload" },
              example: {
                event: "party.ready",
                session_id: "11111111-1111-4111-8111-111111111111",
                party: {
                  party_id: "22222222-2222-4222-8222-222222222222",
                  legal_name: "Example Borrower LLC",
                  type: "business",
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Partner acknowledged the webhook",
            content: {
              "application/json": {
                example: { received: true },
              },
            },
          },
        },
      },
    },
  };
}

function buildOpenApi(publicEndpoints, docById) {
  const paths = {};

  for (const endpoint of publicEndpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }
    const methodKey = endpoint.method.toLowerCase();
    paths[endpoint.path][methodKey] = buildOperation(endpoint, docById);
  }

  paths["/health"] = {
    get: buildHealthOperation(docById),
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Rhino Asset Public API",
      version: "1.0.0",
      description:
        "Public Rhino Asset HTTP API. Internal routes are excluded from this spec. Outbound webhooks are documented under **Webhooks** (`partyReady`): Rhino POSTs to your URL when onboarding is approved with a party.",
    },
    servers: [{ url: "https://api.rhino-asset.com" }],
    tags: [
      { name: "Webhooks", description: "Outbound events Rhino delivers to partner HTTPS endpoints." },
    ],
    paths,
    webhooks: buildWebhooks(),
    components: {
      schemas: buildComponentsSchemas(),
    },
  };
}

function stagePageContent(stage, endpoints, docById) {
  const title = titleCase(stage);
  const intro =
    stage === "misc-services"
      ? `Endpoints below include \`/public/*\` routes in the **${title}** category plus \`GET /health\` (platform health check). Generated from \`backend/api/src/routes/endpointInventory.json\` and the docs metadata file.`
      : `Endpoints below are generated from \`backend/api/src/routes/endpointInventory.json\` and filtered to \`/public/*\` for this stage.`;

  const lines = [
    `---`,
    `title: ${title}`,
    `description: Public ${title} endpoints`,
    `---`,
    ``,
    `# ${title}`,
    ``,
    intro,
    ``,
  ];

  for (const endpoint of endpoints) {
    lines.push(`## \`${endpoint.method.toUpperCase()} ${endpoint.path}\``);
    lines.push("");
    const desc = docById[endpoint.operationId]?.description;
    if (desc) {
      lines.push(desc);
      lines.push("");
    }
    lines.push(`- \`operationId\`: \`${endpoint.operationId}\``);
    lines.push("");
  }

  return lines.join("\n");
}

function buildMintConfig(stageNames) {
  return {
    $schema: "https://mintlify.com/schema.json",
    name: "Rhino Asset API Docs",
    logo: {
      dark: "/artifacts/Logo no background.png",
      light: "/artifacts/Logo no background.png",
    },
    navigation: [
      {
        group: "Introduction",
        pages: ["index"],
      },
      {
        group: "API reference",
        openapi: "generated/openapi.public.json",
      },
      ...stageNames.map((stage) => ({
        group: titleCase(stage),
        pages: [`generated/stages/${stage}`],
      })),
    ],
    openapi: "generated/openapi.public.json",
    api: {
      playground: {
        display: "interactive",
      },
      examples: {
        defaults: "all",
        languages: ["curl", "javascript", "python"],
      },
    },
  };
}

async function main() {
  const rawInventory = await readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(rawInventory);

  let docById = {};
  try {
    const rawDoc = await readFile(documentationPath, "utf8");
    docById = JSON.parse(rawDoc).byOperationId ?? {};
  } catch {
    console.warn("No endpointDocumentation.json found; descriptions will be minimal.");
  }

  const publicEndpoints = inventory
    .filter((endpoint) => typeof endpoint.path === "string" && endpoint.path.startsWith("/public/"))
    .sort((a, b) => {
      const stageAIndex = stageOrder.indexOf(a.stage);
      const stageBIndex = stageOrder.indexOf(b.stage);
      const normalizedA = stageAIndex === -1 ? Number.MAX_SAFE_INTEGER : stageAIndex;
      const normalizedB = stageBIndex === -1 ? Number.MAX_SAFE_INTEGER : stageBIndex;
      if (normalizedA !== normalizedB) return normalizedA - normalizedB;
      if (a.stage !== b.stage) return a.stage.localeCompare(b.stage);
      return sortEndpoints(a, b);
    });

  const endpointsByStage = new Map();
  for (const endpoint of publicEndpoints) {
    if (!endpointsByStage.has(endpoint.stage)) {
      endpointsByStage.set(endpoint.stage, []);
    }
    endpointsByStage.get(endpoint.stage).push(endpoint);
  }

  const misc = endpointsByStage.get("misc-services");
  if (misc) {
    misc.push({
      path: "/health",
      method: "GET",
      operationId: "health",
      stage: "misc-services",
      tag: "Public - Platform",
    });
    misc.sort(sortEndpoints);
  }

  const stageNames = Array.from(endpointsByStage.keys()).sort((a, b) => {
    const ai = stageOrder.indexOf(a);
    const bi = stageOrder.indexOf(b);
    const na = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
    const nb = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
    return na - nb;
  });

  await mkdir(stagePagesDir, { recursive: true });

  const publicInventoryPath = path.join(generatedRoot, "public-endpoints.json");
  const openApiPath = path.join(generatedRoot, "openapi.public.json");
  const mintPath = path.join(docsRoot, "mint.json");
  const docsJsonPath = path.join(docsRoot, "docs.json");

  await writeFile(publicInventoryPath, `${JSON.stringify(publicEndpoints, null, 2)}\n`);
  await writeFile(openApiPath, `${JSON.stringify(buildOpenApi(publicEndpoints, docById), null, 2)}\n`);

  for (const stage of stageNames) {
    const endpoints = endpointsByStage.get(stage) ?? [];
    const pagePath = path.join(stagePagesDir, `${stage}.mdx`);
    await writeFile(pagePath, `${stagePageContent(stage, endpoints, docById)}\n`);
  }

  const mintConfig = buildMintConfig(stageNames);
  await writeFile(mintPath, `${JSON.stringify(mintConfig, null, 2)}\n`);
  await writeFile(docsJsonPath, `${JSON.stringify(mintConfig, null, 2)}\n`);

  console.log(`Generated docs for ${publicEndpoints.length} public endpoints (+ /health in misc page).`);
}

main().catch((error) => {
  console.error("Failed to generate docs:", error);
  process.exitCode = 1;
});
