export const config = { runtime: "edge" };

const TARGET = (process.env.TARGET_DOMAIN || "").replace(/\/+$/, "");

const HOP_BY_HOP = new Set([
  "connection","keep-alive","transfer-encoding","te",
  "trailer","upgrade","proxy-authorization","proxy-authenticate",
]);

export default async function handler(req) {
  if (!TARGET) {
    return new Response("TARGET_DOMAIN not set", { status: 500 });
  }

  try {
    const url = new URL(req.url);
    const targetUrl = TARGET + url.pathname + url.search;
    const targetHost = new URL(TARGET).host;

    const headers = new Headers();
    for (const [k, v] of req.headers.entries()) {
      const kl = k.toLowerCase();
      if (HOP_BY_HOP.has(kl)) continue;
      if (kl.startsWith("x-vercel-")) continue;
      if (kl === "host" || kl === "x-forwarded-host" || 
          kl === "x-forwarded-proto" || kl === "x-forwarded-port") continue;
      headers.set(k, v);
    }
    headers.set("host", targetHost);

    const fetchOptions = { method: req.method, headers, redirect: "manual" };
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body = req.body;
      fetchOptions.duplex = "half";
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    const respHeaders = new Headers();
    for (const [k, v] of upstream.headers.entries()) {
      const kl = k.toLowerCase();
      if (HOP_BY_HOP.has(kl)) continue;
      if (kl.startsWith("x-vercel-")) continue;
      respHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });

  } catch (err) {
    console.error("relay error:", err);
    return new Response("relay error: " + err.message, { status: 502 });
  }
}
