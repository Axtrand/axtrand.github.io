const ALLOWED_ORIGIN = "https://axtrand.github.io";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function addCors(response, origin) {
  const headers = new Headers(response.headers);

  const cors = corsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);

    // Worker health check
    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse(
        {
          success: true,
          service: "Axtrand AI Gemini Proxy",
          status: "online",
        },
        200,
        origin
      );
    }

    // Gemini model list
    if (request.method === "GET" && url.pathname === "/models") {
      const upstreamUrl = `${GEMINI_BASE}/models`;

      const response = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
      });

      return addCors(response, origin);
    }

    // Gemini streaming chat
    if (request.method === "POST" && url.pathname === "/chat") {
      const model = url.searchParams.get("model");

      if (!model) {
        return jsonResponse(
          {
            error: "Missing model parameter",
          },
          400,
          origin
        );
      }

      const body = await request.text();

      const upstreamUrl =
        `${GEMINI_BASE}/models/${encodeURIComponent(model)}` +
        `:streamGenerateContent?alt=sse`;

      const response = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body,
      });

      return addCors(response, origin);
    }

    return jsonResponse(
      {
        error: "Not found",
      },
      404,
      origin
    );
  },
};
