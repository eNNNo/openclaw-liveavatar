import { LIVEAVATAR_API_KEY, LIVEAVATAR_API_URL } from "../config";

interface Avatar {
  id: string;
  name: string;
  preview_url?: string;
  status?: string;
  is_custom?: boolean;
  is_expired?: boolean;
  default_voice?: {
    id: string;
    name: string;
  };
}

export async function GET() {
  if (!LIVEAVATAR_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "LiveAvatar API key not configured",
        avatars: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch(`${LIVEAVATAR_API_URL}/v1/avatars`, {
      headers: {
        "X-API-KEY": LIVEAVATAR_API_KEY,
      },
    });

    if (!res.ok) {
      console.error("Failed to fetch avatars:", res.status);
      return new Response(JSON.stringify({ avatars: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const allAvatars: Avatar[] = data.data?.results || [];

    // Return all avatars - let the UI show which ones are expired
    // Note: Expired avatars may not work for sessions but users can still see them
    return new Response(JSON.stringify({ avatars: allAvatars }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching avatars:", error);
    return new Response(JSON.stringify({ avatars: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
