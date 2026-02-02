import {
  LIVEAVATAR_API_KEY,
  LIVEAVATAR_API_URL,
  DEFAULT_AVATAR_ID,
  DEFAULT_VOICE_ID,
  IS_SANDBOX,
  LANGUAGE,
} from "../config";

export async function POST(request: Request) {
  let session_token = "";
  let session_id = "";

  // Allow dynamic parameters from request body, fall back to defaults
  let avatarId = DEFAULT_AVATAR_ID;
  let voiceId = DEFAULT_VOICE_ID;

  try {
    const body = await request.json();
    if (body.avatarId) {
      avatarId = body.avatarId;
    }
    if (body.voiceId) {
      voiceId = body.voiceId;
    }
  } catch {
    // No body or invalid JSON, use defaults
  }

  // Check for API key
  if (!LIVEAVATAR_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "LiveAvatar API key not configured. Please set LIVEAVATAR_API_KEY in your .env.local file.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // For OpenClaw integration, we use FULL mode but without a predefined context
    // The avatar will act as a passthrough - we'll control what it says via the bridge
    const res = await fetch(`${LIVEAVATAR_API_URL}/v1/sessions/token`, {
      method: "POST",
      headers: {
        "X-API-KEY": LIVEAVATAR_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: avatarId,
        avatar_persona: {
          // Only include voice_id if provided
          ...(voiceId ? { voice_id: voiceId } : {}),
          // No context_id - we'll use OpenClaw for the intelligence
          language: LANGUAGE,
        },
        is_sandbox: IS_SANDBOX,
      }),
    });

    if (!res.ok) {
      const resp = await res.json();
      const errorMessage =
        resp.data?.[0]?.message ?? "Failed to retrieve session token";
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    session_token = data.data.session_token;
    session_id = data.data.session_id;
  } catch (error) {
    console.error("Error retrieving session token:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!session_token) {
    return new Response(
      JSON.stringify({ error: "Failed to retrieve session token" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ session_token, session_id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
