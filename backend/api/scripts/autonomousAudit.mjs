import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..", "..");
const inventoryPath = path.join(repoRoot, "backend", "api", "src", "routes", "endpointInventory.json");
const outputDir = path.join(repoRoot, "backend", "api", "reports");
const outputJsonPath = path.join(outputDir, "autonomous-audit-results.json");
const outputMdPath = path.join(outputDir, "autonomous-audit-report.md");
const mcpPath = path.join(repoRoot, "backend", "agents", "24.04.26 Database MCP.md");

const baseUrl = "https://rhino-api.rinoceron-corp.workers.dev";
const runId = `audit-${Date.now()}`;
const syntheticUuid = "11111111-1111-4111-8111-111111111111";
const syntheticUuid2 = "22222222-2222-4222-8222-222222222222";
const syntheticUuid3 = "33333333-3333-4333-8333-333333333333";

function fillPathTemplate(pathTemplate) {
  return pathTemplate
    .replaceAll("{sessionId}", syntheticUuid)
    .replaceAll("{addressId}", syntheticUuid2)
    .replaceAll("{partyId}", syntheticUuid)
    .replaceAll("{applicationId}", syntheticUuid)
    .replaceAll("{loanId}", syntheticUuid)
    .replaceAll("{scheduleId}", syntheticUuid2)
    .replaceAll("{paymentMethodId}", syntheticUuid2)
    .replaceAll("{transactionId}", syntheticUuid2)
    .replaceAll("{collateralId}", syntheticUuid2)
    .replaceAll("{delinquencyCaseId}", syntheticUuid2)
    .replaceAll("{documentId}", syntheticUuid2)
    .replaceAll("{loanProductId}", syntheticUuid2)
    .replaceAll("{requirementId}", syntheticUuid3);
}

function syntheticBody(operationId) {
  const common = {
    audit_run_id: runId,
    created_at: new Date().toISOString(),
  };

  if (operationId === "createOnboardingSession") {
    return {
      ...common,
      applicant_type: "BUSINESS",
      country_of_incorporation: "US",
      legal_business_type: "LLC",
      locale: "en-US",
      entry_channel: "API",
    };
  }

  if (operationId.toLowerCase().includes("email")) {
    return { ...common, email: `${runId}@example.com` };
  }

  if (operationId.toLowerCase().includes("phone")) {
    return { ...common, phone_e164: "+13055550100", delivery_channel: "SMS" };
  }

  if (operationId.toLowerCase().includes("application")) {
    return {
      ...common,
      party_id: syntheticUuid,
      loan_product_id: syntheticUuid2,
      requested_amount_asset: "0.05000000",
      requested_amount: "2500.00",
      requested_amount_currency: "USD",
      requested_term_months: 6,
      purpose: "Acquire BTC",
    };
  }

  if (operationId.toLowerCase().includes("loanproduct")) {
    return {
      ...common,
      name: `Audit Product ${runId}`,
      currency: "USD",
      min_amount_currency: "100.00",
      max_amount_currency: "10000.00",
      min_term_mo: 3,
      max_term_mo: 24,
      default_apr: "18.00",
      allowed_collateral: "BTC",
    };
  }

  if (operationId.toLowerCase().includes("loan") && operationId.toLowerCase().includes("create")) {
    return {
      ...common,
      application_id: syntheticUuid,
      party_id: syntheticUuid,
      loan_product_id: syntheticUuid2,
      origination_date: "2026-01-01",
      principal_amount: "2500.00",
      principal_amount_currency: "USD",
      interest_rate_apr: "18.00",
      term_months: 6,
    };
  }

  if (operationId.toLowerCase().includes("paymentmethod")) {
    return { ...common, type: "USDC_WALLET", address: "0xabc123", metadata: { chain: "base" } };
  }

  if (operationId.toLowerCase().includes("transaction")) {
    return {
      ...common,
      txn_type: "PAYMENT",
      effective_date: "2026-01-02",
      posted_at: new Date().toISOString(),
      amount: "100.00",
      currency: "USD",
      status: "PENDING",
      component: "PRINCIPAL",
    };
  }

  if (operationId.toLowerCase().includes("collateral")) {
    return {
      ...common,
      asset: "BTC",
      initial_collateral: "0.05000000",
      loan_currency: "USD",
      initial_value_currency: "2500.00",
      remaining_collateral: "0.05000000",
      remaining_value_currency: "2500.00",
      lock_status: "LOCKED",
    };
  }

  if (operationId.toLowerCase().includes("delinquency")) {
    return { ...common, stage: "0_7", opened_at: new Date().toISOString(), loan_currency: "USD" };
  }

  if (operationId.toLowerCase().includes("communication")) {
    return {
      ...common,
      channel: "EMAIL",
      direction: "OUTBOUND",
      content: "audit test notification",
      sent_at: new Date().toISOString(),
    };
  }

  if (operationId.toLowerCase().includes("document")) {
    return {
      ...common,
      document_type: "ID",
      file_name: `${runId}.pdf`,
      mime_type: "application/pdf",
      storage_url: "https://example.com/doc.pdf",
      hash_sha256: "a".repeat(64),
      uploaded_at: new Date().toISOString(),
      status: "RECEIVED",
    };
  }

  return common;
}

