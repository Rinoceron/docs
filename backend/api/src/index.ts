import type { EndpointHandler } from "./routes/_shared";
import { createOnboardingSession } from "./routes/onboarding/createOnboardingSession";
import { getOnboardingSession } from "./routes/onboarding/getOnboardingSession";
import { submitOnboardingEmail } from "./routes/onboarding/submitOnboardingEmail";
import { retryOnboardingEmailVerification } from "./routes/onboarding/retryOnboardingEmailVerification";
import { submitOnboardingPhone } from "./routes/onboarding/submitOnboardingPhone";
import { retryOnboardingPhoneVerification } from "./routes/onboarding/retryOnboardingPhoneVerification";
import { upsertApplicantProfile } from "./routes/onboarding/upsertApplicantProfile";
import { listOnboardingAddresses } from "./routes/onboarding/listOnboardingAddresses";
import { createOnboardingAddress } from "./routes/onboarding/createOnboardingAddress";
import { updateOnboardingAddress } from "./routes/onboarding/updateOnboardingAddress";
import { listPendingOnboardingRequirements } from "./routes/onboarding/listPendingOnboardingRequirements";
import { createOnboardingDocumentMetadata } from "./routes/misc-services/createOnboardingDocumentMetadata";
import { listDocumentsForOnboardingSession } from "./routes/misc-services/listDocumentsForOnboardingSession";
import { submitOnboardingForReview } from "./routes/onboarding/submitOnboardingForReview";
import { getPartyBySessionId } from "./routes/onboarding/getPartyBySessionId";
import { getParty } from "./routes/onboarding/getParty";
import { listPartyAddresses } from "./routes/onboarding/listPartyAddresses";
import { createPartyAddress } from "./routes/onboarding/createPartyAddress";
import { updatePartyAddress } from "./routes/onboarding/updatePartyAddress";
import { listAvailableLoanProductsForParty } from "./routes/application/listAvailableLoanProductsForParty";
import { createLoanApplication } from "./routes/application/createLoanApplication";
import { getLoanApplication } from "./routes/application/getLoanApplication";
import { updateLoanApplication } from "./routes/application/updateLoanApplication";
import { submitLoanApplication } from "./routes/application/submitLoanApplication";
import { listPartyApplications } from "./routes/application/listPartyApplications";
import { listLoansForParty } from "./routes/servicing/listLoansForParty";
import { getLoanForParty } from "./routes/servicing/getLoanForParty";
import { listLoanScheduleForParty } from "./routes/servicing/listLoanScheduleForParty";
import { listLoanBalancesForParty } from "./routes/servicing/listLoanBalancesForParty";
import { getLatestLoanBalanceForParty } from "./routes/servicing/getLatestLoanBalanceForParty";
import { listPaymentMethodsForPartyLoan } from "./routes/servicing/listPaymentMethodsForPartyLoan";
import { createPaymentMethodForPartyLoan } from "./routes/servicing/createPaymentMethodForPartyLoan";
import { updatePaymentMethodForPartyLoan } from "./routes/servicing/updatePaymentMethodForPartyLoan";
import { createPaymentIntentForPartyLoan } from "./routes/servicing/createPaymentIntentForPartyLoan";
import { listTransactionsForPartyLoan } from "./routes/servicing/listTransactionsForPartyLoan";
import { listCollateralForPartyLoan } from "./routes/servicing/listCollateralForPartyLoan";
import { listDelinquencyForPartyLoan } from "./routes/delinquency/listDelinquencyForPartyLoan";
import { listCommunicationsForPartyLoan } from "./routes/delinquency/listCommunicationsForPartyLoan";
import { listDocumentsForPartyLoan } from "./routes/misc-services/listDocumentsForPartyLoan";
import { upsertInternalBusinessProfile } from "./routes/onboarding/upsertInternalBusinessProfile";
import { upsertInternalBusinessActivity } from "./routes/onboarding/upsertInternalBusinessActivity";
import { createInternalBusinessRole } from "./routes/onboarding/createInternalBusinessRole";
import { listAllOnboardingRequirementsInternal } from "./routes/onboarding/listAllOnboardingRequirementsInternal";
import { decideOnboardingRequirementInternal } from "./routes/onboarding/decideOnboardingRequirementInternal";
import { createOnboardingDecisionInternal } from "./routes/onboarding/createOnboardingDecisionInternal";
import { registerOnboardingSessionWebhook } from "./routes/onboarding/registerOnboardingSessionWebhook";
import { patchPartyInternal } from "./routes/onboarding/patchPartyInternal";
import { listPartyAddressesInternal } from "./routes/onboarding/listPartyAddressesInternal";
import { createPartyAddressInternal } from "./routes/onboarding/createPartyAddressInternal";
import { patchPartyAddressInternal } from "./routes/onboarding/patchPartyAddressInternal";
import { createDocumentInternal } from "./routes/misc-services/createDocumentInternal";
import { getDocumentInternal } from "./routes/misc-services/getDocumentInternal";
import { patchDocumentInternal } from "./routes/misc-services/patchDocumentInternal";
import { listLoanProductsInternal } from "./routes/application/listLoanProductsInternal";
import { createLoanProductInternal } from "./routes/application/createLoanProductInternal";
import { getLoanProductInternal } from "./routes/application/getLoanProductInternal";
import { patchLoanProductInternal } from "./routes/application/patchLoanProductInternal";
import { listApplicationsInternal } from "./routes/application/listApplicationsInternal";
import { getApplicationInternal } from "./routes/application/getApplicationInternal";
import { patchApplicationInternal } from "./routes/application/patchApplicationInternal";
import { createApplicationDecisionInternal } from "./routes/application/createApplicationDecisionInternal";
import { listLoansInternal } from "./routes/servicing/listLoansInternal";
import { createLoanInternal } from "./routes/servicing/createLoanInternal";
import { getLoanInternal } from "./routes/servicing/getLoanInternal";
import { patchLoanInternal } from "./routes/servicing/patchLoanInternal";
import { fundLoanInternal } from "./routes/servicing/fundLoanInternal";
import { closeLoanInternal } from "./routes/closure/closeLoanInternal";
import { listLoanScheduleInternal } from "./routes/servicing/listLoanScheduleInternal";
import { createLoanScheduleRowsInternal } from "./routes/servicing/createLoanScheduleRowsInternal";
import { patchLoanScheduleRowInternal } from "./routes/servicing/patchLoanScheduleRowInternal";
import { listLoanBalancesInternal } from "./routes/servicing/listLoanBalancesInternal";
import { createLoanBalanceInternal } from "./routes/servicing/createLoanBalanceInternal";
import { listTransactionsInternal } from "./routes/servicing/listTransactionsInternal";
import { createTransactionInternal } from "./routes/servicing/createTransactionInternal";
import { getTransactionInternal } from "./routes/servicing/getTransactionInternal";
import { patchTransactionInternal } from "./routes/servicing/patchTransactionInternal";
import { listPaymentMethodsInternal } from "./routes/servicing/listPaymentMethodsInternal";
import { createPaymentMethodInternal } from "./routes/servicing/createPaymentMethodInternal";
import { patchPaymentMethodInternal } from "./routes/servicing/patchPaymentMethodInternal";
import { listCollateralInternal } from "./routes/servicing/listCollateralInternal";
import { createCollateralInternal } from "./routes/servicing/createCollateralInternal";
import { patchCollateralInternal } from "./routes/servicing/patchCollateralInternal";
import { listDelinquencyCasesInternal } from "./routes/delinquency/listDelinquencyCasesInternal";
import { createDelinquencyCaseInternal } from "./routes/delinquency/createDelinquencyCaseInternal";
import { getDelinquencyCaseInternal } from "./routes/delinquency/getDelinquencyCaseInternal";
import { patchDelinquencyCaseInternal } from "./routes/delinquency/patchDelinquencyCaseInternal";
import { listCommunicationsInternal } from "./routes/delinquency/listCommunicationsInternal";
import { createCommunicationInternal } from "./routes/delinquency/createCommunicationInternal";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://rhino-asset.com",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

