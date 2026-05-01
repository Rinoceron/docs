import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const docsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(docsRoot, "..", "..");
const inventoryPath = path.join(repoRoot, "backend", "api", "src", "routes", "endpointInventory.json");
const workerIndexPath = path.join(repoRoot, "backend", "api", "src", "index.ts");
const documentationPath = path.join(docsRoot, "data", "endpointDocumentation.json");
const apiReferenceRoot = path.join(docsRoot, "api-reference", "rhino");
const stagePagesDir = path.join(apiReferenceRoot, "stages");

const stageOrder = [
  "onboarding",
  "application",
  "servicing",
  "delinquency",
  "misc-services",
  "closure",
];

const methodOrder = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function endpointKey(method, routePath) {
  return `${method.toUpperCase()} ${routePath}`;
}

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

function parseHandlerStages(indexSource) {
  const importPattern = /import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+"\.\/routes\/([^/]+)\//g;
  const handlerStage = new Map();
  let match = importPattern.exec(indexSource);
  while (match) {
    const [, handler, stage] = match;
    handlerStage.set(handler, stage);
    match = importPattern.exec(indexSource);
  }
  return handlerStage;
}

function parseHandlerImports(indexSource) {
  const importPattern = /import\s+\{\s*([A-Za-z0-9_]+)\s*\}\s+from\s+"(\.\/routes\/[^"]+)";/g;
  const handlerFileMap = new Map();
  let match = importPattern.exec(indexSource);
  while (match) {
    const [, handler, relativeFile] = match;
    handlerFileMap.set(handler, path.join(repoRoot, "backend", "api", "src", `${relativeFile}.ts`));
    match = importPattern.exec(indexSource);
  }
  return handlerFileMap;
}

function parseRoutesFromIndex(indexSource) {
  const routePattern =
    /\{\s*method:\s*"([A-Z]+)"\s*,\s*path:\s*"([^"]+)"\s*,\s*handler:\s*([A-Za-z0-9_]+)\s*\}/g;
  const routes = [];
  let match = routePattern.exec(indexSource);
  while (match) {
    const [, method, routePath, handler] = match;
    routes.push({ method, path: routePath, handler });
    match = routePattern.exec(indexSource);
  }
  return routes;
}

function parseRequiredFieldsFromMessage(message) {
  if (typeof message !== "string") return [];
  const directMatches = [...message.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s+is required/g)].map(
    (match) => match[1],
  );
  if (directMatches.length > 0) return directMatches;
  const andRequired = message.match(/([a-zA-Z_][a-zA-Z0-9_]*(?:\s+and\s+[a-zA-Z_][a-zA-Z0-9_]*)+)\s+are required/);
  if (!andRequired) return [];
  return andRequired[1].split(/\s+and\s+/).map((part) => part.trim());
}

function collectStringTypedFields(source) {
  const fields = new Set();
  for (const match of source.matchAll(/typeof\s+rec\.([a-zA-Z_][a-zA-Z0-9_]*)\s*===\s*"string"/g)) {
    fields.add(match[1]);
  }
  for (const match of source.matchAll(/body\?\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    fields.add(match[1]);
  }
  return fields;
}

function collectRequiredFields(source) {
  const required = new Set();
  for (const match of source.matchAll(/!\s*(?:body\?\.)?([a-zA-Z_][a-zA-Z0-9_]*)/g)) {
    required.add(match[1]);
  }
  for (const match of source.matchAll(/JSON\.stringify\(\{\s*error:\s*"([^"]+)"/g)) {
    for (const field of parseRequiredFieldsFromMessage(match[1])) {
      required.add(field);
    }
  }
  return required;
}

function toSerializableExample(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toSerializableExample(entry));
  }
  if (typeof value === "object") {
    const obj = {};
    for (const [key, entry] of Object.entries(value)) {
      obj[key] = toSerializableExample(entry);
    }
    return obj;
  }
  return String(value);
}

function tryParseObjectLiteral(literalText) {
  try {
    const parsed = Function(`"use strict"; return (${literalText});`)();
    return toSerializableExample(parsed);
  } catch {
    return null;
  }
}

function buildSchemaFromExample(example) {
  if (example === null) return { type: "null" };
  if (typeof example === "string") return { type: "string" };
  if (typeof example === "number") return { type: "number" };
  if (typeof example === "boolean") return { type: "boolean" };
  if (Array.isArray(example)) {
    return {
      type: "array",
      items: example.length > 0 ? buildSchemaFromExample(example[0]) : { type: "object", additionalProperties: true },
    };
  }
  if (typeof example === "object") {
    const properties = {};
    const required = [];
    for (const [key, value] of Object.entries(example)) {
      properties[key] = buildSchemaFromExample(value);
      required.push(key);
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: false,
    };
  }
  return { type: "object", additionalProperties: true };
}