function classifyIssue(result) {
  const status = result.status;
  const isInternal = result.path.startsWith("/internal/");
  if (status >= 200 && status < 500 && status !== 404) {
    return null;
  }

  if (status === 404) {
    return {
      severity: "high",
      title: "Endpoint route unreachable",
      impact: "Operation defined in inventory returns 404 on production route.",
      expected: "Route should exist and return non-404 response.",
      actual: `Received ${status}`,
    };
  }

  if (status >= 500) {
    return {
      severity: "high",
      title: "Server error response",
      impact: "Endpoint execution fails with server-side error.",
      expected: "Endpoint should return a controlled non-5xx status for invalid test input.",
      actual: `Received ${status}`,
    };
  }

  if (status === 401 || status === 403) {
    return isInternal
      ? null
      : {
          severity: "medium",
          title: "Public endpoint requires auth unexpectedly",
          impact: "Public API may be inaccessible without auth despite public path prefix.",
          expected: "Public path should generally allow request processing (possibly validation errors).",
          actual: `Received ${status}`,
        };
  }

  return {
    severity: "low",
    title: "Unexpected status pattern",
    impact: "Response pattern differs from expected contract behavior.",
    expected: "Controlled contract response.",
    actual: `Received ${status}`,
  };
}

function hasCors(headers) {
  return headers["access-control-allow-origin"] !== undefined;
}

