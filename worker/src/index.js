const ALLOWED_ORIGIN = "https://axtrand.github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
    },
  });
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    // Health check
    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        success: true,
        service: "Axtrand AI Worker",
        status: "online",
      });
    }

    // Chat endpoint
    if (request.method === "POST" && url.pathname === "/chat") {
      try {
        if (!env.GEMINI_API_KEY) {
          return jsonResponse(
            {
              success: false,
              error: "GEMINI_API_KEY is not configured.",
            },
            500
          );
        }

        const body = await request.json();

        const userMessage = body.message;

        if (!userMessage || typeof userMessage !== "string") {
          return jsonResponse(
            {
              success: false,
              error: "Message is required.",
            },
            400
          );
        }

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: userMessage,
                    },
                  ],
                },
              ],
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          return jsonResponse(
            {
              success: false,
              error: "Gemini API error.",
              details: result,
            },
            response.status
          );
        }

        const text =
          result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return jsonResponse({
          success: true,
          reply: text,
        });
      } catch (error) {
        return jsonResponse(
          {
            success: false,
            error: "Worker error.",
            details: error.message,
          },
          500
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        error: "Not found.",
      },
      404
    );
  },
};