function defaultResponseDescription(status) {
  if (status >= 200 && status < 300) return "Successful response";
  if (status === 400) return "Validation or request format error";
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Resource not found";
  if (status === 500) return "Internal server error";
  if (status === 501) return "Not implemented (placeholder handler)";
  if (status === 502) return "Upstream dependency error";
  return "Response";
}

function extractJsonResponses(source) {
  const responses = [];
  const jsonHelperPattern = /json\(\s*(\{[\s\S]*?\})\s*,\s*(\d{3})\s*\)/g;
  let match = jsonHelperPattern.exec(source);
  while (match) {
    const [, objectLiteral, statusText] = match;
    const status = Number.parseInt(statusText, 10);
    const example = tryParseObjectLiteral(objectLiteral);
    responses.push({
      status,
      description: defaultResponseDescription(status),
      example,
    });
    match = jsonHelperPattern.exec(source);
  }

  const newResponsePattern =
    /new Response\(\s*JSON\.stringify\(\s*(\{[\s\S]*?\})\s*\)\s*,\s*\{[\s\S]*?status:\s*(\d{3})[\s\S]*?\}\s*\)/g;
  match = newResponsePattern.exec(source);
  while (match) {
    const [, objectLiteral, statusText] = match;
    const status = Number.parseInt(statusText, 10);
    const example = tryParseObjectLiteral(objectLiteral);
    responses.push({
      status,
      description: defaultResponseDescription(status),
      example,
    });
    match = newResponsePattern.exec(source);
  }
  return responses;
}