type RouteDefinition = {
  method: string;
  path: string;
  handler: EndpointHandler;
};

const routes: RouteDefinition[] = [
  { method: "POST", path: "/internal/onboarding-sessions", handler: createOnboardingSession },
  { method: "GET", path: "/public/onboarding-sessions/{sessionId}", handler: getOnboardingSession },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/contact/email", handler: submitOnboardingEmail },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/contact/email/retry", handler: retryOnboardingEmailVerification },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/contact/phone", handler: submitOnboardingPhone },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/contact/phone/retry", handler: retryOnboardingPhoneVerification },
  { method: "PUT", path: "/public/onboarding-sessions/{sessionId}/applicant-profile", handler: upsertApplicantProfile },
  { method: "GET", path: "/public/onboarding-sessions/{sessionId}/addresses", handler: listOnboardingAddresses },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/addresses", handler: createOnboardingAddress },
  { method: "PATCH", path: "/public/onboarding-sessions/{sessionId}/addresses/{addressId}", handler: updateOnboardingAddress },
  { method: "GET", path: "/public/onboarding-sessions/{sessionId}/requirements", handler: listPendingOnboardingRequirements },
  { method: "GET", path: "/public/onboarding-sessions/{sessionId}/documents", handler: listDocumentsForOnboardingSession },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/documents", handler: createOnboardingDocumentMetadata },
  { method: "POST", path: "/public/onboarding-sessions/{sessionId}/submit", handler: submitOnboardingForReview },
  { method: "GET", path: "/public/onboarding-sessions/{sessionId}/party", handler: getPartyBySessionId },
  { method: "PUT", path: "/public/onboarding-sessions/{sessionId}/webhook", handler: registerOnboardingSessionWebhook },
  { method: "GET", path: "/public/parties/{partyId}", handler: getParty },
  { method: "GET", path: "/public/parties/{partyId}/addresses", handler: listPartyAddresses },
  { method: "POST", path: "/public/parties/{partyId}/addresses", handler: createPartyAddress },
  { method: "PATCH", path: "/public/parties/{partyId}/addresses/{addressId}", handler: updatePartyAddress },
  { method: "GET", path: "/public/parties/{partyId}/available-loan-products", handler: listAvailableLoanProductsForParty },
  { method: "POST", path: "/public/applications", handler: createLoanApplication },
  { method: "GET", path: "/public/applications/{applicationId}", handler: getLoanApplication },
  { method: "PATCH", path: "/public/applications/{applicationId}", handler: updateLoanApplication },
  { method: "POST", path: "/public/applications/{applicationId}/submit", handler: submitLoanApplication },
  { method: "GET", path: "/public/parties/{partyId}/applications", handler: listPartyApplications },
  { method: "GET", path: "/public/parties/{partyId}/loans", handler: listLoansForParty },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}", handler: getLoanForParty },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/schedule", handler: listLoanScheduleForParty },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/balances", handler: listLoanBalancesForParty },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/balances/latest", handler: getLatestLoanBalanceForParty },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/payment-methods", handler: listPaymentMethodsForPartyLoan },
  { method: "POST", path: "/public/parties/{partyId}/loans/{loanId}/payment-methods", handler: createPaymentMethodForPartyLoan },
  { method: "PATCH", path: "/public/parties/{partyId}/loans/{loanId}/payment-methods/{paymentMethodId}", handler: updatePaymentMethodForPartyLoan },
  { method: "POST", path: "/public/parties/{partyId}/loans/{loanId}/payments", handler: createPaymentIntentForPartyLoan },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/transactions", handler: listTransactionsForPartyLoan },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/collateral", handler: listCollateralForPartyLoan },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/delinquency", handler: listDelinquencyForPartyLoan },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/communications", handler: listCommunicationsForPartyLoan },
  { method: "GET", path: "/public/parties/{partyId}/loans/{loanId}/documents", handler: listDocumentsForPartyLoan },
  { method: "PUT", path: "/internal/onboarding-sessions/{sessionId}/business-profile", handler: upsertInternalBusinessProfile },
  { method: "PUT", path: "/internal/onboarding-sessions/{sessionId}/business-activity", handler: upsertInternalBusinessActivity },
  { method: "POST", path: "/internal/onboarding-sessions/{sessionId}/business-roles", handler: createInternalBusinessRole },
  { method: "GET", path: "/internal/onboarding-sessions/{sessionId}/requirements", handler: listAllOnboardingRequirementsInternal },
  { method: "POST", path: "/internal/onboarding-sessions/{sessionId}/requirements/{requirementId}/decision", handler: decideOnboardingRequirementInternal },
  { method: "POST", path: "/internal/onboarding-sessions/{sessionId}/decision", handler: createOnboardingDecisionInternal },
  { method: "GET", path: "/internal/parties/{partyId}", handler: getParty },
  { method: "PATCH", path: "/internal/parties/{partyId}", handler: patchPartyInternal },
  { method: "GET", path: "/internal/parties/{partyId}/addresses", handler: listPartyAddressesInternal },
  { method: "POST", path: "/internal/parties/{partyId}/addresses", handler: createPartyAddressInternal },
  { method: "PATCH", path: "/internal/parties/{partyId}/addresses/{addressId}", handler: patchPartyAddressInternal },
  { method: "POST", path: "/internal/documents", handler: createDocumentInternal },
  { method: "GET", path: "/internal/documents/{documentId}", handler: getDocumentInternal },
  { method: "PATCH", path: "/internal/documents/{documentId}", handler: patchDocumentInternal },
  { method: "GET", path: "/internal/loan-products", handler: listLoanProductsInternal },
  { method: "POST", path: "/internal/loan-products", handler: createLoanProductInternal },
  { method: "GET", path: "/internal/loan-products/{loanProductId}", handler: getLoanProductInternal },
  { method: "PATCH", path: "/internal/loan-products/{loanProductId}", handler: patchLoanProductInternal },
  { method: "GET", path: "/internal/applications", handler: listApplicationsInternal },
  { method: "GET", path: "/internal/applications/{applicationId}", handler: getApplicationInternal },
  { method: "PATCH", path: "/internal/applications/{applicationId}", handler: patchApplicationInternal },
  { method: "POST", path: "/internal/applications/{applicationId}/decision", handler: createApplicationDecisionInternal },
  { method: "GET", path: "/internal/loans", handler: listLoansInternal },
  { method: "POST", path: "/internal/loans", handler: createLoanInternal },
  { method: "GET", path: "/internal/loans/{loanId}", handler: getLoanInternal },
  { method: "PATCH", path: "/internal/loans/{loanId}", handler: patchLoanInternal },
  { method: "POST", path: "/internal/loans/{loanId}/fund", handler: fundLoanInternal },
  { method: "POST", path: "/internal/loans/{loanId}/close", handler: closeLoanInternal },
  { method: "GET", path: "/internal/loans/{loanId}/schedule", handler: listLoanScheduleInternal },
  { method: "POST", path: "/internal/loans/{loanId}/schedule", handler: createLoanScheduleRowsInternal },
  { method: "PATCH", path: "/internal/loans/{loanId}/schedule/{scheduleId}", handler: patchLoanScheduleRowInternal },
  { method: "GET", path: "/internal/loans/{loanId}/balances", handler: listLoanBalancesInternal },
  { method: "POST", path: "/internal/loans/{loanId}/balances", handler: createLoanBalanceInternal },
  { method: "GET", path: "/internal/loans/{loanId}/transactions", handler: listTransactionsInternal },
  { method: "POST", path: "/internal/loans/{loanId}/transactions", handler: createTransactionInternal },
  { method: "GET", path: "/internal/loans/{loanId}/transactions/{transactionId}", handler: getTransactionInternal },
  { method: "PATCH", path: "/internal/loans/{loanId}/transactions/{transactionId}", handler: patchTransactionInternal },
  { method: "GET", path: "/internal/loans/{loanId}/payment-methods", handler: listPaymentMethodsInternal },
  { method: "POST", path: "/internal/loans/{loanId}/payment-methods", handler: createPaymentMethodInternal },
  { method: "PATCH", path: "/internal/loans/{loanId}/payment-methods/{paymentMethodId}", handler: patchPaymentMethodInternal },
  { method: "GET", path: "/internal/loans/{loanId}/collateral", handler: listCollateralInternal },
  { method: "POST", path: "/internal/loans/{loanId}/collateral", handler: createCollateralInternal },
  { method: "PATCH", path: "/internal/loans/{loanId}/collateral/{collateralId}", handler: patchCollateralInternal },
  { method: "GET", path: "/internal/loans/{loanId}/delinquency", handler: listDelinquencyCasesInternal },
  { method: "POST", path: "/internal/loans/{loanId}/delinquency", handler: createDelinquencyCaseInternal },
  { method: "GET", path: "/internal/loans/{loanId}/delinquency/{delinquencyCaseId}", handler: getDelinquencyCaseInternal },
  { method: "PATCH", path: "/internal/loans/{loanId}/delinquency/{delinquencyCaseId}", handler: patchDelinquencyCaseInternal },
  { method: "GET", path: "/internal/loans/{loanId}/communications", handler: listCommunicationsInternal },
  { method: "POST", path: "/internal/loans/{loanId}/communications", handler: createCommunicationInternal },
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function canonicalizeApiPath(pathname: string): string {
  const normalized = normalizePath(pathname);

  if (normalized.startsWith("/public/v1/")) {
    return `/public/${normalized.slice("/public/v1/".length)}`;
  }

  if (normalized === "/public/v1") {
    return "/public";
  }

  if (normalized.startsWith("/internal/v1/")) {
    return `/internal/${normalized.slice("/internal/v1/".length)}`;
  }

  if (normalized === "/internal/v1") {
    return "/internal";
  }

  return normalized;
}

function toPathRegex(pathTemplate: string): RegExp {
  const escaped = pathTemplate
    .replace(/[.*+?^$()|[\]\\]/g, "\\$&")
    .replace(/\\\{[^}]+\\\}/g, "[^/]+");

  return new RegExp(`^${escaped}$`);
}

const compiledRoutes = routes.map((route) => ({
  ...route,
  regex: toPathRegex(route.path),
}));

export default {
  async fetch(request: Request, env: unknown): Promise<Response> {
    const url = new URL(request.url);
    const pathname = canonicalizeApiPath(url.pathname);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET" && pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const route = compiledRoutes.find(
      (candidate) => candidate.method === request.method && candidate.regex.test(pathname),
    );

    if (!route) {
      return new Response("Not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const res = await route.handler(request, env);
    const headers = new Headers(res.headers);

    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));

    return new Response(res.body, {
      status: res.status,
      headers,
    });
  },
};
