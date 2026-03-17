type Lang = "en" | "es";

function parseCookie(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

function pickLangFromAcceptLanguage(value: string | null): Lang | null {
  if (!value) return null;
  const v = value.toLowerCase();
  // If Spanish appears before English, prefer Spanish; otherwise default later.
  const esIdx = v.indexOf("es");
  const enIdx = v.indexOf("en");
  if (esIdx !== -1 && (enIdx === -1 || esIdx < enIdx)) return "es";
  if (enIdx !== -1) return "en";
  return null;
}

function pickLangFromCountry(country: string | null): Lang | null {
  if (!country) return null;
  const c = country.toUpperCase();
  const spanish = new Set([
    "ES",
    "MX",
    "AR",
    "CO",
    "CL",
    "PE",
    "VE",
    "EC",
    "GT",
    "CU",
    "BO",
    "DO",
    "HN",
    "PY",
    "SV",
    "NI",
    "CR",
    "PA",
    "UY",
    "PR",
    "GQ",
  ]);
  return spanish.has(c) ? "es" : "en";
}

export const onRequest: PagesFunction = async (context) => {
  const request = context.request;
  const url = new URL(request.url);

  // Avoid setting cookies for static assets; it adds unnecessary headers/caching complexity.
  const isAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico");

  if (isAsset) return context.next();

  const cookies = parseCookie(request.headers.get("Cookie"));
  const existing = cookies.lang;
  if (existing === "en" || existing === "es") return context.next();

  const byHeader = pickLangFromAcceptLanguage(request.headers.get("Accept-Language"));
  const byIp = pickLangFromCountry(request.headers.get("CF-IPCountry"));
  const lang: Lang = byHeader ?? byIp ?? "en";

  const response = await context.next();
  const maxAge = 60 * 60 * 24 * 365;
  response.headers.append(
    "Set-Cookie",
    `lang=${encodeURIComponent(lang)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  );
  return response;
};