function inferRequestBody(endpoint, source) {
  const method = endpoint.method.toUpperCase();
  if (method === "GET" || method === "DELETE") return null;
  if (!/request\.json\(/.test(source)) {
    return {
      required: true,
      schema: {
        type: "object",
        properties: {
          example_field: { type: "string" },
        },
        additionalProperties: true,
      },
      example: { example_field: "value" },
    };
  }

  const typedFields = collectStringTypedFields(source);
  const requiredFields = collectRequiredFields(source);
  const properties = {};
  for (const field of typedFields) {
    properties[field] = { type: "string" };
  }
  const sortedRequired = Array.from(requiredFields).sort((a, b) => a.localeCompare(b));
  const example = {};
  for (const field of Object.keys(properties)) {
    example[field] = `example_${field}`;
  }
  return {
    required: true,
    schema: {
      type: "object",
      properties: Object.keys(properties).length > 0 ? properties : { example_field: { type: "string" } },
      ...(sortedRequired.length > 0 ? { required: sortedRequired } : {}),
      additionalProperties: true,
    },
    example: Object.keys(example).length > 0 ? example : { example_field: "value" },
  };
}

function inferResponses(endpoint, source) {
  const collected = extractJsonResponses(source);
  const deduped = new Map();
  for (const response of collected) {
    if (!deduped.has(response.status)) {
      deduped.set(response.status, response);
    }
  }

  if (deduped.size === 0) {
    const fallbackStatus = endpoint.method.toUpperCase() === "POST" ? 201 : 200;
    deduped.set(fallbackStatus, {
      status: fallbackStatus,
      description: defaultResponseDescription(fallbackStatus),
      example: { ok: true },
    });
    deduped.set(501, {
      status: 501,
      description: defaultResponseDescription(501),
      example: { error: "Not implemented", operation_id: endpoint.operationId },
    });
  }

  return Array.from(deduped.values())
    .sort((a, b) => a.status - b.status)
    .map((response) => ({
      status: response.status,
      description: response.description,
      schema: buildSchemaFromExample(response.example ?? { result: "response" }),
      example: response.example ?? { result: "response" },
    }));
}

function inferOperationContract(endpoint, source) {
  if (!source) {
    return {
      requestBody: inferRequestBody(endpoint, ""),
      responses: inferResponses(endpoint, ""),
    };
  }
  return {
    requestBody: inferRequestBody(endpoint, source),
    responses: inferResponses(endpoint, source),
  };
}

function mergeRouteMetadata(indexRoutes, inventory, handlerStage) {
  const inventoryByKey = new Map(
    inventory
      .filter((item) => typeof item?.method === "string" && typeof item?.path === "string")
      .map((item) => [endpointKey(item.method, item.path), item]),
  );

  const merged = indexRoutes.map((route) => {
    const key = endpointKey(route.method, route.path);
    const fromInventory = inventoryByKey.get(key);
    return {
      path: route.path,
      method: route.method,
      handler: route.handler,
      operationId: fromInventory?.operationId ?? route.handler,
      tag: fromInventory?.tag ?? (route.path.startsWith("/public/") ? "Public" : "Internal"),
      stage: fromInventory?.stage ?? handlerStage.get(route.handler) ?? "misc-services",
    };
  });

  return merged;
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

function operationFromContract(endpoint, docById, contract) {
  const id = endpoint.operationId;
  const doc = docById[id] ?? {};
  const operation = {
    operationId: id,
    summary: doc.summary ?? operationSummary(endpoint),
    tags: [titleCase(endpoint.stage)],
    responses: {},
  };
  if (doc.description) {
    operation.description = doc.description;
  }

  if (contract.requestBody) {
    operation.requestBody = {
      required: contract.requestBody.required,
      content: {
        "application/json": {
          schema: contract.requestBody.schema,
          example: contract.requestBody.example,
        },
      },
    };
  }

  for (const response of contract.responses) {
    operation.responses[String(response.status)] = {
      description: response.description,
      content: {
        "application/json": {
          schema: response.schema,
          example: response.example,
        },
      },
    };
  }

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

function buildOpenApi(publicEndpoints, docById, inferredByOperation) {
  const paths = {};

  for (const endpoint of publicEndpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }
    const methodKey = endpoint.method.toLowerCase();
    const contract = inferredByOperation.get(endpoint.operationId) ?? inferOperationContract(endpoint, "");
    paths[endpoint.path][methodKey] = operationFromContract(endpoint, docById, contract);
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

function buildEnrichedPublicEndpoints(publicEndpoints, docById, inferredByOperation) {
  return publicEndpoints.map((endpoint) => {
    const doc = docById[endpoint.operationId] ?? {};
    const contract = inferredByOperation.get(endpoint.operationId) ?? inferOperationContract(endpoint, "");
    return {
      operationId: endpoint.operationId,
      method: endpoint.method.toUpperCase(),
      path: endpoint.path,
      stage: endpoint.stage,
      tag: endpoint.tag,
      description: doc.description ?? operationSummary(endpoint),
      requestBody: contract.requestBody,
      responses: contract.responses,
    };
  });
}

function stagePageContent(stage, endpoints, docById) {
  const title = titleCase(stage);
  const intro =
    stage === "misc-services"
      ? `Endpoints below include \`/public/*\` routes in the **${title}** category plus \`GET /health\` (platform health check). Generated from backend route definitions with metadata from the inventory file.`
      : `Endpoints below are generated from backend route definitions and filtered to \`/public/*\` for this stage.`;

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

async function main() {
  const rawIndex = await readFile(workerIndexPath, "utf8");
  const rawInventory = await readFile(inventoryPath, "utf8");
  const inventory = JSON.parse(rawInventory);
  const handlerStage = parseHandlerStages(rawIndex);
  const handlerFileMap = parseHandlerImports(rawIndex);
  const routesFromIndex = parseRoutesFromIndex(rawIndex);
  const mergedInventory = mergeRouteMetadata(routesFromIndex, inventory, handlerStage);

  let docById = {};
  try {
    const rawDoc = await readFile(documentationPath, "utf8");
    docById = JSON.parse(rawDoc).byOperationId ?? {};
  } catch {
    console.warn("No endpointDocumentation.json found; descriptions will be minimal.");
  }

  const publicEndpoints = mergedInventory
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

  const inferredByOperation = new Map();
  for (const endpoint of publicEndpoints) {
    const sourcePath = endpoint.handler ? handlerFileMap.get(endpoint.handler) : undefined;
    let source = "";
    if (sourcePath) {
      try {
        source = await readFile(sourcePath, "utf8");
      } catch {
        source = "";
      }
    }
    inferredByOperation.set(endpoint.operationId, inferOperationContract(endpoint, source));
  }

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

  const publicInventoryPath = path.join(apiReferenceRoot, "public-endpoints.json");
  const openApiPath = path.join(apiReferenceRoot, "openapi.public.json");

  const enrichedPublicEndpoints = buildEnrichedPublicEndpoints(publicEndpoints, docById, inferredByOperation);

  await writeFile(publicInventoryPath, `${JSON.stringify(enrichedPublicEndpoints, null, 2)}\n`);
  await writeFile(openApiPath, `${JSON.stringify(buildOpenApi(publicEndpoints, docById, inferredByOperation), null, 2)}\n`);

  for (const stage of stageNames) {
    const endpoints = endpointsByStage.get(stage) ?? [];
    const pagePath = path.join(stagePagesDir, `${stage}.mdx`);
    await writeFile(pagePath, `${stagePageContent(stage, endpoints, docById)}\n`);
  }

  console.log(`Generated docs for ${publicEndpoints.length} public endpoints (+ /health in misc page).`);
}

main().catch((error) => {
  console.error("Failed to generate docs:", error);
  process.exitCode = 1;
});