async function main() {
  const inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));
  const mcpText = await fs.readFile(mcpPath, "utf8");
  await fs.mkdir(outputDir, { recursive: true });

  const endpointResults = [];
  const findings = [];

  for (const endpoint of inventory) {
    const requestPath = fillPathTemplate(endpoint.path);
    const url = `${baseUrl}${requestPath}`;
    const method = endpoint.method.toUpperCase();
    const headers = {
      "Content-Type": "application/json",
      "X-Audit-Run-Id": runId,
      Authorization: "Bearer synthetic.invalid.token",
    };

    const init = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      init.body = JSON.stringify(syntheticBody(endpoint.operationId));
    }

    const startedAt = Date.now();
    let response;
    let bodyText = "";
    let error = null;
    try {
      response = await fetch(url, init);
      bodyText = await response.text();
    } catch (e) {
      const message = String(e?.message || e);
      const causeCode = e?.cause?.code ? ` | cause_code=${e.cause.code}` : "";
      const causeMessage = e?.cause?.message ? ` | cause_message=${e.cause.message}` : "";
      error = `${message}${causeCode}${causeMessage}`;
    }
    const durationMs = Date.now() - startedAt;

    if (error) {
      const row = {
        operationId: endpoint.operationId,
        method,
        path: endpoint.path,
        status: null,
        durationMs,
        error,
      };
      endpointResults.push(row);
      findings.push({
        severity: "high",
        category: "endpoint",
        operationId: endpoint.operationId,
        method,
        path: endpoint.path,
        title: "Request execution failure",
        expected: "Endpoint should be reachable over network.",
        actual: error,
        impact: "No endpoint behavior validation possible for this route.",
      });
      continue;
    }

    const headerMap = {};
    response.headers.forEach((value, key) => {
      headerMap[key.toLowerCase()] = value;
    });
    const row = {
      operationId: endpoint.operationId,
      method,
      path: endpoint.path,
      status: response.status,
      durationMs,
      hasCors: hasCors(headerMap),
      responseBodySnippet: bodyText.slice(0, 350),
    };
    endpointResults.push(row);

    const issue = classifyIssue({ ...row, path: endpoint.path });
    if (issue) {
      findings.push({
        severity: issue.severity,
        category: "endpoint",
        operationId: endpoint.operationId,
        method,
        path: endpoint.path,
        title: issue.title,
        expected: issue.expected,
        actual: issue.actual,
        impact: issue.impact,
      });
    }

    if (!row.hasCors) {
      findings.push({
        severity: "medium",
        category: "endpoint",
        operationId: endpoint.operationId,
        method,
        path: endpoint.path,
        title: "Missing CORS header",
        expected: "Access-Control-Allow-Origin should be present.",
        actual: "Header absent in response.",
        impact: "Browser clients may fail cross-origin calls.",
      });
    }
  }

  const dbChecks = [];
  dbChecks.push({
    check: "party_id propagation trigger validation",
    status: "blocked",
    reason: "No direct Supabase SQL channel/credentials provided to execute insert/select trigger checks safely.",
  });
  dbChecks.push({
    check: "RLS matrix validation (tenant A/B/main-party)",
    status: "blocked",
    reason: "No valid tenant JWT fixtures or API auth bootstrap endpoint available for minting scoped tokens.",
  });

  findings.push({
    severity: "info",
    category: "database",
    title: "DB propagation checks blocked",
    expected: "Execute trigger-based checks on rhino loan-derived tables.",
    actual: "Execution blocked due to missing direct DB auth channel.",
    impact: "party_id propagation assurance remains unverified in this run.",
  });
  findings.push({
    severity: "info",
    category: "database",
    title: "RLS matrix checks blocked",
    expected: "Validate own-party allow, cross-tenant deny, and main_party_id delegation.",
    actual: "Execution blocked due to missing scoped token fixtures.",
    impact: "RLS behavior remains unverified in this run.",
  });

  const severityOrder = ["critical", "high", "medium", "low", "info"];
  const grouped = Object.fromEntries(severityOrder.map((s) => [s, []]));
  for (const finding of findings) {
    grouped[finding.severity]?.push(finding);
  }

  const summary = {
    runId,
    baseUrl,
    executedAt: new Date().toISOString(),
    inventoryCount: inventory.length,
    testedEndpoints: endpointResults.length,
    endpointStatusCounts: endpointResults.reduce((acc, row) => {
      const key = String(row.status ?? "error");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    findingCounts: severityOrder.reduce((acc, s) => {
      acc[s] = grouped[s].length;
      return acc;
    }, {}),
    mcpContextApplied:
      mcpText.includes("loan_transaction") &&
      (mcpText.includes("party_id = tenant root") || mcpText.includes("party_id") && mcpText.includes("tenant root")),
  };

  const output = { summary, endpointResults, dbChecks, findingsGrouped: grouped };
  await fs.writeFile(outputJsonPath, JSON.stringify(output, null, 2), "utf8");

  const lines = [];
  lines.push("# Autonomous Endpoint Audit Report");
  lines.push("");
  lines.push(`- Run ID: \`${summary.runId}\``);
  lines.push(`- Target: \`${summary.baseUrl}\``);
  lines.push(`- Executed at: \`${summary.executedAt}\``);
  lines.push(`- Endpoints in inventory: **${summary.inventoryCount}**`);
  lines.push(`- Endpoints tested: **${summary.testedEndpoints}**`);
  lines.push("");
  lines.push("## Severity Summary");
  for (const s of severityOrder) {
    lines.push(`- ${s.toUpperCase()}: **${summary.findingCounts[s]}**`);
  }
  lines.push("");
  lines.push("## Endpoint Status Distribution");
  Object.entries(summary.endpointStatusCounts)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([status, count]) => {
      lines.push(`- ${status}: ${count}`);
    });
  lines.push("");
  lines.push("## Findings");
  for (const s of severityOrder) {
    lines.push(`### ${s.toUpperCase()}`);
    const items = grouped[s];
    if (!items.length) {
      lines.push("- None");
      lines.push("");
      continue;
    }
    for (const f of items) {
      lines.push(`- **${f.title}** | \`${f.category}\`${f.operationId ? ` | \`${f.operationId}\`` : ""}`);
      if (f.method && f.path) lines.push(`  - Route: \`${f.method} ${f.path}\``);
      lines.push(`  - Expected: ${f.expected}`);
      lines.push(`  - Actual: ${f.actual}`);
      lines.push(`  - Impact: ${f.impact}`);
    }
    lines.push("");
  }
  lines.push("## DB/RLS Validation Notes");
  dbChecks.forEach((check) => {
    lines.push(`- ${check.check}: **${check.status.toUpperCase()}** - ${check.reason}`);
  });
  lines.push("");
  lines.push("## Artifacts");
  lines.push(`- JSON: \`${outputJsonPath}\``);
  lines.push(`- Markdown: \`${outputMdPath}\``);
  lines.push("");
  await fs.writeFile(outputMdPath, lines.join("\n"), "utf8");

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
