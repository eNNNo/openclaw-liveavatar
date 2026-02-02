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

interface AvatarResponse {
  data?: {
    results?: Avatar[];
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Fetch all pages from a paginated endpoint
async function fetchAllAvatars(endpoint: string): Promise<Avatar[]> {
  const allAvatars: Avatar[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const res = await fetch(`${LIVEAVATAR_API_URL}${endpoint}?page=${page}&limit=${limit}`, {
      headers: {
        "X-API-KEY": LIVEAVATAR_API_KEY!,
      },
    });

    if (!res.ok) {
      console.error(`Failed to fetch ${endpoint} page ${page}:`, res.status);
      break;
    }

    const data: AvatarResponse = await res.json();
    const pageAvatars = data.data?.results || [];
    allAvatars.push(...pageAvatars);

    const total = data.data?.total || pageAvatars.length;
    console.log(`[Avatars] ${endpoint} page ${page}: ${pageAvatars.length} avatars (total: ${total})`);

    // Check if we've fetched all
    if (allAvatars.length >= total || pageAvatars.length === 0) {
      break;
    }
    page++;
  }

  return allAvatars;
}

export async function GET() {
  if (!LIVEAVATAR_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "LiveAvatar API key not configured",
        customAvatars: [],
        publicAvatars: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch both custom (user) avatars and public avatars in parallel
    const [customAvatars, publicAvatars] = await Promise.all([
      fetchAllAvatars("/v1/avatars"),        // User's custom avatars
      fetchAllAvatars("/v1/avatars/public"), // Public avatars
    ]);

    // Mark custom avatars
    const markedCustomAvatars = customAvatars.map(avatar => ({
      ...avatar,
      is_custom: true,
    }));

    // Mark public avatars (they don't expire)
    const markedPublicAvatars = publicAvatars.map(avatar => ({
      ...avatar,
      is_custom: false,
      is_expired: false, // Public avatars don't expire
    }));

    console.log(`[Avatars] Total: ${markedCustomAvatars.length} custom, ${markedPublicAvatars.length} public`);

    return new Response(
      JSON.stringify({
        customAvatars: markedCustomAvatars,
        publicAvatars: markedPublicAvatars,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching avatars:", error);
    return new Response(
      JSON.stringify({
        customAvatars: [],
        publicAvatars: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
